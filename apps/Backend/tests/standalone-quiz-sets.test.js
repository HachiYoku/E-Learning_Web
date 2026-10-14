const assert = require("node:assert/strict");
const { before, beforeEach, after, test } = require("node:test");
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
const User = require("../models/userModel");
const sets = require("../services/standaloneQuizSets");
const revisions = require("../services/standaloneQuizRevisions");
const { startOrResumeStandaloneQuizSession: start } = require("../services/standaloneQuizSessionService");
const { submitStandaloneQuiz: submit } = require("../services/standaloneQuizSubmissionService");
const { REQUIRED, inspect } = require("../scripts/preflightQuizSetIndexes");

const id = () => new mongoose.Types.ObjectId();
const learner = () => ({ id: id(), role: "user" });
const draft = () => ({ title: "Thai greetings", category: "Vocabulary", difficulty: "Beginner",
  standaloneAccess: "public", questions: [{ prompt: "Hello?", options: ["Sawasdee", "Bye"], correctAnswer: 0,
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
let mongo; let directory; let server; let base; let oldSecret; let mongoUri;

async function activeSet() {
  const set = await sets.createSet({ name: "UAT Set", difficulty: "Beginner" });
  return sets.transitionSet(set._id, 1, "activate");
}
async function published(setId) {
  const created = await sets.createSetDraft(setId, draft());
  return revisions.publishDraft(created._id, 1);
}
async function request(route, { method = "GET", token, body } = {}) {
  const response = await fetch(`${base}/quizzes${route}`, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

before(async () => {
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
  for (const model of [QuizSet, Quiz, QuizSession, QuizAttempt, QuizMedia, User]) {
    await model.createCollection(); await model.syncIndexes();
  }
});
after(async () => {
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

test("public catalog includes empty active sets and excludes disabled/archived sets", async () => {
  const active = await activeSet();
  await sets.createSet({ name: "Hidden Set" });
  const result = await request("/standalone/sets");
  assert.equal(result.status, 200); assert.equal(result.body.sets.length, 1);
  assert.equal(result.body.sets[0].id, String(active._id));
  assert.equal("status" in result.body.sets[0], false);
  const detail = await request(`/standalone/sets/${active._id}`);
  assert.equal(detail.status, 200); assert.deepEqual(detail.body.quizzes, []);
});

test("catalog paginates deterministically and filters name and difficulty", async () => {
  for (const name of ["Thai A", "Thai B", "Thai C"]) {
    const set = await sets.createSet({ name, difficulty: "Beginner", displayOrder: 1 });
    await sets.transitionSet(set._id, 1, "activate");
  }
  const first = await request("/standalone/sets?limit=2&name=Thai&difficulty=Beginner");
  assert.equal(first.status, 200); assert.equal(first.body.sets.length, 2);
  assert.ok(first.body.nextCursor);
  const second = await request(`/standalone/sets?limit=2&after=${encodeURIComponent(first.body.nextCursor)}`);
  assert.equal(second.status, 200); assert.equal(second.body.sets.length, 1);
  assert.equal(new Set([...first.body.sets, ...second.body.sets].map((set) => set.id)).size, 3);
  assert.equal((await request("/standalone/sets?after=invalid")).status, 400);
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
    body: { draft: draft() } });
  assert.equal(quiz.status, 201);
  assert.equal(quiz.body.quizSetId, setId);
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
      body: { draft: payload } });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "invalid_quiz_draft");
  }
  assert.equal(await Quiz.countDocuments(), 0);
});

test("new Set quiz starts Draft, cannot move Sets, and public data excludes answers", async () => {
  const set = await activeSet(); const other = await activeSet();
  const created = await sets.createSetDraft(set._id, draft());
  assert.equal(created.status, "draft"); assert.equal(String(created.quizSet), String(set._id));
  assert.equal((await request(`/standalone/sets/${set._id}`)).body.quizzes.length, 0);
  created.quizSet = other._id;
  await created.save();
  assert.equal(String((await Quiz.findById(created._id)).quizSet), String(set._id));
  await revisions.publishDraft(created._id, 1);
  const response = await request(`/standalone/sets/${set._id}`);
  assert.equal(response.body.quizzes.length, 1);
  assert.equal(JSON.stringify(response.body).includes("correctAnswer"), false);
  assert.equal(JSON.stringify(response.body).includes("explanation"), false);
});

test("Students Only quizzes are absent from guest Set detail and disabled Sets hide direct quiz discovery", async () => {
  const set = await activeSet();
  const student = await User.create({ name: "Learner", email: "learner@example.test", password: "local-only",
    role: "user", isVerified: true, isActive: true });
  const token = jwt.sign({ id: String(student._id), sessionVersion: 0 }, process.env.JWT_SECRET);
  const fields = { ...draft(), standaloneAccess: "students" };
  const created = await sets.createSetDraft(set._id, fields);
  const quiz = await revisions.publishDraft(created._id, 1);
  assert.equal((await request(`/standalone/sets/${set._id}`)).body.quizzes.length, 0);
  assert.equal((await request(`/standalone/sets/${set._id}`, { token })).body.quizzes.length, 1);
  assert.equal((await request(`/standalone/${quiz._id}`, { token })).status, 200);
  await sets.transitionSet(set._id, set.version, "disable");
  assert.equal((await request(`/standalone/${quiz._id}`, { token })).status, 404);
  assert.equal((await request(`/standalone/sets/${set._id}`)).status, 404);
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
