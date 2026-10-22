const assert = require("node:assert/strict");
const { before, beforeEach, after, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const QuizSet = require("../models/quizSetModel");
const Quiz = require("../models/quizModel");
const QuizSession = require("../models/quizSessionModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizRateWindow = require("../models/quizRateWindowModel");
const GuestQuizSession = require("../models/guestQuizSessionModel");
const GuestQuizAttempt = require("../models/guestQuizAttemptModel");
const GuestQuizRateWindow = require("../models/guestQuizRateWindowModel");
const sets = require("../services/standaloneQuizSets");
const revisions = require("../services/standaloneQuizRevisions");
const { readGuestCookie, verifyCredential, guestCookieConfig, SESSION_MS, RESULT_MS } = require("../services/guestQuizSecurity");
const { keyHash } = require("../services/guestQuizRateLimit");

const dbName = "isolated_guest_quiz_runtime";
const secret = "isolated-guest-runtime-test-secret";
const origin = "http://localhost:5173";
let mongo; let directory; let server; let base; let sequence = 0;
const previousEnv = {};
const names = ["NODE_ENV", "JWT_SECRET", "GUEST_QUIZ_RUNTIME_ENABLED", "STANDALONE_QUIZ_RUNTIME_ENABLED",
  "STANDALONE_QUIZ_EXPECTED_DB", "FRONTEND_URL_LOCAL", "TRUST_PROXY"];
const models = [QuizSet, Quiz, QuizSession, QuizAttempt, QuizRateWindow,
  GuestQuizSession, GuestQuizAttempt, GuestQuizRateWindow];

async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const selected = socket.address().port;
      socket.close((error) => error ? reject(error) : resolve(selected));
    });
  });
}

async function published(access = "public") {
  const created = await sets.createSet({ name: `Guest test ${++sequence}` });
  const set = await sets.transitionSet(created._id, created.version, "activate");
  const quiz = await sets.createSetDraft(set._id, { title: `Greeting ${sequence}`,
    category: "Vocabulary", difficulty: "Beginner", standaloneAccess: access,
    questions: [{ prompt: "Thai greeting?", options: ["Sawasdee", "Bye"],
      correctAnswer: 0, explanation: "Sawasdee is hello." }] });
  return { set, quiz: await revisions.publishDraft(quiz._id, 1) };
}

