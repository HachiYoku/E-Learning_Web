const assert = require("node:assert/strict");
const { before, beforeEach, after, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const Quiz = require("../models/quizModel");
const QuizSession = require("../models/quizSessionModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizRateWindow = require("../models/quizRateWindowModel");
const User = require("../models/userModel");
const revisions = require("../services/standaloneQuizRevisions");

const dbName = "quiz_standalone_api_test";
const secret = "isolated-standalone-api-test-secret";
let mongo; let directory; let server; let base; let oldSecret; let oldEnabled; let oldExpected; let sequence = 0;
const id = () => new mongoose.Types.ObjectId();
const question = (prompt = "Original question") => ({ prompt, options: ["A", "B"],
  correctAnswer: 0, explanation: "The saved answer is A." });
const draft = (access = "public") => ({ title: `Practice ${++sequence}`, category: "Vocabulary",
  difficulty: "Beginner", standaloneAccess: access, questions: [question()] });

async function port() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const selected = socket.address().port;
      socket.close((error) => error ? reject(error) : resolve(selected));
    });
  });
}

async function account(role = "user") {
  const user = await User.create({ name: `${role} account`, email: `${role}-${++sequence}@example.test`,
    password: "local-test-only", role, isVerified: true, isActive: true });
  return { id: String(user._id), role, token: jwt.sign({ id: String(user._id), sessionVersion: 0 }, secret) };
}

async function published(access = "public") {
  const created = await revisions.createDraft(draft(access));
  return revisions.publishDraft(created._id, 1);
}

