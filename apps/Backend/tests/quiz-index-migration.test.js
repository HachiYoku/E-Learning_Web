const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const { INDEXES, LEGACY_QUIZ_INDEXES, parseMode, resolveDatabase, inspect, apply, sameDefinition } = require("../scripts/prepareQuizIndexes");
const standalonePreflight = require("../scripts/preflightStandaloneQuizIndexes");

const modelPaths = {
  quizzes: "quizModel", quizattempts: "quizAttemptModel", homeworksets: "homeworkSetModel",
  homeworksetassignments: "homeworkSetAssignmentModel", quizunlocks: "quizUnlockModel",
  quizgoalachievements: "quizGoalAchievementModel", quizattemptgrants: "quizAttemptGrantModel",
  quizattemptrequests: "quizAttemptRequestModel", quizsessions: "quizSessionModel", quizmedias: "quizMediaModel",
  quizratewindows: "quizRateWindowModel",
};

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close((error) => error ? reject(error) : resolve(port));
  });
});

let mongo; let directory; let db; let models; let mongoPort;
before(async () => {
  const port = await freePort();
  mongoPort = port;
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-quiz-index-migration-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => {
      if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); }
    });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/quiz_index_migration_test?replicaSet=paymentTests`);
  db = mongoose.connection.db;
  models = Object.fromEntries(Object.entries(modelPaths).map(([name, modelPath]) => [name, require(`../models/${modelPath}`)]));
  await Promise.all(Object.values(models).map((Model) => Model.init()));
});

beforeEach(async () => { await db.dropDatabase(); });

after(async () => {
  await mongoose.disconnect();
  if (mongo && mongo.exitCode === null) {
    await new Promise((resolve) => { mongo.once("exit", resolve); mongo.kill("SIGTERM"); });
  }
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

async function legacyState() {
  await db.createCollection("quizzes");
  await db.createCollection("quizattempts");
  for (const spec of [...INDEXES.quizzes.slice(0, 2), INDEXES.quizzes[5], ...LEGACY_QUIZ_INDEXES]) {
    await db.collection("quizzes").createIndex(spec.key, { ...spec.options, name: spec.name });
  }
  for (const spec of INDEXES.quizattempts) {
    await db.collection("quizattempts").createIndex(spec.key, { ...spec.options, name: spec.name });
  }
}

test("migration manifest stays aligned with the current Mongoose schemas", () => {
  for (const [collection, Model] of Object.entries(models)) {
    assert.equal(Model.collection.name, collection);
    const actual = Model.schema.indexes().map(([key, options]) => ({ key, options, name: options.name || Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_") }));
    assert.equal(actual.length, INDEXES[collection].length, `${collection} index count`);
    for (const expected of INDEXES[collection]) {
      assert.ok(actual.some((candidate) => sameDefinition({ ...candidate.options, key: candidate.key, name: candidate.name }, expected)), `${collection}.${expected.name}`);
    }
  }
});

test("Package 2 fields are optional and partial indexes exclude Course records", async () => {
  const Quiz = models.quizzes;
  const Session = models.quizsessions;
  const Attempt = models.quizattempts;
  const RateWindow = models.quizratewindows;
  const id = () => new mongoose.Types.ObjectId();
  assert.equal(new Quiz({ title: "Course", contextType: "course_final" }).runtimeFence, undefined);
  assert.equal(new Session({ user: id(), quiz: id(), revision: 1, contextType: "course_final", snapshot: {}, expiresAt: new Date() }).activeSlot, undefined);
  assert.equal(new Attempt({ quiz: id(), user: id(), attemptNumber: 1, score: 0, total: 1 }).session, undefined);
  await Promise.all([Session, Attempt, RateWindow].map((model) => model.syncIndexes()));
  const quiz = id(); const user = id(); const otherSession = id();
  const base = { quiz, user, revision: 1, snapshot: {}, expiresAt: new Date(Date.now() + 60000) };
  await Session.collection.insertMany([
    { ...base, contextType: "course_lesson", activeSlot: true },
    { ...base, contextType: "course_lesson", activeSlot: true },
    { ...base, contextType: "standalone", activeSlot: true },
  ]);
  await assert.rejects(Session.collection.insertOne({ ...base, contextType: "standalone", activeSlot: true }), (error) => error.code === 11000);
  const attemptBase = { quiz, user, score: 0, total: 1 };
  await Attempt.collection.insertMany([
    { ...attemptBase, attemptNumber: 1 }, { ...attemptBase, attemptNumber: 2 },
    { ...attemptBase, attemptNumber: 3, session: otherSession },
  ]);
  await assert.rejects(Attempt.collection.insertOne({ ...attemptBase, attemptNumber: 4, session: otherSession }), (error) => error.code === 11000);
  const window = { user, operation: "start", windowStart: new Date(0), count: 1, expiresAt: new Date(Date.now() + 60000) };
  await RateWindow.collection.insertOne(window);
  await assert.rejects(RateWindow.collection.insertOne(window), (error) => error.code === 11000);
});

test("Package 2 preflight is read-only on populated collections and reports missing indexes", async () => {
  const quiz = new mongoose.Types.ObjectId(); const user = new mongoose.Types.ObjectId();
  await db.collection("quizsessions").insertOne({ quiz, user, contextType: "course_lesson" });
  await db.collection("quizattempts").insertOne({ quiz, user, attemptNumber: 1 });
  const beforeSessions = await db.collection("quizsessions").find({}).toArray();
  const beforeAttempts = await db.collection("quizattempts").find({}).toArray();
  const beforeSessionIndexes = await db.collection("quizsessions").listIndexes().toArray();
  const report = await standalonePreflight.inspect(db, db.databaseName);
  assert.equal(report.mode, "preflight");
  assert.equal(report.status, "INDEXES_MISSING");
  assert.ok(report.missingIndexes.some((item) => item.name === "one_active_standalone_session"));
  assert.ok(report.missingIndexes.some((item) => item.name === "one_standalone_attempt_per_session"));
  assert.deepEqual(await db.collection("quizsessions").find({}).toArray(), beforeSessions);
  assert.deepEqual(await db.collection("quizattempts").find({}).toArray(), beforeAttempts);
  assert.deepEqual(await db.collection("quizsessions").listIndexes().toArray(), beforeSessionIndexes);
  assert.equal((await db.listCollections({ name: "quizratewindows" }).toArray()).length, 0);
  await assert.rejects(standalonePreflight.inspect(db, "wrong_database"));
  assert.throws(() => standalonePreflight.parseArgs(["--apply"]), /no apply mode/i);
});

test("Package 2 preflight detects duplicate active slots, attempt sessions, and legacy standalone records", async () => {
  const quiz = new mongoose.Types.ObjectId(); const user = new mongoose.Types.ObjectId(); const session = new mongoose.Types.ObjectId();
  await db.collection("quizsessions").insertMany([
    { quiz, user, contextType: "standalone", activeSlot: true, expiresAt: new Date(Date.now() + 60000), invalidatedAt: null },
    { quiz, user, contextType: "standalone", activeSlot: true, expiresAt: new Date(Date.now() + 60000), invalidatedAt: null },
    { quiz, user, contextType: "standalone", expiresAt: new Date(Date.now() + 60000) },
  ]);
  await db.collection("quizattempts").insertMany([
    { quiz, user, session, attemptNumber: 1 }, { quiz, user, session, attemptNumber: 2 },
    { quiz, user, attemptNumber: 3, submissionSnapshot: { contextType: "standalone" } },
  ]);
  await db.collection("quizzes").insertOne({ _id: quiz, contextType: "standalone", status: "published" });
  const report = await standalonePreflight.inspect(db, db.databaseName);
  assert.equal(report.status, "BLOCKED_FOR_REVIEW");
  assert.equal(report.issues.duplicateActiveSessionGroups, 1);
  assert.equal(report.issues.standaloneSessionsMissingSlot, 1);
  assert.equal(report.issues.duplicateSessionReferenceGroups, 1);
  assert.equal(report.issues.standaloneAttemptsMissingSession, 1);
  assert.equal(report.issues.legacyStandaloneWithoutPublication, 1);
  assert.equal(report.issues.standaloneWithoutRuntimeFence, 1);
});

test("Package 2 preflight reports same-name and same-key index conflicts without changing them", async () => {
  await db.createCollection("quizsessions");
  await db.collection("quizsessions").createIndex({ quiz: 1, user: 1 }, { name: "one_active_standalone_session", unique: false });
  await db.createCollection("quizattempts");
  await db.collection("quizattempts").createIndex({ session: 1 }, { name: "other_session_index" });
  const beforeSessions = await db.collection("quizsessions").listIndexes().toArray();
  const beforeAttempts = await db.collection("quizattempts").listIndexes().toArray();
  const report = await standalonePreflight.inspect(db, db.databaseName);
  assert.equal(report.status, "BLOCKED_FOR_REVIEW");
  assert.ok(report.conflicts.some((item) => item.required === "one_active_standalone_session"));
  assert.ok(report.conflicts.some((item) => item.required === "one_standalone_attempt_per_session"));
  assert.deepEqual(await db.collection("quizsessions").listIndexes().toArray(), beforeSessions);
  assert.deepEqual(await db.collection("quizattempts").listIndexes().toArray(), beforeAttempts);
});

test("Package 2 preflight detects duplicate and malformed rate windows", async () => {
  const user = new mongoose.Types.ObjectId();
  const windowStart = new Date(Date.now() - 60000);
  const expiresAt = new Date(windowStart.getTime() + 15 * 60 * 1000);
  await db.collection("quizratewindows").insertMany([
    { user, operation: "start", windowStart, count: 1, expiresAt },
    { user, operation: "start", windowStart, count: 2, expiresAt },
    { user, operation: "unknown", windowStart, count: "bad", expiresAt: "bad" },
  ]);
  const report = await standalonePreflight.inspect(db, db.databaseName);
  assert.equal(report.status, "BLOCKED_FOR_REVIEW");
  assert.equal(report.issues.duplicateRateWindowGroups, 1);
  assert.equal(report.issues.invalidRateWindows, 1);
});

const validQuestion = () => ({ prompt: "Choose the answer", options: ["A", "B"], correctAnswer: 0 });
const validMetadata = () => ({ title: "Practice", description: "", category: "Vocabulary",
  difficulty: "Beginner", standaloneAccess: "public" });
const validDraft = (basePublishedRevision = null) => ({ ...validMetadata(), questions: [validQuestion()],
  version: 1, basePublishedRevision });
const publishedQuiz = (changes = {}) => ({ contextType: "standalone", status: "published", revision: 1,
  publishedRevision: 1, ...validMetadata(), questions: [validQuestion()], ...changes });

test("Package 2 preflight reports missing and malformed published standalone content without repair", async () => {
  const quizzes = db.collection("quizzes");
  const empty = await quizzes.insertOne(publishedQuiz({ questions: [] }));
  const malformed = await quizzes.insertOne(publishedQuiz({ questions: [
    { prompt: "", options: ["A", ""], correctAnswer: 3 },
  ] }));
  const before = await quizzes.find({}).toArray();
  const report = await standalonePreflight.inspect(db, db.databaseName);
  assert.equal(report.status, "BLOCKED_FOR_REVIEW");
  assert.equal(report.issues.invalidStandaloneQuizzes, 2);
  assert.ok(report.invalidRecords.standaloneQuizzes.records.find((entry) => entry.quizId === String(empty.insertedId))
    .reasons.includes("published_question_count_invalid"));
  const reasons = report.invalidRecords.standaloneQuizzes.records.find((entry) => entry.quizId === String(malformed.insertedId)).reasons;
  assert.ok(reasons.includes("published_question_1_content_missing"));
  assert.ok(reasons.includes("published_question_1_options_invalid"));
  assert.ok(reasons.includes("published_question_1_correct_answer_invalid"));
  assert.deepEqual(await quizzes.find({}).toArray(), before);
});

test("Package 2 preflight rejects invalid revision/state combinations but accepts valid disabled and archived quizzes", async () => {
  const quizzes = db.collection("quizzes");
  const badDraft = await quizzes.insertOne(publishedQuiz({ status: "draft", draft: validDraft(1) }));
  const badDisabled = await quizzes.insertOne(publishedQuiz({ status: "disabled", publishedRevision: null }));
  const badRevision = await quizzes.insertOne(publishedQuiz({ status: "archived", revision: 2 }));
  const badUnpublishedRevision = await quizzes.insertOne({ contextType: "standalone", status: "draft",
    title: "Unpublished", revision: 2, publishedRevision: null, questions: [], draft: validDraft() });
  await quizzes.insertMany([
    publishedQuiz({ status: "disabled", draft: validDraft(1) }),
    publishedQuiz({ status: "archived" }),
    { contextType: "standalone", status: "archived", revision: 1, publishedRevision: null,
      title: "Unpublished", questions: [], draft: validDraft() },
  ]);
  const report = await standalonePreflight.inspect(db, db.databaseName);
  assert.equal(report.issues.invalidStandaloneQuizzes, 4);
  const byId = Object.fromEntries(report.invalidRecords.standaloneQuizzes.records.map((entry) => [entry.quizId, entry.reasons]));
  assert.ok(byId[String(badDraft.insertedId)].includes("draft_status_has_publication"));
  assert.ok(byId[String(badDisabled.insertedId)].includes("status_missing_publication"));
  assert.ok(byId[String(badRevision.insertedId)].includes("revision_publication_mismatch"));
  assert.ok(byId[String(badUnpublishedRevision.insertedId)].includes("unpublished_revision_mismatch"));
});

test("Package 2 preflight validates rate-window counts, dates, boundaries, user and operation", async () => {
  const windows = db.collection("quizratewindows");
  const start = new Date("2026-01-01T00:00:00.000Z");
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const base = { user: new mongoose.Types.ObjectId(), operation: "start", windowStart: start, count: 0, expiresAt: end };
  const invalid = [
    { count: -1 }, { count: 0.5 }, { windowStart: "not-a-date" }, { expiresAt: "not-a-date" },
    { expiresAt: new Date(end.getTime() - 1) }, { user: "not-an-object-id" }, { operation: "other" },
  ];
  const ids = [];
  for (const change of invalid) ids.push((await windows.insertOne({ ...base, ...change })).insertedId);
  await windows.insertMany([base, { ...base, operation: "submit", count: 2, expiresAt: new Date(end.getTime() + 1000) }]);
  const before = await windows.find({}).toArray();
  const report = await standalonePreflight.inspect(db, db.databaseName);
  assert.equal(report.issues.invalidRateWindows, invalid.length);
  const byId = Object.fromEntries(report.invalidRecords.rateWindows.records.map((entry) => [entry.rateWindowId, entry.reasons]));
  assert.ok(byId[String(ids[0])].includes("count_invalid"));
  assert.ok(byId[String(ids[1])].includes("count_invalid"));
  assert.ok(byId[String(ids[2])].includes("window_start_invalid"));
  assert.ok(byId[String(ids[3])].includes("expiry_invalid"));
  assert.ok(byId[String(ids[4])].includes("expiry_before_window_end"));
  assert.ok(byId[String(ids[5])].includes("user_invalid"));
  assert.ok(byId[String(ids[6])].includes("operation_invalid"));
  assert.deepEqual(await windows.find({}).toArray(), before);
});

test("Package 2 read-only CLI preflight succeeds on isolated local MongoDB without changing data or indexes", async () => {
  await Promise.all([models.quizsessions, models.quizattempts, models.quizratewindows].map((model) => model.syncIndexes()));
  const beforeNames = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort();
  const beforeIndexes = Object.fromEntries(await Promise.all(beforeNames.map(async (name) =>
    [name, await db.collection(name).listIndexes().toArray()])));
  const output = [];
  const originalLog = console.log;
  const originalExitCode = process.exitCode;
  try {
    console.log = (value) => output.push(value);
    await standalonePreflight.main([], {
      MONGO_DB: `mongodb://127.0.0.1:${mongoPort}/quiz_index_migration_test?replicaSet=paymentTests`,
      QUIZ_INDEX_EXPECTED_DB: db.databaseName,
    });
  } finally {
    console.log = originalLog;
    process.exitCode = originalExitCode;
  }
  assert.equal(output.length, 1);
  const report = JSON.parse(output[0]);
  assert.equal(report.status, "INDEX_DEFINITIONS_PRESENT");
  assert.equal(report.database, db.databaseName);
  assert.deepEqual((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort(), beforeNames);
  for (const name of beforeNames) assert.deepEqual(await db.collection(name).listIndexes().toArray(), beforeIndexes[name]);
});