async function request(route, { method = "GET", cookie, body, header = "1", requestOrigin = origin } = {}) {
  const response = await fetch(`${base}/quizzes${route}`, { method,
    headers: { ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json", "X-Guest-Quiz-Request": header }),
      ...(requestOrigin ? { Origin: requestOrigin } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json(),
    cookie: response.headers.get("set-cookie"), headers: response.headers };
}

const start = (quiz, cookie, options = {}) => request(`/standalone/${quiz._id}/guest/sessions`,
  { method: "POST", cookie, body: {}, ...options });
const submit = (quiz, session, cookie, answers = [0]) => request(`/standalone/${quiz._id}/guest/submit`,
  { method: "POST", cookie, body: { sessionId: session.sessionId, revision: session.revision, answers } });
const cookiePair = (setCookie) => setCookie.split(";")[0];

before(async () => {
  const mongoPort = await freePort(); const apiPort = await freePort();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-guest-runtime-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(mongoPort),
    "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(mongoPort);
  await mongoose.connect(`mongodb://127.0.0.1:${mongoPort}/${dbName}?replicaSet=paymentTests`,
    { autoIndex: false, autoCreate: false });
  for (const name of names) previousEnv[name] = process.env[name];
  Object.assign(process.env, { NODE_ENV: "test", JWT_SECRET: secret,
    GUEST_QUIZ_RUNTIME_ENABLED: "true", STANDALONE_QUIZ_RUNTIME_ENABLED: "true",
    STANDALONE_QUIZ_EXPECTED_DB: dbName, FRONTEND_URL_LOCAL: origin });
  delete process.env.TRUST_PROXY;
  const app = express(); app.use(express.json()); app.use("/quizzes", require("../routes/quiz"));
  server = app.listen(apiPort, "127.0.0.1"); base = `http://127.0.0.1:${apiPort}`;
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  for (const model of models) { await model.createCollection(); await model.syncIndexes(); }
  process.env.GUEST_QUIZ_RUNTIME_ENABLED = "true";
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo && mongo.exitCode === null) await new Promise((resolve) => { mongo.once("exit", resolve); mongo.kill("SIGTERM"); });
  if (directory) await fs.rm(directory, { recursive: true, force: true });
  for (const name of names) {
    if (previousEnv[name] === undefined) delete process.env[name]; else process.env[name] = previousEnv[name];
  }
});

test("Public guest starts, retrieves safe questions, resumes and keeps earlier quiz access", async () => {
  const first = await published(); const second = await published();
  const opened = await start(first.quiz);
  assert.equal(opened.status, 201);
  assert.ok(opened.cookie?.includes("HttpOnly"));
  assert.equal(opened.body.created, true);
  assert.equal(opened.body.questions[0].correctAnswer, undefined);
  assert.equal(opened.body.questions[0].explanation, undefined);
  assert.ok(Math.abs(Date.parse(opened.body.expiresAt) - Date.now() - SESSION_MS) < 5000);
  const cookie = cookiePair(opened.cookie);
  const read = await request(`/standalone/${first.quiz._id}/guest/sessions/${opened.body.sessionId}`, { cookie });
  assert.equal(read.status, 200);
  assert.equal(read.body.sessionId, opened.body.sessionId);
  assert.equal(read.body.questions[0].correctAnswer, undefined);
  const resumed = await start(first.quiz, cookie);
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.sessionId, opened.body.sessionId);
  const other = await start(second.quiz, cookie);
  assert.equal(other.status, 201);
  const oldOwner = verifyCredential(readGuestCookie(cookie, process.env), { env: process.env });
  const newOwner = verifyCredential(readGuestCookie(cookiePair(other.cookie), process.env), { env: process.env });
  assert.equal(oldOwner.ownerHash, newOwner.ownerHash);
  assert.equal((await request(`/standalone/${first.quiz._id}/guest/sessions/${opened.body.sessionId}`,
    { cookie: cookiePair(other.cookie) })).status, 200);
});

test("Students Only and inactive Sets cannot start or expose guest questions", async () => {
  const restricted = await published("students");
  assert.equal((await start(restricted.quiz)).status, 404);
  const open = await published();
  await sets.transitionSet(open.set._id, open.set.version, "disable");
  assert.equal((await start(open.quiz)).status, 404);
  assert.equal(await GuestQuizSession.countDocuments(), 0);
});

test("guest submission grades immutable snapshot, replays once, and isolates result ownership", async () => {
  const { quiz } = await published();
  const opened = await start(quiz); const cookie = cookiePair(opened.cookie);
  const foreign = await start(quiz); const otherCookie = cookiePair(foreign.cookie);
  assert.equal((await request(`/standalone/${quiz._id}/guest/sessions/${opened.body.sessionId}`,
    { cookie: otherCookie })).status, 409);
  assert.equal((await submit(quiz, opened.body, otherCookie)).status, 409);
  const saved = await submit(quiz, opened.body, cookie);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.score, 1);
  assert.equal(saved.body.review[0].correctAnswer, 0);
  assert.equal(saved.body.review[0].explanation, "Sawasdee is hello.");
  const replay = await submit(quiz, { ...opened.body, revision: 999 }, cookie, [1]);
  assert.equal(replay.body.attemptId, saved.body.attemptId);
  assert.equal(await GuestQuizAttempt.countDocuments(), 1);
  assert.equal((await request(`/standalone/guest/attempts/${saved.body.attemptId}`, { cookie: otherCookie })).status, 404);
  assert.equal((await request(`/standalone/guest/attempts/${saved.body.attemptId}`, { cookie })).body.attemptId,
    saved.body.attemptId);
  assert.equal((await request(`/standalone/guest/attempts/${saved.body.attemptId}`)).status, 401);
});

test("parallel submissions converge on one committed guest result", async () => {
  const { quiz } = await published(); const opened = await start(quiz); const cookie = cookiePair(opened.cookie);
  const outcomes = await Promise.all([submit(quiz, opened.body, cookie), submit(quiz, opened.body, cookie)]);
  assert.ok(outcomes.every((item) => item.status === 200));
  assert.equal(outcomes[0].body.attemptId, outcomes[1].body.attemptId);
  assert.equal(await GuestQuizAttempt.countDocuments(), 1);
});