async function request(route, { method = "GET", token, body } = {}) {
  const response = await fetch(`${base}/quizzes${route}`, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

async function start(quiz, token) {
  return request(`/standalone/${quiz._id}/sessions`, { method: "POST", token });
}

async function submit(quiz, session, token, answers = [0]) {
  return request(`/standalone/${quiz._id}/submit`, { method: "POST", token,
    body: { sessionId: session.sessionId, revision: session.revision, answers } });
}

before(async () => {
  const mongoPort = await port(); const apiPort = await port();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-standalone-api-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(mongoPort), "--dbpath", directory,
    "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(mongoPort);
  await mongoose.connect(`mongodb://127.0.0.1:${mongoPort}/${dbName}?replicaSet=paymentTests`,
    { autoIndex: false, autoCreate: false });
  oldSecret = process.env.JWT_SECRET; oldEnabled = process.env.STANDALONE_QUIZ_RUNTIME_ENABLED;
  oldExpected = process.env.STANDALONE_QUIZ_EXPECTED_DB;
  process.env.JWT_SECRET = secret;
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/quizzes", require("../routes/quiz"));
  server = app.listen(apiPort, "127.0.0.1");
  base = `http://127.0.0.1:${apiPort}`;
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  for (const model of [Quiz, QuizSession, QuizAttempt, QuizRateWindow, User]) {
    await model.createCollection(); await model.syncIndexes();
  }
  process.env.STANDALONE_QUIZ_RUNTIME_ENABLED = "true";
  process.env.STANDALONE_QUIZ_EXPECTED_DB = dbName;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo && mongo.exitCode === null) {
    await new Promise((resolve) => { mongo.once("exit", resolve); mongo.kill("SIGTERM"); });
  }
  if (directory) await fs.rm(directory, { recursive: true, force: true });
  for (const [name, value] of [["JWT_SECRET", oldSecret], ["STANDALONE_QUIZ_RUNTIME_ENABLED", oldEnabled],
    ["STANDALONE_QUIZ_EXPECTED_DB", oldExpected]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

test("anonymous Public discovery works; Students Only requires valid authentication", async () => {
  const open = await published(); const privateQuiz = await published("students"); const student = await account();
  const anonymous = await request("/standalone");
  assert.equal(anonymous.status, 200);
  assert.deepEqual(anonymous.body.quizzes.map((quiz) => quiz.id), [String(open._id)]);
  assert.equal((await request(`/standalone/${privateQuiz._id}`)).status, 404);
  assert.equal((await request(`/standalone/${privateQuiz._id}`, { token: student.token })).status, 200);
  assert.equal((await request(`/standalone/${privateQuiz._id}`, { token: "invalid" })).status, 404);
});

test("Student and Admin start and resume independent owner-scoped immutable sessions", async () => {
  const quiz = await published("students"); const student = await account(); const admin = await account("admin");
  assert.equal((await start(quiz)).status, 401);
  const first = await start(quiz, student.token);
  assert.equal(first.status, 201);
  assert.equal(first.body.created, true);
  assert.equal(first.body.questions[0].correctAnswer, undefined);
  assert.equal(first.body.questions[0].explanation, undefined);
  const repeated = await start(quiz, student.token);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.sessionId, first.body.sessionId);
  const adminStart = await start(quiz, admin.token);
  assert.equal(adminStart.status, 201);
  assert.notEqual(adminStart.body.sessionId, first.body.sessionId);
  const adminResult = await submit(quiz, adminStart.body, admin.token);
  assert.equal(adminResult.status, 200);
  assert.equal(adminResult.body.score, 1);
  assert.equal((await request(`/standalone/${quiz._id}/attempts`, { token: admin.token })).body.attempts[0].attemptId,
    adminResult.body.attemptId);
  assert.equal((await request(`/standalone/attempts/${adminResult.body.attemptId}`, { token: student.token })).status, 404);
  const concurrent = await Promise.all([start(quiz, student.token), start(quiz, student.token)]);
  assert.ok(concurrent.every((response) => response.body.sessionId === first.body.sessionId));
  assert.equal(await QuizSession.countDocuments({ quiz: quiz._id, user: student.id, activeSlot: true }), 1);
  const changed = await revisions.saveDraft(quiz._id, 0, { ...draft("students"), questions: [question("Changed question")] });
  await revisions.publishDraft(quiz._id, changed.draft.version);
  assert.equal((await start(quiz, student.token)).body.questions[0].prompt, "Original question");
});

test("HTTP submission scores saved snapshots, replays changed payload, and isolates results", async () => {
  const quiz = await published(); const student = await account(); const admin = await account("admin");
  const session = (await start(quiz, student.token)).body;
  assert.equal((await request(`/standalone/${quiz._id}/submit`, { method: "POST", token: student.token,
    body: { sessionId: session.sessionId, revision: session.revision, answers: "wrong" } })).status, 400);
  assert.equal((await submit(quiz, { ...session, revision: session.revision + 1 }, student.token)).status, 409);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 0);
  const saved = await submit(quiz, session, student.token);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.score, 1);
  assert.equal(saved.body.review[0].correctAnswer, 0);
  assert.equal(saved.body.review[0].explanation, "The saved answer is A.");
  const replay = await submit(quiz, { ...session, revision: session.revision + 99 }, student.token, [1]);
  assert.deepEqual(replay.body, saved.body);
  const malformedRetry = await request(`/standalone/${quiz._id}/submit`, { method: "POST", token: student.token,
    body: { sessionId: session.sessionId, answers: "different" } });
  assert.deepEqual(malformedRetry.body, saved.body);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 1);
  assert.equal((await request(`/standalone/attempts/${saved.body.attemptId}`, { token: admin.token })).status, 404);
  assert.equal((await request(`/standalone/attempts/${saved.body.attemptId}`, { token: student.token })).body.attemptId,
    saved.body.attemptId);
  assert.equal((await request(`/standalone/${quiz._id}/submit`, { method: "POST", token: admin.token,
    body: { sessionId: session.sessionId, revision: session.revision, answers: [0] } })).status, 409);
});

test("history keyset pages stay stable as new attempts arrive and survive Archive", async () => {
  const quiz = await published(); const student = await account(); const stranger = await account();
  const results = [];
  for (let index = 0; index < 3; index += 1) {
    const session = (await start(quiz, student.token)).body;
    results.push((await submit(quiz, session, student.token)).body);
  }
  const first = await request(`/standalone/${quiz._id}/attempts?limit=2`, { token: student.token });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.attempts.map(({ attemptNumber }) => attemptNumber), [3, 2]);
  assert.equal(first.body.nextCursor, "2");
  const nextSession = (await start(quiz, student.token)).body;
  await submit(quiz, nextSession, student.token);
  const second = await request(`/standalone/${quiz._id}/attempts?limit=2&before=${first.body.nextCursor}`,
    { token: student.token });
  assert.deepEqual(second.body.attempts.map(({ attemptNumber }) => attemptNumber), [1]);
  assert.equal(second.body.nextCursor, null);
  assert.equal((await request(`/standalone/${quiz._id}/attempts?limit=21`, { token: student.token })).status, 400);
  assert.equal((await request(`/standalone/${quiz._id}/attempts?before=bad`, { token: student.token })).status, 400);
  await revisions.changeAvailability(quiz._id, "archive");
  assert.equal((await start(quiz, student.token)).status, 404);
  assert.equal((await request(`/standalone/${quiz._id}/attempts`, { token: stranger.token })).status, 404);
  assert.equal((await request(`/standalone/${quiz._id}/attempts?limit=2`, { token: student.token })).status, 200);
  assert.equal((await request(`/standalone/attempts/${results[0].attemptId}`, { token: student.token })).status, 200);
  await QuizSession.deleteOne({ _id: (await QuizAttempt.findById(results[0].attemptId)).session });
  assert.equal((await submit(quiz, { sessionId: (await QuizAttempt.findById(results[0].attemptId)).session,
    revision: results[0].revision }, student.token, [1])).body.attemptId, results[0].attemptId);
});