test("Package 2 preflight refuses apply and mismatched database before any connection", async () => {
  await assert.rejects(standalonePreflight.main(["--apply"], {}), /no apply mode/i);
  await assert.rejects(standalonePreflight.main([], {
    MONGO_DB: "mongodb://127.0.0.1:1/quiz_index_migration_test",
    QUIZ_INDEX_EXPECTED_DB: "other_database",
  }), /differs from QUIZ_INDEX_EXPECTED_DB/);
});

test("mode and database guards require explicit Apply and exact database identity", async () => {
  assert.equal(parseMode([]), "preflight");
  assert.equal(parseMode(["--preflight"]), "preflight");
  assert.equal(parseMode(["--apply"]), "apply");
  assert.throws(() => parseMode(["--apply", "--preflight"]));
  const uri = "mongodb://127.0.0.1:27017/quiz_index_migration_test";
  assert.equal(resolveDatabase({ MONGO_DB: uri, QUIZ_INDEX_EXPECTED_DB: "quiz_index_migration_test" }, "preflight"), "quiz_index_migration_test");
  assert.throws(() => resolveDatabase({ MONGO_DB: uri, QUIZ_INDEX_EXPECTED_DB: "other" }, "apply"));
  assert.throws(() => resolveDatabase({ MONGO_DB: "mongodb://127.0.0.1:27017", QUIZ_INDEX_EXPECTED_DB: "test" }, "preflight"));
  assert.throws(() => resolveDatabase({ MONGO_DB: uri, QUIZ_INDEX_EXPECTED_DB: "quiz_index_migration_test", NODE_ENV: "production" }, "apply"));
  await assert.rejects(inspect(db, "wrong_database"));
});

