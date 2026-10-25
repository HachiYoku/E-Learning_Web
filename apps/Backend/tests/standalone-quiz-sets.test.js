const assert = require("node:assert/strict");
const { before, beforeEach, after, test, mock } = require("node:test");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const QuizSet = require("../models/quizSetModel");
const Quiz = require("../models/quizModel");
const QuizSession = require("../models/quizSessionModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizMedia = require("../models/quizMediaModel");
const QuizCreationRequest = require("../models/quizCreationRequestModel");
const CoverAsset = require("../models/quizSetCoverAssetModel");
const cloudinary = require("../config/cloudinary");
const covers = require("../services/quizSetCoverService");
const { TESTING_FOLDER } = require("../services/quizSetCoverEnvironment");
const User = require("../models/userModel");
const sets = require("../services/standaloneQuizSets");
const revisions = require("../services/standaloneQuizRevisions");
const { startOrResumeStandaloneQuizSession: start } = require("../services/standaloneQuizSessionService");
const { submitStandaloneQuiz: submit } = require("../services/standaloneQuizSubmissionService");
const { REQUIRED, inspect } = require("../scripts/preflightQuizSetIndexes");

const id = () => new mongoose.Types.ObjectId();
const creationId = () => require("node:crypto").randomUUID();
const learner = () => ({ id: id(), role: "user" });
async function studentToken() {
  const student = await User.create({ name: "Learner", email: "learner@example.test", password: "local-only",
    role: "user", isVerified: true, isActive: true });
  return jwt.sign({ id: String(student._id), sessionVersion: 0 }, process.env.JWT_SECRET);
}
const coverEnv = { QUIZ_SET_COVER_ENV: "testing", NODE_ENV: "test",
  MONGO_DB: "mongodb+srv://example:example@englishkafe.xhqpzdd.mongodb.net/english_kafe",
  STANDALONE_QUIZ_EXPECTED_DB: "english_kafe", CLOUDINARY_CLOUD_NAME: "du6lhdq8t",
  CLOUDINARY_API_KEY: "mock-key", CLOUDINARY_API_SECRET: "mock-secret" };
const draft = () => ({ title: "Thai greetings", category: "Vocabulary", difficulty: "Beginner",
  standaloneAccess: "students", questions: [{ prompt: "Hello?", options: ["Sawasdee", "Bye"], correctAnswer: 0,
    explanation: "Sawasdee means hello." }] });
const freePort = () => new Promise((resolve, reject) => {
  const socket = net.createServer(); socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => { const selected = socket.address().port;
    socket.close((error) => error ? reject(error) : resolve(selected)); });
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
async function pauseNextSetFence(run) {
  const entered = deferred(); const release = deferred();
  const original = QuizSet.findOneAndUpdate;
  let paused = false;
  QuizSet.findOneAndUpdate = async function pausedFence(...args) {
    const result = await original.apply(this, args);
    if (!paused && args[1]?.$inc?.runtimeFence === 1 && !args[1]?.$inc?.version) {
      paused = true;
      entered.resolve();
      await release.promise;
    }
    return result;
  };
  try { return await run({ entered: entered.promise, release: release.resolve }); }
  finally { release.resolve(); QuizSet.findOneAndUpdate = original; }
}
let mongo; let directory; let server; let base; let oldSecret; let mongoUri; let configuredCloud;

async function activeSet() {
  const set = await sets.createSet({ name: "UAT Set", difficulty: "Beginner" });
  return sets.transitionSet(set._id, 1, "activate");
}
async function published(setId) {
  const created = await sets.createSetDraft(setId, draft());
  return revisions.publishDraft(created._id, 1);
}
async function attachManagedCover(set, { environment = "testing", state = "active", url } = {}) {
  const assetId = id();
  const coverUrl = url || `https://res.cloudinary.com/du6lhdq8t/image/upload/${TESTING_FOLDER}/${assetId}.jpg`;
  const asset = await CoverAsset.create({ _id: assetId, quizSet: set._id, environment,
    publicId: `${TESTING_FOLDER}/${assetId}`, url: coverUrl, state,
    abandonAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  await QuizSet.updateOne({ _id: set._id }, { $set: { coverAsset: assetId, coverImage: coverUrl } });
  return asset;
}
async function request(route, { method = "GET", token, body } = {}) {
  const response = await fetch(`${base}/quizzes${route}`, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  configuredCloud = mock.method(cloudinary, "config", () => ({ cloud_name: "du6lhdq8t" }));
  const mongoPort = await freePort(); const apiPort = await freePort();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-quiz-sets-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(mongoPort), "--dbpath", directory,
    "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(mongoPort);
  mongoUri = `mongodb://127.0.0.1:${mongoPort}/quiz_set_foundation_test?replicaSet=paymentTests`;
  await mongoose.connect(mongoUri,
    { autoIndex: false, autoCreate: false });
  oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = "isolated-quiz-set-test-secret";
  const app = express(); app.use(express.json()); app.use("/quizzes", require("../routes/quiz"));
  server = app.listen(apiPort, "127.0.0.1"); base = `http://127.0.0.1:${apiPort}`;
});
beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  for (const model of [QuizSet, Quiz, QuizSession, QuizAttempt, QuizMedia, QuizCreationRequest, CoverAsset, User]) {
    await model.createCollection(); await model.syncIndexes();
  }
});
after(async () => {
  configuredCloud?.mock.restore();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  await mongoose.disconnect();
  if (mongo && mongo.exitCode === null) await new Promise((resolve) => { mongo.once("exit", resolve); mongo.kill("SIGTERM"); });
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

test("model validates required metadata and starts Disabled", async () => {
  await assert.rejects(sets.createSet({ name: " " }), /Name is required/);
  const set = await sets.createSet({ name: "Beginner Practice" });
  assert.equal(set.status, "disabled"); assert.equal(set.version, 1);
  assert.equal(set.runtimeEpoch, 0);
  await assert.rejects(sets.createSet({ name: "x", difficulty: "Expert" }), /Invalid difficulty/);
});

test("every General Practice discovery and attempt endpoint denies anonymous requests", async () => {
  const quizId = id();
  const attemptId = id();
  const setId = id();
  for (const route of ["/standalone", "/standalone/sets", `/standalone/sets/${setId}`,
    `/standalone/${quizId}`, `/standalone/${quizId}/attempts`, `/standalone/attempts/${attemptId}`]) {
    assert.equal((await request(route)).status, 401, route);
  }
  for (const route of [`/standalone/${quizId}/sessions`, `/standalone/${quizId}/submit`]) {
    assert.equal((await request(route, { method: "POST", body: {} })).status, 401, route);
  }
});

test("authenticated catalog includes empty active sets and excludes disabled/archived sets", async () => {
  const active = await activeSet();
  await sets.createSet({ name: "Hidden Set" });
  const token = await studentToken();
  const result = await request("/standalone/sets", { token });
  assert.equal(result.status, 200); assert.equal(result.body.sets.length, 1);
  assert.equal(result.body.sets[0].id, String(active._id));
  assert.equal("status" in result.body.sets[0], false);
  const detail = await request(`/standalone/sets/${active._id}`, { token });
  assert.equal(detail.status, 200); assert.deepEqual(detail.body.quizzes, []);
});

test("catalog paginates deterministically and filters name and difficulty", async () => {
  const token = await studentToken();
  for (const name of ["Thai A", "Thai B", "Thai C"]) {
    const set = await sets.createSet({ name, difficulty: "Beginner", displayOrder: 1 });
    await sets.transitionSet(set._id, 1, "activate");
  }
  const first = await request("/standalone/sets?limit=2&name=Thai&difficulty=Beginner", { token });
  assert.equal(first.status, 200); assert.equal(first.body.sets.length, 2);
  assert.ok(first.body.nextCursor);
  const second = await request(`/standalone/sets?limit=2&after=${encodeURIComponent(first.body.nextCursor)}`, { token });
  assert.equal(second.status, 200); assert.equal(second.body.sets.length, 1);
  assert.equal(new Set([...first.body.sets, ...second.body.sets].map((set) => set.id)).size, 3);
  assert.equal((await request("/standalone/sets?after=invalid", { token })).status, 400);
});

test("Admin-only APIs require authentication and new drafts require Set assignment", async () => {
  assert.equal((await request("/admin/standalone/sets")).status, 401);
  const user = await User.create({ name: "Student", email: "student@example.test", password: "local-only",
    role: "user", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(user._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  assert.equal((await request("/admin/standalone/sets", { token })).status, 403);
  assert.equal((await request("/admin/standalone", { method: "POST", token,
    body: { draft: draft() } })).status, 403);
  const admin = await User.create({ name: "Admin", email: "admin@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const adminToken = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  assert.equal((await request("/admin/standalone", { method: "POST", token: adminToken,
    body: { draft: draft() } })).body.code, "quiz_set_required");
  const created = await request("/admin/standalone/sets", { method: "POST", token: adminToken,
    body: { name: "Created by Admin" } });
  assert.equal(created.status, 201);
  const setId = created.body.set.id;
  assert.equal(created.body.set.status, "disabled");
  const quiz = await request(`/admin/standalone/sets/${setId}/quizzes`, { method: "POST", token: adminToken,
    body: { creationRequestId: creationId(), draft: draft() } });
  assert.equal(quiz.status, 201);
  assert.equal(quiz.body.quizSetId, setId);
});

test("Set creation requires a canonical v4 request ID and never consumes invalid drafts", async () => {
  const set = await sets.createSet({ name: "Idempotency validation" });
  const admin = await User.create({ name: "Admin", email: "id-validation@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  const route = `/admin/standalone/sets/${set._id}/quizzes`;
  for (const invalid of [undefined, null, "not-a-uuid", creationId().toUpperCase()]) {
    const result = await request(route, { method: "POST", token,
      body: { ...(invalid === undefined ? {} : { creationRequestId: invalid }), draft: draft() } });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "invalid_quiz_creation_request");
  }
  const key = creationId();
  const bad = await request(route, { method: "POST", token,
    body: { creationRequestId: key, draft: { ...draft(), questions: [] } } });
  assert.equal(bad.status, 400);
  assert.equal(await QuizCreationRequest.countDocuments(), 0);
  for (const malformed of [undefined, null, "not-a-draft", { ...draft(), questions: "bad" }]) {
    const response = await request(route, { method: "POST", token,
      body: { creationRequestId: creationId(), ...(malformed === undefined ? {} : { draft: malformed }) } });
    assert.equal(response.status, 400);
  }
  const good = await request(route, { method: "POST", token,
    body: { creationRequestId: key, draft: draft() } });
  assert.equal(good.status, 201);
  assert.equal(await QuizCreationRequest.countDocuments(), 1);
});

test("committed creation replays its original result and rejects changed content", async () => {
  const set = await sets.createSet({ name: "Replay" });
  const admin = await User.create({ name: "Admin", email: "id-replay@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  const route = `/admin/standalone/sets/${set._id}/quizzes`;
  const key = creationId();
  const payload = { creationRequestId: key, draft: draft() };
  const first = await request(route, { method: "POST", token, body: payload });
  assert.equal(first.status, 201);
  assert.equal(first.body.status, "draft");
  assert.equal(first.body.draft.version, 1);
  assert.equal(first.body.quizSetId, String(set._id));
  const replay = await request(route, { method: "POST", token, body: payload });
  assert.equal(replay.status, 201);
  assert.deepEqual(replay.body, first.body);
  const reordered = { ...payload.draft,
    questions: payload.draft.questions.map((question) => Object.fromEntries(Object.entries(question).reverse())) };
  const equivalent = await request(route, { method: "POST", token,
    body: { creationRequestId: key, draft: Object.fromEntries(Object.entries(reordered).reverse()) } });
  assert.equal(equivalent.status, 201);
  assert.deepEqual(equivalent.body, first.body);
  const changed = await request(route, { method: "POST", token,
    body: { creationRequestId: key, draft: { ...draft(), title: "Changed" } } });
  assert.equal(changed.status, 409);
  assert.equal(changed.body.code, "quiz_creation_request_reused");
  for (const malformed of [undefined, null, "not-a-draft", { ...draft(), questions: "bad" },
    { ...draft(), questions: [{}] }, { ...draft(), unsupported: true }]) {
    const response = await request(route, { method: "POST", token,
      body: { creationRequestId: key, ...(malformed === undefined ? {} : { draft: malformed }) } });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "quiz_creation_request_reused");
  }
  const circular = { ...draft() }; circular.self = circular;
  await assert.rejects(sets.createIdempotentSetDraft(set._id, admin._id, key, circular),
    (error) => error.status === 409 && error.code === "quiz_creation_request_reused");
  await assert.rejects(sets.createIdempotentSetDraft(set._id, admin._id, creationId(), circular),
    (error) => error.status === 400 && error.code === "invalid_quiz_draft");
  assert.equal(await Quiz.countDocuments({ quizSet: set._id }), 1);
  assert.equal(await QuizCreationRequest.countDocuments(), 1);
  const distinct = await request(route, { method: "POST", token,
    body: { creationRequestId: creationId(), draft: draft() } });
  assert.equal(distinct.status, 201);
  assert.notEqual(distinct.body.id, first.body.id);
  assert.equal(await Quiz.countDocuments({ quizSet: set._id }), 2);
});

test("concurrent same-key requests create at most one quiz across independent HTTP calls", async () => {
  const set = await sets.createSet({ name: "Concurrent replay" });
  const admin = await User.create({ name: "Admin", email: "id-concurrent@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  const route = `/admin/standalone/sets/${set._id}/quizzes`;
  const payload = { creationRequestId: creationId(), draft: draft() };
  const responses = await Promise.all(Array.from({ length: 3 }, () => request(route, { method: "POST", token, body: payload })));
  assert.ok(responses.every((response) => [201, 503].includes(response.status)));
  assert.equal(await Quiz.countDocuments({ quizSet: set._id }), 1);
  assert.equal(await QuizCreationRequest.countDocuments(), 1);
  const replay = await request(route, { method: "POST", token, body: payload });
  assert.equal(replay.status, 201);
  assert.ok(responses.filter((response) => response.status === 201).every((response) => response.body.id === replay.body.id));
});

test("lost response and an ambiguous committed creation replay from the durable ledger", async () => {
  const set = await sets.createSet({ name: "Ambiguous idempotency" });
  const admin = await User.create({ name: "Admin", email: "id-ambiguous@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  const route = `/admin/standalone/sets/${set._id}/quizzes`;
  const payload = { creationRequestId: creationId(), draft: draft() };
  const original = mongoose.startSession;
  let commits = 0;
  mongoose.startSession = async (...args) => {
    const session = await original.apply(mongoose, args);
    const commit = session.commitTransaction.bind(session);
    session.commitTransaction = async () => {
      await commit(); commits += 1;
      const error = new Error("simulated lost commit acknowledgment");
      error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
      throw error;
    };
    return session;
  };
  let first;
  try { first = await request(route, { method: "POST", token, body: payload }); }
  finally { mongoose.startSession = original; }
  assert.equal(first.status, 201);
  assert.equal(commits, 1);
  // Simulate the client losing the first HTTP response: a fresh request path
  // must reconstruct the result solely from the committed database record.
  const replay = await request(route, { method: "POST", token, body: payload });
  assert.deepEqual(replay.body, first.body);
  assert.equal(await Quiz.countDocuments({ quizSet: set._id }), 1);
});

test("unresolved commit acknowledgment fails closed without a blind second creation", async () => {
  const set = await sets.createSet({ name: "Unresolved creation" });
  const admin = await User.create({ name: "Admin", email: "id-unresolved@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  const original = mongoose.startSession;
  let attempts = 0;
  mongoose.startSession = async (...args) => {
    const session = await original.apply(mongoose, args);
    session.commitTransaction = async () => {
      attempts += 1;
      const error = new Error("simulated unresolved commit");
      error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
      throw error;
    };
    return session;
  };
  try {
    const result = await request(`/admin/standalone/sets/${set._id}/quizzes`, {
      method: "POST", token, body: { creationRequestId: creationId(), draft: draft() },
    });
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "quiz_creation_outcome_unknown");
  } finally { mongoose.startSession = original; }
  assert.equal(attempts, 1);
  assert.equal(await Quiz.countDocuments({ quizSet: set._id }), 0);
  assert.equal(await QuizCreationRequest.countDocuments(), 0);
});

test("creation keys are scoped independently to Admin and Quiz Set", async () => {
  const firstSet = await sets.createSet({ name: "First scope" });
  const secondSet = await sets.createSet({ name: "Second scope" });
  const admins = await User.create([
    { name: "First Admin", email: "id-admin-1@example.test", password: "local-only", role: "admin", isVerified: true, isActive: true },
    { name: "Second Admin", email: "id-admin-2@example.test", password: "local-only", role: "admin", isVerified: true, isActive: true },
  ]);
  const key = creationId();
  const send = (set, admin) => request(`/admin/standalone/sets/${set._id}/quizzes`, {
    method: "POST", token: jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET),
    body: { creationRequestId: key, draft: draft() },
  });
  const first = await send(firstSet, admins[0]);
  const otherSet = await send(secondSet, admins[0]);
  const otherAdmin = await send(firstSet, admins[1]);
  assert.ok([first, otherSet, otherAdmin].every((result) => result.status === 201));
  assert.equal(new Set([first.body.id, otherSet.body.id, otherAdmin.body.id]).size, 3);
  assert.equal(await QuizCreationRequest.countDocuments(), 3);
});

test("replay survives Set lifecycle and later Quiz changes without creating another Quiz", async () => {
  const set = await sets.createSet({ name: "Lifecycle replay" });
  const admin = await User.create({ name: "Admin", email: "id-lifecycle@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  const route = `/admin/standalone/sets/${set._id}/quizzes`;
  const payload = { creationRequestId: creationId(), draft: draft() };
  const first = await request(route, { method: "POST", token, body: payload });
  assert.equal(first.status, 201);
  await Quiz.updateOne({ _id: first.body.id }, { $set: { title: "Later edit" } });
  await sets.transitionSet(set._id, 1, "activate");
  await sets.transitionSet(set._id, 2, "disable");
  assert.deepEqual((await request(route, { method: "POST", token, body: payload })).body, first.body);
  await sets.transitionSet(set._id, 3, "archive");
  const archivedReplay = await request(route, { method: "POST", token, body: payload });
  assert.equal(archivedReplay.status, 201);
  assert.deepEqual(archivedReplay.body, first.body);
  const newKey = await request(route, { method: "POST", token,
    body: { creationRequestId: creationId(), draft: draft() } });
  assert.equal(newKey.status, 404);
  assert.equal(await Quiz.countDocuments({ quizSet: set._id }), 1);
});

test("durable creation rejects permanent Quiz deletion and preserves replay through Archive", async () => {
  const set = await sets.createSet({ name: "Protected Quiz" });
  const admin = await User.create({ name: "Admin", email: "protected-quiz@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  const route = `/admin/standalone/sets/${set._id}/quizzes`;
  const payload = { creationRequestId: creationId(), draft: draft() };
  const created = await request(route, { method: "POST", token, body: payload });
  assert.equal(created.status, 201);
  const ledgerBefore = await QuizCreationRequest.findOne({ quizId: created.body.id }).lean();
  const removed = await request(`/admin/standalone/${created.body.id}`, { method: "DELETE", token });
  assert.equal(removed.status, 409);
  assert.equal(removed.body.code, "quiz_has_creation_request");
  assert.ok(await Quiz.exists({ _id: created.body.id }));
  assert.deepEqual(await QuizCreationRequest.findOne({ quizId: created.body.id }).lean(), ledgerBefore);
  const rejectedSetDeletion = await request(`/admin/standalone/sets/${set._id}`, {
    method: "DELETE", token, body: { expectedVersion: set.version },
  });
  assert.equal(rejectedSetDeletion.status, 409);
  assert.equal(rejectedSetDeletion.body.code, "quiz_set_has_members");
  assert.deepEqual(await QuizCreationRequest.findOne({ quizId: created.body.id }).lean(), ledgerBefore);
  assert.deepEqual((await request(route, { method: "POST", token, body: payload })).body, created.body);
  await revisions.changeAvailability(created.body.id, "archive");
  const replay = await request(route, { method: "POST", token, body: payload });
  assert.equal(replay.status, 201);
  assert.deepEqual(replay.body, created.body);
});

test("durable creation rejects Set deletion even when its Quiz is unexpectedly absent", async () => {
  const set = await sets.createSet({ name: "Protected Set" });
  const admin = id(); const key = creationId();
  const created = await sets.createIdempotentSetDraft(set._id, admin, key, draft());
  const ledgerBefore = await QuizCreationRequest.findOne({ quizId: created.id }).lean();
  // Simulate a pre-existing externally removed Quiz. The application must not
  // delete its Set or mutate the durable ledger to conceal the inconsistency.
  await Quiz.deleteOne({ _id: created.id });
  await assert.rejects(sets.deleteEmptySet(set._id, set.version),
    (error) => error.status === 409 && error.code === "quiz_set_has_creation_requests");
  assert.ok(await QuizSet.exists({ _id: set._id }));
  assert.deepEqual(await QuizCreationRequest.findOne({ quizId: created.id }).lean(), ledgerBefore);
  await assert.rejects(sets.createIdempotentSetDraft(set._id, admin, key, draft()),
    (error) => error.status === 503 && error.code === "quiz_creation_outcome_unknown");
});

test("non-ledger standalone Quiz and empty Set retain their permanent-deletion rules", async () => {
  const set = await sets.createSet({ name: "Legacy deletion" });
  const quiz = await sets.createSetDraft(set._id, draft());
  assert.equal(await QuizCreationRequest.countDocuments({ quizId: quiz._id }), 0);
  assert.deepEqual(await revisions.deleteDraftOrQuiz(quiz._id), { deleted: true });
  assert.deepEqual(await sets.deleteEmptySet(set._id, set.version), { deleted: true });
  const unassigned = await Quiz.create({ title: "Unassigned legacy", contextType: "standalone",
    status: "draft", publishedRevision: null, revision: 1, questions: [] });
  assert.deepEqual(await revisions.deleteDraftOrQuiz(unassigned._id), { deleted: true });
});

test("managed cover deletion queues ownership atomically before provider cleanup", async () => {
  const set = await sets.createSet({ name: "Covered empty Set" });
  const asset = await attachManagedCover(set);
  const destroy = mock.method(cloudinary.uploader, "destroy", async (publicId) => {
    assert.equal(publicId, asset.publicId);
    assert.equal(await QuizSet.exists({ _id: set._id }), null);
    const queued = await CoverAsset.findById(asset._id).lean();
    assert.equal(queued.state, "cleanup_processing");
    assert.equal(queued.cleanupReason, "set_deleted");
    return { result: "ok" };
  });
  try {
    assert.deepEqual(await sets.deleteEmptySet(set._id, set.version, { env: coverEnv }),
      { deleted: true, mediaCleanup: "complete" });
    assert.equal((await CoverAsset.findById(asset._id).lean()).state, "deleted");
    assert.equal(destroy.mock.calls.length, 1);
  } finally { destroy.mock.restore(); }
});

test("failed provider deletion leaves a durable Set-deletion retry record", async () => {
  const set = await sets.createSet({ name: "Cover retry Set" });
  const asset = await attachManagedCover(set);
  const destroy = mock.method(cloudinary.uploader, "destroy", async () => { throw new Error("provider unavailable"); });
  try {
    assert.deepEqual(await sets.deleteEmptySet(set._id, set.version, { env: coverEnv }),
      { deleted: true, mediaCleanup: "retry_required" });
  } finally { destroy.mock.restore(); }
  assert.equal(await QuizSet.exists({ _id: set._id }), null);
  const pending = await CoverAsset.findById(asset._id).lean();
  assert.equal(pending.state, "cleanup_pending");
  assert.equal(pending.cleanupReason, "set_deleted");
  assert.equal(pending.cleanupAttempts, 1);
  const retry = mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));
  try {
    assert.equal((await covers.retryCoverCleanup({ execute: true, env: coverEnv })).deleted, 1);
    assert.equal((await CoverAsset.findById(asset._id).lean()).state, "deleted");
  } finally { retry.mock.restore(); }
});

test("unverified managed ownership aborts both Set deletion and cleanup handoff", async () => {
  const missing = await sets.createSet({ name: "Missing ownership" });
  await QuizSet.updateOne({ _id: missing._id }, { $set: { coverAsset: id(), coverImage: "https://res.cloudinary.com/test/image/upload/missing.jpg" } });
  await assert.rejects(sets.deleteEmptySet(missing._id, missing.version, { env: coverEnv }),
    { code: "quiz_set_cover_unverified" });
  assert.ok(await QuizSet.exists({ _id: missing._id }));

  const foreign = await sets.createSet({ name: "Foreign ownership" });
  const asset = await attachManagedCover(foreign, { environment: "production" });
  await assert.rejects(sets.deleteEmptySet(foreign._id, foreign.version, { env: coverEnv }),
    { code: "quiz_set_cover_unverified" });
  assert.ok(await QuizSet.exists({ _id: foreign._id }));
  assert.equal((await CoverAsset.findById(asset._id).lean()).state, "active");
});

test("a transaction failure after cover handoff rolls back the Set and ownership state", async () => {
  const set = await sets.createSet({ name: "Rollback covered Set" });
  const asset = await attachManagedCover(set);
  const deleteOne = mock.method(QuizSet, "deleteOne", async () => { throw new Error("forced transaction failure"); });
  const destroy = mock.method(cloudinary.uploader, "destroy", async () => { throw new Error("precommit deletion"); });
  try {
    await assert.rejects(sets.deleteEmptySet(set._id, set.version, { env: coverEnv }), /forced transaction failure/);
    assert.ok(await QuizSet.exists({ _id: set._id }));
    assert.equal((await CoverAsset.findById(asset._id).lean()).state, "active");
    assert.equal(destroy.mock.calls.length, 0);
  } finally { deleteOne.mock.restore(); destroy.mock.restore(); }
});

test("legacy URL-only cover is never sent to managed Cloudinary cleanup", async () => {
  const set = await sets.createSet({ name: "Legacy cover Set" });
  await QuizSet.updateOne({ _id: set._id }, { $set: { coverImage: "https://res.cloudinary.com/legacy/image/upload/old.jpg" } });
  const destroy = mock.method(cloudinary.uploader, "destroy", async () => { throw new Error("unverified asset"); });
  try {
    assert.deepEqual(await sets.deleteEmptySet(set._id, set.version, { env: coverEnv }), { deleted: true });
    assert.equal(destroy.mock.calls.length, 0);
  } finally { destroy.mock.restore(); }
});

test("a transformed legacy URL-only reference prevents managed cover deletion", async () => {
  const owned = await sets.createSet({ name: "Managed source" });
  const asset = await attachManagedCover(owned);
  const legacy = await sets.createSet({ name: "Legacy transformed reference" });
  const alternateUrl = asset.url.replace("/image/upload/", "/image/upload/c_fill,w_300/").replace(/\.jpg$/, ".webp");
  await QuizSet.updateOne({ _id: legacy._id }, { $set: { coverImage: alternateUrl } });
  const destroy = mock.method(cloudinary.uploader, "destroy", async () => {
    throw new Error("referenced cover must not be deleted");
  });
  try {
    assert.deepEqual(await sets.deleteEmptySet(owned._id, owned.version, { env: coverEnv }),
      { deleted: true, mediaCleanup: "retry_required" });
    assert.equal((await CoverAsset.findById(asset._id).lean()).state, "cleanup_pending");
    assert.equal((await covers.retryCoverCleanup({ execute: true, env: coverEnv })).deleted, 0);
    assert.equal(destroy.mock.calls.length, 0);
    assert.ok(await QuizSet.exists({ _id: legacy._id }));
  } finally { destroy.mock.restore(); }
});

test("Set deletion wins a concurrent cover removal without losing cleanup accounting", async () => {
  const set = await sets.createSet({ name: "Cover race Set" });
  const asset = await attachManagedCover(set);
  const destroy = mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));
  try {
    await pauseNextSetFence(async ({ entered, release }) => {
      const deleting = sets.deleteEmptySet(set._id, set.version, { env: coverEnv });
      await entered;
      const removing = assert.rejects(covers.removeCover(set._id, set.version, { env: coverEnv }));
      release();
      assert.deepEqual(await deleting, { deleted: true, mediaCleanup: "complete" });
      await removing;
    });
    assert.equal((await CoverAsset.findById(asset._id).lean()).state, "deleted");
  } finally { destroy.mock.restore(); }
});

test("committed creation wins a race with Set deletion without losing its ledger", async () => {
  const set = await sets.createSet({ name: "Creation wins deletion race" });
  const admin = id(); const key = creationId();
  await pauseNextSetFence(async ({ entered, release }) => {
    const creating = sets.createIdempotentSetDraft(set._id, admin, key, draft());
    await entered;
    const deleting = sets.deleteEmptySet(set._id, set.version);
    release();
    const created = await creating;
    await assert.rejects(deleting, (error) => error.status === 409);
    assert.ok(await Quiz.exists({ _id: created.id }));
    assert.ok(await QuizCreationRequest.exists({ quizId: created.id }));
    assert.deepEqual(await sets.createIdempotentSetDraft(set._id, admin, key, draft()), created);
  });
});

test("Set deletion wins a race with creation without leaving a Quiz or ledger", async () => {
  const set = await sets.createSet({ name: "Deletion wins creation race" });
  const admin = id();
  await pauseNextSetFence(async ({ entered, release }) => {
    const deleting = sets.deleteEmptySet(set._id, set.version);
    await entered;
    const creating = sets.createIdempotentSetDraft(set._id, admin, creationId(), draft());
    release();
    assert.deepEqual(await deleting, { deleted: true });
    await assert.rejects(creating, (error) => [404, 503].includes(error.status));
  });
  assert.equal(await Quiz.countDocuments({ quizSet: set._id }), 0);
  assert.equal(await QuizCreationRequest.countDocuments({ quizSetId: set._id }), 0);
});

test("creation and Quiz deletion overlap without deleting a committed ledger-backed Quiz", async () => {
  const set = await sets.createSet({ name: "Quiz deletion race" });
  const admin = id(); const key = creationId();
  const entered = deferred(); const release = deferred();
  const original = QuizCreationRequest.create;
  let newQuizId;
  QuizCreationRequest.create = async function pauseLedger(documents, options) {
    const result = await original.call(this, documents, options);
    newQuizId = documents[0].quizId;
    entered.resolve();
    await release.promise;
    return result;
  };
  try {
    const creating = sets.createIdempotentSetDraft(set._id, admin, key, draft());
    await entered.promise;
    await assert.rejects(revisions.deleteDraftOrQuiz(newQuizId),
      (error) => error.status === 404 && error.code === "quiz_unavailable");
    release.resolve();
    const created = await creating;
    await assert.rejects(revisions.deleteDraftOrQuiz(created.id),
      (error) => error.status === 409 && error.code === "quiz_has_creation_request");
    assert.deepEqual(await sets.createIdempotentSetDraft(set._id, admin, key, draft()), created);
  } finally { release.resolve(); QuizCreationRequest.create = original; }
});

test("transient deletion write conflict retries and still preserves creation replay", async () => {
  const set = await sets.createSet({ name: "Deletion retry" });
  const admin = id(); const key = creationId();
  const created = await sets.createIdempotentSetDraft(set._id, admin, key, draft());
  const original = QuizCreationRequest.exists;
  let checks = 0;
  QuizCreationRequest.exists = function retryOnce(...args) {
    checks += 1;
    if (checks === 1) {
      const error = new Error("simulated write conflict"); error.code = 112;
      throw error;
    }
    return original.apply(this, args);
  };
  try {
    await assert.rejects(revisions.deleteDraftOrQuiz(created.id),
      (error) => error.status === 409 && error.code === "quiz_has_creation_request");
  } finally { QuizCreationRequest.exists = original; }
  assert.equal(checks, 2);
  assert.deepEqual(await sets.createIdempotentSetDraft(set._id, admin, key, draft()), created);
});

test("exhausted Set deletion write conflicts leave the Set intact", async () => {
  const set = await sets.createSet({ name: "Deletion retry exhaustion" });
  const original = QuizSet.findOneAndUpdate;
  let attempts = 0;
  QuizSet.findOneAndUpdate = function failDeletionFence(...args) {
    if (args[1]?.$inc?.runtimeFence === 1) {
      attempts += 1;
      const error = new Error("simulated write conflict"); error.code = 112;
      throw error;
    }
    return original.apply(this, args);
  };
  try {
    await assert.rejects(sets.deleteEmptySet(set._id, set.version),
      (error) => error.status === 409 && error.code === "standalone_transaction_conflict");
  } finally { QuizSet.findOneAndUpdate = original; }
  assert.equal(attempts, 4);
  assert.ok(await QuizSet.exists({ _id: set._id }));
});

test("missing or nonunique ledger index blocks creation without modifying data", async () => {
  const set = await sets.createSet({ name: "Index readiness" });
  const admin = await User.create({ name: "Admin", email: "id-index@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  const route = `/admin/standalone/sets/${set._id}/quizzes`;
  const payload = { creationRequestId: creationId(), draft: draft() };
  await mongoose.connection.db.collection("quizcreationrequests").dropIndex("one_set_quiz_creation_request");
  let result = await request(route, { method: "POST", token, body: payload });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "quiz_creation_unavailable");
  await mongoose.connection.db.collection("quizcreationrequests").createIndex(
    { adminId: 1, quizSetId: 1, creationRequestId: 1 }, { name: "one_set_quiz_creation_request" });
  result = await request(route, { method: "POST", token, body: payload });
  assert.equal(result.status, 503);
  assert.equal(await Quiz.countDocuments(), 0);
  assert.equal(await QuizCreationRequest.countDocuments(), 0);
});

test("Admin quiz details expose persisted Set membership and legacy null without changing other fields", async () => {
  const set = await sets.createSet({ name: "Admin membership" });
  const quiz = await sets.createSetDraft(set._id, draft());
  const admin = await User.create({ name: "Admin", email: "id-detail@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  const route = `/admin/standalone/${quiz._id}`;
  const original = await request(route, { token });
  assert.equal(original.status, 200);
  assert.equal(original.body.quizSetId, String(set._id));
  assert.equal(original.body.contextType, "standalone");
  assert.equal(original.body.status, "draft");
  assert.ok(original.body.draft);
  await sets.transitionSet(set._id, 1, "activate");
  await sets.transitionSet(set._id, 2, "disable");
  assert.equal((await request(route, { token })).body.quizSetId, String(set._id));
  await sets.transitionSet(set._id, 3, "archive");
  assert.equal((await request(route, { token })).body.quizSetId, String(set._id));
  const legacy = await Quiz.create({ title: "Legacy", contextType: "standalone", status: "draft",
    publishedRevision: null, revision: 1, questions: [] });
  assert.equal((await request(`/admin/standalone/${legacy._id}`, { token })).body.quizSetId, null);
});

test("direct draft creation requires an existing Set and cannot bypass membership", async () => {
  const beforeCount = await Quiz.countDocuments();
  for (const quizSet of [undefined, null, "not-an-id", id()]) {
    await assert.rejects(revisions.createDraft(draft(), { quizSet }),
      (error) => error.status === 404 && error.code === "quiz_set_unavailable");
  }
  await assert.rejects(revisions.createDraft({ ...draft(), quizSet: id() }, { quizSet: id() }),
    (error) => error.status === 404 || error.code === "invalid_quiz_draft");
  assert.equal(await Quiz.countDocuments(), beforeCount);
  const set = await sets.createSet({ name: "Direct service creation" });
  await assert.rejects(revisions.createDraft({ ...draft(), quizSet: id() }, { quizSet: set._id }),
    (error) => error.status === 400 && error.code === "invalid_quiz_draft");
  const created = await revisions.createDraft(draft(), { quizSet: set._id });
  assert.equal(String(created.quizSet), String(set._id));
  assert.equal(await Quiz.countDocuments(), beforeCount + 1);
});

test("malformed Set draft questions return structured HTTP 400", async () => {
  const set = await sets.createSet({ name: "Validation" });
  const admin = await User.create({ name: "Admin", email: "validation-admin@example.test", password: "local-only",
    role: "admin", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  for (const questions of [undefined, null, {}, "bad", [], [{}]]) {
    const payload = draft();
    if (questions === undefined) delete payload.questions; else payload.questions = questions;
    const result = await request(`/admin/standalone/sets/${set._id}/quizzes`, { method: "POST", token,
      body: { creationRequestId: creationId(), draft: payload } });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "invalid_quiz_draft");
  }
  assert.equal(await Quiz.countDocuments(), 0);
});

test("new Set quiz starts Draft, cannot move Sets, and student catalog excludes answers", async () => {
  const set = await activeSet(); const other = await activeSet();
  const token = await studentToken();
  const created = await sets.createSetDraft(set._id, draft());
  assert.equal(created.status, "draft"); assert.equal(String(created.quizSet), String(set._id));
  assert.equal((await request(`/standalone/sets/${set._id}`, { token })).body.quizzes.length, 0);
  created.quizSet = other._id;
  await created.save();
  assert.equal(String((await Quiz.findById(created._id)).quizSet), String(set._id));
  await revisions.publishDraft(created._id, 1);
  const response = await request(`/standalone/sets/${set._id}`, { token });
  assert.equal(response.body.quizzes.length, 1);
  assert.equal(JSON.stringify(response.body).includes("correctAnswer"), false);
  assert.equal(JSON.stringify(response.body).includes("explanation"), false);
});

test("Set discovery requires authentication and safely includes legacy Public records", async () => {
  const set = await activeSet();
  const token = await studentToken();
  const publicDraft = await sets.createSetDraft(set._id, { ...draft(), title: "Legacy greetings" });
  const publicQuiz = await revisions.publishDraft(publicDraft._id, 1);
  await Quiz.updateOne({ _id: publicQuiz._id }, { $set: { standaloneAccess: "public" } });
  const studentsDraft = await sets.createSetDraft(set._id,
    { ...draft(), title: "Student greetings", standaloneAccess: "students" });
  const studentsQuiz = await revisions.publishDraft(studentsDraft._id, 1);
  await sets.createSetDraft(set._id, { ...draft(), title: "Unpublished greetings" });
  const disabledDraft = await sets.createSetDraft(set._id, { ...draft(), title: "Disabled greetings" });
  await revisions.publishDraft(disabledDraft._id, 1);
  await revisions.changeAvailability(disabledDraft._id, "disable");
  const archivedDraft = await sets.createSetDraft(set._id, { ...draft(), title: "Archived greetings" });
  await revisions.publishDraft(archivedDraft._id, 1);
  await revisions.changeAvailability(archivedDraft._id, "archive");
  const publicOrder = await sets.orderQuiz(set._id, publicQuiz._id, set.version, 5);
  await sets.orderQuiz(set._id, studentsQuiz._id, publicOrder.setVersion, 2);

  const guest = await request(`/standalone/sets/${set._id}`);
  assert.equal(guest.status, 401);
  const signedIn = await request(`/standalone/sets/${set._id}`, { token });
  for (const response of [signedIn]) {
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.quizzes.map((quiz) => quiz.id),
      [String(studentsQuiz._id), String(publicQuiz._id)]);
    assert.deepEqual(response.body.quizzes.map((quiz) => quiz.standaloneAccess), ["students", "public"]);
    assert.deepEqual(response.body.quizzes.map((quiz) => quiz.sortOrder), [2, 5]);
    assert.ok(response.body.quizzes.every((quiz) =>
      Object.keys(quiz).every((key) => ["id", "title", "description", "category", "difficulty",
        "standaloneAccess", "revision", "sortOrder"].includes(key))));
    const serialized = JSON.stringify(response.body);
    for (const protectedText of ["correctAnswer", "explanation", "questions", "Hello?", "Sawasdee means hello.",
      "Unpublished greetings", "Disabled greetings", "Archived greetings"]) {
      assert.equal(serialized.includes(protectedText), false);
    }
  }
  assert.equal((await request(`/standalone/${publicQuiz._id}`)).status, 401);
  assert.equal((await request(`/standalone/${studentsQuiz._id}`)).status, 401);
  assert.equal((await request(`/standalone/${publicQuiz._id}`, { token })).status, 200);
  assert.equal((await request(`/standalone/${studentsQuiz._id}`, { token })).status, 200);
  assert.equal((await request(`/standalone/${studentsQuiz._id}/sessions`, { method: "POST", body: {} })).status, 401);
  assert.equal((await request(`/standalone/${studentsQuiz._id}/sessions`, { method: "POST", token: "invalid", body: {} })).status, 401);
  assert.equal((await request("/standalone")).status, 401);
  assert.equal((await request("/standalone/sets")).status, 401);
  assert.equal((await fetch(`${base}/quizzes/standalone/guest/attempts/${id()}`)).status, 404);
  assert.equal((await fetch(`${base}/quizzes/standalone/${publicQuiz._id}/guest/sessions`, { method: "POST" })).status, 404);
});

test("disabled and archived Sets hide authenticated discovery and direct quiz details", async () => {
  const set = await activeSet();
  const quiz = await published(set._id);
  const token = await studentToken();
  const disabled = await sets.transitionSet(set._id, set.version, "disable");
  assert.equal((await request(`/standalone/sets/${set._id}`, { token })).status, 404);
  assert.equal((await request(`/standalone/${quiz._id}`, { token })).status, 404);
  await sets.transitionSet(set._id, disabled.version, "archive");
  assert.equal((await request(`/standalone/sets/${set._id}`, { token })).status, 404);
  assert.equal((await request(`/standalone/${quiz._id}`, { token })).status, 404);
});

test("Set lifecycle uses CAS and rejects invalid transitions", async () => {
  const set = await sets.createSet({ name: "Lifecycle" });
  await assert.rejects(sets.transitionSet(set._id, 1, "disable"), /not allowed/);
  const active = await sets.transitionSet(set._id, 1, "activate");
  await assert.rejects(sets.transitionSet(set._id, 1, "archive"), /changed/);
  const disabled = await sets.transitionSet(set._id, active.version, "disable");
  assert.equal(disabled.runtimeEpoch, 1);
  const archived = await sets.transitionSet(set._id, disabled.version, "archive");
  assert.equal(archived.runtimeEpoch, 2);
  const restored = await sets.transitionSet(set._id, archived.version, "restore");
  assert.equal(restored.status, "disabled");
});

test("metadata and quiz order require current Set version", async () => {
  const set = await sets.createSet({ name: "Order" });
  const quiz = await sets.createSetDraft(set._id, draft());
  const changed = await sets.updateSet(set._id, 1, { description: "New description" });
  await assert.rejects(sets.updateSet(set._id, 1, { name: "Stale" }), /changed/);
  const ordered = await sets.orderQuiz(set._id, quiz._id, changed.version, 4);
  assert.equal(ordered.quiz.sortOrder, 4);
  assert.equal(ordered.setVersion, changed.version + 1);
  await assert.rejects(sets.orderQuiz(set._id, quiz._id, changed.version, 5), /changed/);
  assert.equal((await Quiz.findById(quiz._id)).sortOrder, 4);
});

test("ordering API returns its committed version even if a newer Admin update follows", async () => {
  const set = await sets.createSet({ name: "Order race" });
  const quiz = await sets.createSetDraft(set._id, draft());
  const original = sets.orderQuiz;
  sets.orderQuiz = async (...args) => {
    const result = await original(...args);
    await sets.updateSet(set._id, result.setVersion, { description: "Later Admin edit" });
    return result;
  };
  try {
    const admin = await User.create({ name: "Admin", email: "order-admin@example.test", password: "local-only",
      role: "admin", isVerified: true, isActive: true });
    const token = jwt.sign({ id: String(admin._id), sessionVersion: 0 }, process.env.JWT_SECRET);
    const result = await request(`/admin/standalone/sets/${set._id}/quizzes/${quiz._id}/order`,
      { method: "PUT", token, body: { expectedVersion: 1, sortOrder: 5 } });
    assert.equal(result.status, 200);
    assert.equal(result.body.setVersion, 2);
    assert.equal((await QuizSet.findById(set._id)).version, 3);
  } finally { sets.orderQuiz = original; }
});

test("disabling Set prevents starts and invalidates old sessions across reactivation", async () => {
  const set = await activeSet(); const quiz = await published(set._id); const student = learner();
  const old = await start({ quizId: quiz._id, user: student });
  const disabled = await sets.transitionSet(set._id, set.version, "disable");
  await assert.rejects(start({ quizId: quiz._id, user: student }), /unavailable/i);
  await assert.rejects(submit({ quizId: quiz._id, sessionId: old.sessionId, user: student,
    submittedRevision: old.revision, answers: [0] }));
  await sets.transitionSet(set._id, disabled.version, "activate");
  const fresh = await start({ quizId: quiz._id, user: student });
  assert.notEqual(fresh.sessionId, old.sessionId);
  assert.equal((await QuizSession.findById(old.sessionId)).activeSlot, false);
});

test("completed attempts replay after Set disable, while unfinished submissions do not", async () => {
  const set = await activeSet(); const quiz = await published(set._id); const student = learner();
  const session = await start({ quizId: quiz._id, user: student });
  const saved = await submit({ quizId: quiz._id, sessionId: session.sessionId, user: student,
    submittedRevision: session.revision, answers: [0] });
  await sets.transitionSet(set._id, set.version, "disable");
  const replay = await submit({ quizId: quiz._id, sessionId: session.sessionId, user: student,
    submittedRevision: session.revision, answers: [1] });
  assert.equal(replay.attemptId, saved.attemptId);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 1);
});

test("concurrent start and disable cannot leave a valid old-epoch session", async () => {
  const set = await activeSet(); const quiz = await published(set._id); const student = learner();
  await Promise.allSettled([
    start({ quizId: quiz._id, user: student }),
    sets.transitionSet(set._id, set.version, "disable"),
  ]);
  const current = await QuizSet.findById(set._id);
  assert.equal(current.status, "disabled");
  assert.equal(await QuizSession.countDocuments({ quiz: quiz._id, user: student.id,
    setEpoch: current.runtimeEpoch, activeSlot: true }), 0);
  await assert.rejects(start({ quizId: quiz._id, user: student }));
});

test("start fenced before Set disable commits, then old session is invalidated", async () => {
  const set = await activeSet(); const quiz = await published(set._id); const student = learner();
  await pauseNextSetFence(async ({ entered, release }) => {
    const starting = start({ quizId: quiz._id, user: student });
    await entered;
    const disabling = sets.transitionSet(set._id, set.version, "disable");
    release();
    const [session, disabled] = await Promise.all([starting, disabling]);
    assert.equal(disabled.status, "disabled");
    assert.ok(session.sessionId);
    await assert.rejects(submit({ quizId: quiz._id, sessionId: session.sessionId, user: student,
      submittedRevision: session.revision, answers: [0] }));
  });
});

test("Set disable before start rejects the start; reactivation gives a fresh epoch", async () => {
  const set = await activeSet(); const quiz = await published(set._id); const student = learner();
  const prior = await start({ quizId: quiz._id, user: student });
  const disabled = await sets.transitionSet(set._id, set.version, "disable");
  await assert.rejects(start({ quizId: quiz._id, user: student }));
  await sets.transitionSet(set._id, disabled.version, "activate");
  const fresh = await start({ quizId: quiz._id, user: student });
  assert.notEqual(fresh.sessionId, prior.sessionId);
  assert.equal(await QuizSession.countDocuments({ quiz: quiz._id, user: student.id, activeSlot: true }), 1);
});

test("concurrent submission and archive either commits first or is rejected", async () => {
  const set = await activeSet(); const quiz = await published(set._id); const student = learner();
  const session = await start({ quizId: quiz._id, user: student });
  const outcomes = await Promise.allSettled([
    submit({ quizId: quiz._id, sessionId: session.sessionId, user: student,
      submittedRevision: session.revision, answers: [0] }),
    sets.transitionSet(set._id, set.version, "archive"),
  ]);
  assert.equal((await QuizSet.findById(set._id)).status, "archived");
  const attempts = await QuizAttempt.find({ quiz: quiz._id, user: student.id });
  assert.ok(attempts.length <= 1);
  if (attempts.length) {
    assert.equal(outcomes[0].status, "fulfilled");
    const replay = await submit({ quizId: quiz._id, sessionId: session.sessionId,
      user: student, submittedRevision: session.revision, answers: [1] });
    assert.equal(replay.attemptId, String(attempts[0]._id));
  }
});

test("submission fenced before Set archive saves one replayable attempt", async () => {
  const set = await activeSet(); const quiz = await published(set._id); const student = learner();
  const session = await start({ quizId: quiz._id, user: student });
  await pauseNextSetFence(async ({ entered, release }) => {
    const submitting = submit({ quizId: quiz._id, sessionId: session.sessionId, user: student,
      submittedRevision: session.revision, answers: [0] });
    await entered;
    const archiving = sets.transitionSet(set._id, set.version, "archive");
    release();
    const [saved, archived] = await Promise.all([submitting, archiving]);
    assert.equal(archived.status, "archived");
    assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id, user: student.id }), 1);
    const replay = await submit({ quizId: quiz._id, sessionId: session.sessionId, user: student,
      submittedRevision: session.revision, answers: [1] });
    assert.equal(replay.attemptId, saved.attemptId);
  });
});

test("Set archive before submission rejects unfinished work without an attempt", async () => {
  const set = await activeSet(); const quiz = await published(set._id); const student = learner();
  const session = await start({ quizId: quiz._id, user: student });
  await sets.transitionSet(set._id, set.version, "archive");
  await assert.rejects(submit({ quizId: quiz._id, sessionId: session.sessionId, user: student,
    submittedRevision: session.revision, answers: [0] }));
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 0);
});

test("transient Set fence failures exhaust bounded retries without creating a quiz", async () => {
  const set = await sets.createSet({ name: "Retry exhaustion" });
  const original = QuizSet.findOneAndUpdate;
  let attempts = 0;
  QuizSet.findOneAndUpdate = async function failFence(...args) {
    if (args[1]?.$inc?.runtimeFence === 1) {
      attempts += 1;
      const error = new Error("test write conflict"); error.code = 112; throw error;
    }
    return original.apply(this, args);
  };
  try {
    await assert.rejects(sets.createSetDraft(set._id, draft()),
      (error) => error.status === 409 && error.code === "standalone_transaction_conflict");
  } finally { QuizSet.findOneAndUpdate = original; }
  assert.equal(attempts, 4);
  assert.equal(await Quiz.countDocuments({ quizSet: set._id }), 0);
});

test("ambiguous committed Set draft resolves by its persisted identity without replay", async () => {
  const set = await sets.createSet({ name: "Ambiguous commit" });
  const original = mongoose.startSession;
  let commits = 0;
  mongoose.startSession = async (...args) => {
    const session = await original.apply(mongoose, args);
    const commit = session.commitTransaction.bind(session);
    session.commitTransaction = async () => {
      await commit(); commits += 1;
      const error = new Error("simulated uncertain acknowledgment");
      error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
      throw error;
    };
    return session;
  };
  try {
    const created = await sets.createSetDraft(set._id, draft());
    assert.equal(String(created.quizSet), String(set._id));
  } finally { mongoose.startSession = original; }
  assert.equal(commits, 1);
  assert.equal(await Quiz.countDocuments({ quizSet: set._id }), 1);
});

test("Set deletion fails closed when active or populated, but allows empty Disabled Set", async () => {
  const set = await activeSet();
  await assert.rejects(sets.deleteEmptySet(set._id, set.version), /Disable the Set/);
  const quiz = await sets.createSetDraft(set._id, draft());
  const disabled = await sets.transitionSet(set._id, set.version, "disable");
  await assert.rejects(sets.deleteEmptySet(set._id, disabled.version), /cannot be deleted safely/);
  assert.ok(await Quiz.exists({ _id: quiz._id }));
  const empty = await sets.createSet({ name: "Empty" });
  assert.deepEqual(await sets.deleteEmptySet(empty._id, 1), { deleted: true });
});

test("empty Set deletion racing with fenced creation cannot leave an orphan", async () => {
  const set = await sets.createSet({ name: "Create wins" });
  await pauseNextSetFence(async ({ entered, release }) => {
    const creating = sets.createSetDraft(set._id, draft());
    await entered;
    const deleting = sets.deleteEmptySet(set._id, set.version);
    release();
    const created = await creating;
    await assert.rejects(deleting);
    assert.ok(await QuizSet.exists({ _id: set._id }));
    assert.ok(await Quiz.exists({ _id: created._id, quizSet: set._id }));
  });
  const deleteFirst = await sets.createSet({ name: "Delete wins" });
  await sets.deleteEmptySet(deleteFirst._id, deleteFirst.version);
  await assert.rejects(sets.createSetDraft(deleteFirst._id, draft()));
  assert.equal(await Quiz.countDocuments({ quizSet: deleteFirst._id }), 0);
});

test("read-only index preflight reports authoritative Set indexes", async () => {
  assert.equal(REQUIRED.quizsets.length, 2);
  const ready = await inspect(mongoose.connection.db);
  assert.equal(ready.status, "INDEXES_READY");
  await mongoose.connection.db.collection("quizsets").dropIndex("quiz_set_catalog");
  const missing = await inspect(mongoose.connection.db);
  assert.equal(missing.status, "INDEXES_MISSING");
});

test("membership preflight blocks legacy, malformed, orphaned and cross-context records without repair", async () => {
  const collection = mongoose.connection.db.collection("quizzes");
  const legacyId = id();
  await collection.insertOne({ _id: legacyId, contextType: "standalone" });
  let result = await inspect(mongoose.connection.db);
  assert.equal(result.status, "LEGACY_MEMBERSHIP_REVIEW_REQUIRED");
  assert.equal(result.membership.missing, 1);
  const cliEnv = { ...process.env, MONGO_DB: mongoUri, QUIZ_INDEX_EXPECTED_DB: "quiz_set_foundation_test" };
  const cliPath = path.join(__dirname, "../scripts/preflightQuizSetIndexes.js");
  const legacyCli = spawnSync(process.execPath, [cliPath, "--preflight"],
    { cwd: path.join(__dirname, ".."), env: cliEnv, encoding: "utf8" });
  assert.equal(legacyCli.status, 1);
  assert.equal(JSON.parse(legacyCli.stdout.trim().split(/\r?\n/).at(-1)).status,
    "LEGACY_MEMBERSHIP_REVIEW_REQUIRED");
  const set = await sets.createSet({ name: "Integrity" });
  const malformedId = id(); const orphanId = id(); const courseId = id();
  const orderId = id(); const ownershipId = id();
  await collection.insertMany([
    { _id: malformedId, contextType: "standalone", quizSet: "not-an-object-id" },
    { _id: orphanId, contextType: "standalone", quizSet: id() },
    { _id: courseId, contextType: "course_final", quizSet: id() },
    { _id: orderId, contextType: "standalone", quizSet: set._id, sortOrder: 0 },
    { _id: ownershipId, contextType: "standalone", quizSet: set._id, sortOrder: 1, course: id() },
  ]);
  result = await inspect(mongoose.connection.db);
  assert.equal(result.status, "MEMBERSHIP_INTEGRITY_BLOCKED");
  assert.deepEqual([result.membership.missing, result.membership.malformed,
    result.membership.orphaned, result.membership.nonStandalone,
    result.membership.invalidSortOrder, result.membership.mixedOwnership], [1, 1, 1, 1, 1, 1]);
  const cli = spawnSync(process.execPath, [cliPath, "--preflight"],
    { cwd: path.join(__dirname, ".."), env: cliEnv, encoding: "utf8" });
  assert.equal(cli.status, 1);
  assert.equal(JSON.parse(cli.stdout.trim().split(/\r?\n/).at(-1)).status, "MEMBERSHIP_INTEGRITY_BLOCKED");
  assert.equal(await collection.countDocuments({ _id: { $in: [legacyId, malformedId, orphanId, courseId,
    orderId, ownershipId] } }), 6);
});