test("expired session cannot resume or submit; expired result cannot be reviewed", async () => {
  const { quiz } = await published(); const opened = await start(quiz); const cookie = cookiePair(opened.cookie);
  const past = new Date(Date.now() - SESSION_MS - 1000);
  await GuestQuizSession.collection.updateOne({ _id: new mongoose.Types.ObjectId(opened.body.sessionId) },
    { $set: { startedAt: past, expiresAt: new Date(past.getTime() + SESSION_MS) } });
  assert.equal((await request(`/standalone/${quiz._id}/guest/sessions/${opened.body.sessionId}`, { cookie })).status, 409);
  assert.equal((await submit(quiz, opened.body, cookie)).status, 409);
  const fresh = await start(quiz, cookie);
  const saved = await submit(quiz, fresh.body, cookie);
  assert.equal(saved.status, 200);
  const submittedAt = new Date(Date.now() - RESULT_MS - 1000);
  await GuestQuizAttempt.collection.updateOne({ _id: new mongoose.Types.ObjectId(saved.body.attemptId) },
    { $set: { submittedAt, expiresAt: new Date(submittedAt.getTime() + RESULT_MS) } });
  assert.equal((await request(`/standalone/guest/attempts/${saved.body.attemptId}`, { cookie })).status, 404);
  assert.equal((await submit(quiz, fresh.body, cookie)).status, 404);
});

test("Set disable and Public-to-Students Only republish reject unfinished guest work but preserve saved review", async () => {
  const first = await published(); const opened = await start(first.quiz); const cookie = cookiePair(opened.cookie);
  const saved = await submit(first.quiz, opened.body, cookie);
  const unfinished = await start(first.quiz, cookie);
  await sets.transitionSet(first.set._id, first.set.version, "disable");
  assert.equal((await submit(first.quiz, unfinished.body, cookie)).status, 404);
  assert.equal((await request(`/standalone/guest/attempts/${saved.body.attemptId}`, { cookie })).status, 200);
  const second = await published(); const active = await start(second.quiz, cookie);
  const changed = await revisions.saveDraft(second.quiz._id, 0, { standaloneAccess: "students" });
  await revisions.publishDraft(second.quiz._id, changed.draft.version);
  assert.equal((await submit(second.quiz, active.body, cookie)).status, 404);
  assert.equal((await request(`/standalone/${second.quiz._id}/guest/sessions/${active.body.sessionId}`,
    { cookie })).status, 404);
});

test("guest writes reject missing or wrong Origin and missing custom header", async () => {
  const { quiz } = await published();
  assert.equal((await start(quiz, undefined, { requestOrigin: "http://localhost:5175" })).status, 403);
  assert.equal((await start(quiz, undefined, { requestOrigin: null })).status, 403);
  assert.equal((await start(quiz, undefined, { header: "0" })).status, 403);
  assert.equal(await GuestQuizSession.countDocuments(), 0);
});

test("runtime fails closed when disabled or guest rate index is missing", async () => {
  const { quiz } = await published();
  process.env.GUEST_QUIZ_RUNTIME_ENABLED = "false";
  assert.equal((await start(quiz)).status, 503);
  process.env.GUEST_QUIZ_RUNTIME_ENABLED = "true";
  await GuestQuizRateWindow.collection.dropIndex("one_guest_quiz_rate_window");
  assert.equal((await start(quiz)).status, 503);
  assert.equal(await GuestQuizSession.countDocuments(), 0);
});

test("distributed owner rate limit rejects saturated starts", async () => {
  const { quiz } = await published(); const opened = await start(quiz); const cookie = cookiePair(opened.cookie);
  const ownerHash = verifyCredential(readGuestCookie(cookie), { env: process.env }).ownerHash;
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const windowStart = new Date(Math.floor(hello.localTime.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000));
  await GuestQuizRateWindow.updateOne({ keyHash: keyHash("owner", ownerHash), operation: "start", windowStart },
    { $set: { count: 20 } });
  const denied = await start(quiz, cookie);
  assert.equal(denied.status, 429);
  assert.ok(Number(denied.headers.get("retry-after")) > 0);
});

test("ambiguous committed submission resolves to one replayable result", async () => {
  const { quiz } = await published(); const opened = await start(quiz); const cookie = cookiePair(opened.cookie);
  const original = mongoose.startSession;
  mongoose.startSession = async (...args) => {
    const transaction = await original.apply(mongoose, args);
    const commit = transaction.commitTransaction.bind(transaction);
    transaction.commitTransaction = async () => {
      await commit();
      const error = new Error("uncertain commit");
      error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
      throw error;
    };
    return transaction;
  };
  let saved;
  try { saved = await submit(quiz, opened.body, cookie); }
  finally { mongoose.startSession = original; }
  assert.equal(saved.status, 200);
  assert.equal(await GuestQuizAttempt.countDocuments(), 1);
  assert.equal((await submit(quiz, opened.body, cookie)).body.attemptId, saved.body.attemptId);
});
