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

const modelPaths = {
  quizzes: "quizModel", quizattempts: "quizAttemptModel", homeworksets: "homeworkSetModel",
  homeworksetassignments: "homeworkSetAssignmentModel", quizunlocks: "quizUnlockModel",
  quizgoalachievements: "quizGoalAchievementModel", quizattemptgrants: "quizAttemptGrantModel",
  quizattemptrequests: "quizAttemptRequestModel", quizsessions: "quizSessionModel", quizmedias: "quizMediaModel",
};

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close((error) => error ? reject(error) : resolve(port));
  });
});

let mongo; let directory; let db; let models;
before(async () => {
  const port = await freePort();
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

test("migration manifest stays aligned with the ten current Mongoose schemas", () => {
  for (const [collection, Model] of Object.entries(models)) {
    assert.equal(Model.collection.name, collection);
    const actual = Model.schema.indexes().map(([key, options]) => ({ key, options, name: options.name || Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_") }));
    assert.equal(actual.length, INDEXES[collection].length, `${collection} index count`);
    for (const expected of INDEXES[collection]) {
      assert.ok(actual.some((candidate) => sameDefinition({ ...candidate.options, key: candidate.key, name: candidate.name }, expected)), `${collection}.${expected.name}`);
    }
  }
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
  assert.equal(result.collections.quizzes.indexes.length, 11);
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