test("twentieth request passes, twenty-first is 429, and submit uses an independent counter", async () => {
  const quiz = await published(); const student = await account();
  let session;
  for (let index = 0; index < 20; index += 1) {
    const response = await start(quiz, student.token);
    assert.ok([200, 201].includes(response.status)); session = response.body;
  }
  const blocked = await start(quiz, student.token);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  for (let index = 0; index < 20; index += 1) {
    assert.equal((await submit(quiz, session, student.token)).status, 200);
  }
  const submitBlocked = await submit(quiz, session, student.token);
  assert.equal(submitBlocked.status, 429);
  assert.ok(Number(submitBlocked.headers.get("retry-after")) >= 1);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 1);
});

test("invalid submissions still count and Disable invalidates an unfinished session", async () => {
  const quiz = await published(); const student = await account();
  const session = (await start(quiz, student.token)).body;
  for (let index = 0; index < 20; index += 1) {
    assert.equal((await submit(quiz, session, student.token, [99])).status, 400);
  }
  assert.equal((await submit(quiz, session, student.token, [0])).status, 429);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 0);
  await revisions.changeAvailability(quiz._id, "disable");
  assert.equal((await QuizSession.findById(session.sessionId)).activeSlot, false);
  assert.equal((await start(quiz, student.token)).status, 404);
});

test("runtime flag and missing indexes fail closed on start, result, and history", async () => {
  const quiz = await published(); const student = await account();
  delete process.env.STANDALONE_QUIZ_RUNTIME_ENABLED;
  assert.equal((await start(quiz, student.token)).status, 503);
  assert.equal((await request(`/standalone/${quiz._id}/attempts`, { token: student.token })).status, 503);
  assert.equal((await request(`/standalone/attempts/${id()}`, { token: student.token })).status, 503);
  assert.equal((await request("/standalone")).status, 200);
  process.env.STANDALONE_QUIZ_RUNTIME_ENABLED = "true";
  await QuizRateWindow.collection.dropIndex("one_quiz_rate_window");
  assert.equal((await start(quiz, student.token)).status, 503);
  assert.equal(await QuizSession.countDocuments({ quiz: quiz._id }), 0);
  await QuizRateWindow.syncIndexes();
  await QuizSession.collection.dropIndex("one_active_standalone_session");
  assert.equal((await start(quiz, student.token)).status, 503);
  assert.equal((await request(`/standalone/${quiz._id}/attempts`, { token: student.token })).status, 503);
  assert.equal(await QuizSession.countDocuments({ quiz: quiz._id }), 0);
});

test("an unresolved ambiguous commit returns sanitized 503 without a duplicate attempt", async () => {
  const quiz = await published(); const student = await account();
  const session = (await start(quiz, student.token)).body;
  const original = mongoose.startSession;
  mongoose.startSession = async function startSessionWithUnknownCommit(...args) {
    const transaction = await original.apply(this, args);
    transaction.commitTransaction = async () => {
      const error = new Error("private transaction details");
      error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
      throw error;
    };
    return transaction;
  };
  let response;
  try { response = await submit(quiz, session, student.token); }
  finally { mongoose.startSession = original; }
  assert.equal(response.status, 503);
  assert.equal(response.body.code, "standalone_transaction_outcome_unknown");
  assert.equal(JSON.stringify(response.body).includes("private transaction"), false);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 0);
});

test("malformed IDs and unavailable resources use sanitized status codes", async () => {
  const quiz = await published(); const student = await account();
  assert.equal((await request("/standalone/not-an-id/sessions", { method: "POST", token: student.token })).status, 404);
  assert.equal((await request("/standalone/attempts/not-an-id", { token: student.token })).status, 404);
  assert.equal((await request("/standalone/not-an-id/attempts", { token: student.token })).status, 404);
  assert.equal((await request(`/standalone/${quiz._id}/submit`, { method: "POST", token: student.token,
    body: { sessionId: "not-an-id", revision: 1, answers: [0] } })).status, 400);
  assert.equal((await request(`/standalone/${quiz._id}/sessions`, { method: "POST", token: "bad-token" })).status, 401);
});