test("default preflight reads empty legacy state without creating, dropping, or modifying anything", async () => {
  await legacyState();
  const sentinel = { marker: "preserve" };
  const { insertedId } = await db.collection("unrelated").insertOne(sentinel);
  const beforeNames = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort();
  const beforeQuizIndexes = await db.collection("quizzes").listIndexes().toArray();
  const beforeAttemptIndexes = await db.collection("quizattempts").listIndexes().toArray();
  const report = await inspect(db, db.databaseName);
  assert.equal(report.status, "READY FOR APPLY");
  assert.deepEqual(report.confirmedLegacy.map(({ name }) => name).sort(), ["course_1_title_1", "lesson_1_title_1"]);
  assert.equal(report.collections.quizzes.count, 0);
  assert.equal(report.collections.quizattempts.count, 0);
  assert.ok(report.missingCollections.includes("quizsessions"));
  assert.ok(report.plannedOperations.some(({ action, collection, index }) => action === "createIndex" && collection === "quizsessions" && index === "expiresAt_1"));
  assert.deepEqual((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort(), beforeNames);
  assert.deepEqual(await db.collection("quizzes").listIndexes().toArray(), beforeQuizIndexes);
  assert.deepEqual(await db.collection("quizattempts").listIndexes().toArray(), beforeAttemptIndexes);
  assert.deepEqual(await db.collection("unrelated").findOne({ _id: insertedId }), { _id: insertedId, marker: "preserve" });
});

test("nonempty quizzes or attempts stop Apply before any migration writes", async () => {
  await legacyState();
  for (const name of ["quizzes", "quizattempts"]) {
    await db.collection(name).insertOne({ marker: name });
    const report = await apply(db, db.databaseName);
    assert.equal(report.status, "NOT READY FOR APPLY");
    assert.deepEqual(report.operations, []);
    assert.equal((await db.collection("quizzes").listIndexes().toArray()).length, 6);
    assert.equal(await db.collection(name).countDocuments({}), 1);
    await db.collection(name).deleteMany({});
  }
});

test("mismatched legacy, unknown extra, and wrong required options are never silently repaired or dropped", async () => {
  await legacyState();
  await db.collection("quizzes").dropIndex("lesson_1_title_1");
  await db.collection("quizzes").createIndex({ lesson: 1, title: 1 }, { name: "lesson_1_title_1", unique: false });
  let report = await inspect(db, db.databaseName);
  assert.equal(report.status, "NOT READY FOR APPLY");
  assert.ok(report.conflicts.some(({ legacyName }) => legacyName === "lesson_1_title_1"));
  assert.equal((await apply(db, db.databaseName)).operations.length, 0);

  await db.collection("quizzes").dropIndex("lesson_1_title_1");
  await db.collection("quizzes").createIndex({ lesson: 1, title: 1 }, { ...LEGACY_QUIZ_INDEXES[0].options, name: "lesson_1_title_1" });
  await db.collection("quizzes").createIndex({ mystery: 1 });
  report = await inspect(db, db.databaseName);
  assert.equal(report.status, "NOT READY FOR APPLY");
  assert.ok(report.unexpectedIndexes.some(({ index: spec }) => spec.name === "mystery_1"));
  assert.equal((await apply(db, db.databaseName)).operations.length, 0);
  assert.ok((await db.collection("quizzes").listIndexes().toArray()).some(({ name }) => name === "mystery_1"));

  await db.collection("quizzes").dropIndex("mystery_1");
  await db.collection("quizzes").createIndex({ contextType: 1 }, { unique: true });
  report = await inspect(db, db.databaseName);
  assert.equal(report.status, "NOT READY FOR APPLY");
  assert.ok(report.conflicts.some(({ actual }) => actual?.name === "contextType_1"));
});

test("isolated Apply creates exact indexes, removes only confirmed legacy indexes, and is rerunnable", async () => {
  await legacyState();
  await db.collection("unrelated").insertOne({ marker: "preserve" });
  const result = await apply(db, db.databaseName);
  assert.equal(result.status, "APPLY COMPLETE");
  assert.equal(result.collections.quizzes.indexes.length, INDEXES.quizzes.length + 1); // includes _id_
  assert.ok(result.operations.some(({ action, index: name }) => action === "dropConfirmedLegacyIndex" && name === "lesson_1_title_1"));
  for (const [name, expectedIndexes] of Object.entries(INDEXES)) {
    const actual = await db.collection(name).listIndexes().toArray();
    assert.ok(actual.some(({ name: indexName }) => indexName === "_id_"), `${name} _id_`);
    for (const expected of expectedIndexes) {
      assert.ok(actual.some((candidate) => sameDefinition(candidate, expected)), `${name}.${expected.name}`);
    }
  }
  const sessionIndexes = await db.collection("quizsessions").listIndexes().toArray();
  assert.equal(sessionIndexes.find(({ name }) => name === "expiresAt_1").expireAfterSeconds, 0);
  assert.deepEqual((await db.collection("quizattemptrequests").listIndexes().toArray()).find(({ name }) => name === "one_pending_course_final_request").partialFilterExpression, { status: "pending" });
  assert.equal((await db.collection("quizzes").listIndexes().toArray()).some(({ name }) => name.endsWith("_title_1")), false);
  assert.equal(await db.collection("unrelated").countDocuments({ marker: "preserve" }), 1);
  const rerun = await apply(db, db.databaseName);
  assert.equal(rerun.status, "APPLY COMPLETE");
  assert.equal(rerun.operations.some(({ action }) => ["createCollection", "createIndex", "dropConfirmedLegacyIndex"].includes(action)), false);
});

test("a failed required-index build leaves legacy indexes in place and reports partial work", async () => {
  await legacyState();
  const failingDb = {
    databaseName: db.databaseName,
    listCollections: db.listCollections.bind(db),
    createCollection: db.createCollection.bind(db),
    collection(name) {
      const collection = db.collection(name);
      if (name !== "quizsessions") return collection;
      return new Proxy(collection, { get(target, property) {
        if (property === "createIndex") return async () => { throw new Error("injected build failure"); };
        const value = target[property];
        return typeof value === "function" ? value.bind(target) : value;
      } });
    },
  };
  const result = await apply(failingDb, db.databaseName);
  assert.equal(result.status, "APPLY FAILED");
  assert.ok(result.operations.some(({ action }) => action === "createCollection"));
  assert.equal(result.operations.some(({ action }) => action === "dropConfirmedLegacyIndex"), false);
  assert.ok((await db.collection("quizzes").listIndexes().toArray()).some(({ name }) => name === "lesson_1_title_1"));
  assert.equal((await apply(db, db.databaseName)).status, "APPLY COMPLETE");
});
