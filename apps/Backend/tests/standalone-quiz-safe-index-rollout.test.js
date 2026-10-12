const assert = require("node:assert/strict");
const { before, beforeEach, after, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { mongo: { MongoClient, ObjectId } } = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const { INDEXES, sameDefinition } = require("../scripts/prepareQuizIndexes");
const { REQUIRED_INDEXES } = require("../services/standaloneQuizRuntimeReadiness");
const { parseArgs, resolveTarget, inspect, apply, resultExitCode, main } =
  require("../scripts/prepareStandaloneQuizIndexes");

const databaseName = "quiz_safe_index_rollout_test";
let mongo; let directory; let client; let db; let uri;
const id = () => new ObjectId();

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

before(async () => {
  const port = await freePort();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-safe-index-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory,
    "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => {
      if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); }
    });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(port);
  uri = `mongodb://127.0.0.1:${port}/${databaseName}?replicaSet=paymentTests`;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(databaseName);
});

beforeEach(async () => { await db.dropDatabase(); });

after(async () => {
  if (client) await client.close();
  if (mongo && mongo.exitCode === null) {
    await new Promise((resolve) => { mongo.once("exit", resolve); mongo.kill("SIGTERM"); });
  }
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

function expectedSpecs() {
  return Object.entries(REQUIRED_INDEXES).flatMap(([collection, names]) =>
    names.map((name) => ({ collection, name, spec: INDEXES[collection].find((entry) => entry.name === name) })));
}

function withCreateHook(hook) {
  return {
    databaseName: db.databaseName,
    listCollections: (...args) => db.listCollections(...args),
    admin: (...args) => db.admin(...args),
    collection(name) {
      const collection = db.collection(name);
      const create = collection.createIndex.bind(collection);
      collection.createIndex = (key, options) => hook({ collection: name, name: options.name,
        create: () => create(key, options) });
      return collection;
    },
  };
}

test("CLI requires explicit target, rejects wrong and production databases before connecting", async () => {
  assert.deepEqual(parseArgs(["--expected-db", databaseName]), { apply: false, expectedDatabase: databaseName });
  assert.deepEqual(parseArgs(["--apply", "--expected-db", databaseName]), { apply: true, expectedDatabase: databaseName });
  assert.throws(() => parseArgs(["--apply"]), /expected database/);
  assert.throws(() => parseArgs(["--expected-db", databaseName, "--apply", "--apply"]));
  assert.throws(() => resolveTarget({ MONGO_DB: uri }, "wrong_database"), /does not match/);
  assert.throws(() => resolveTarget({ MONGO_DB: "mongodb://127.0.0.1/arunthai" }, "arunthai"), /Production/);
  assert.throws(() => resolveTarget({ MONGO_DB: uri, NODE_ENV: "production" }, databaseName), /Production/);
  await assert.rejects(main(["--expected-db", "wrong_database", "--apply"], { MONGO_DB: uri }));
  assert.deepEqual(await db.listCollections({}, { nameOnly: true }).toArray(), []);
});

test("default CLI and inspection are read-only and report six missing indexes", async () => {
  const oldLog = console.log;
  const lines = [];
  console.log = (value) => { lines.push(value); };
  try { await main(["--expected-db", databaseName], { MONGO_DB: uri, NODE_ENV: "test" }); }
  finally { console.log = oldLog; }
  const report = JSON.parse(lines[0]);
  assert.equal(report.mode, "preflight");
  assert.equal(report.status, "INDEXES_MISSING");
  assert.equal(report.missing.length, 6);
  assert.deepEqual(report.blockedIndexes, []);
  assert.equal(report.quizzesCollectionPresent, false);
  assert.deepEqual(await db.listCollections({}, { nameOnly: true }).toArray(), []);
});

test("local apply creates only missing approved indexes, verifies definitions and is idempotent", async () => {
  for (const collection of Object.keys(REQUIRED_INDEXES)) await db.createCollection(collection);
  await db.createCollection("quizzes");
  const quiz = id(); const user = id();
  await db.collection("quizattempts").insertOne({ quiz, user, attemptNumber: 1, score: 1, total: 1 });
  const before = await db.collection("quizattempts").find({}).toArray();
  const first = await apply(db, databaseName);
  assert.equal(first.status, "INDEXES_READY");
  assert.equal(resultExitCode(true, first), 0);
  assert.equal(first.created.length, 6);
  assert.equal(first.existing.length, 6);
  for (const { collection, spec } of expectedSpecs()) {
    const actual = await db.collection(collection).listIndexes().toArray();
    assert.equal(actual.length, REQUIRED_INDEXES[collection].length + 1, `${collection} has only _id and approved indexes`);
    assert.ok(actual.some((entry) => sameDefinition(entry, spec)), `${collection}.${spec.name}`);
  }
  const second = await apply(db, databaseName);
  assert.equal(second.status, "INDEXES_READY");
  assert.deepEqual(second.created, []);
  assert.deepEqual(await db.collection("quizattempts").find({}).toArray(), before);
});

test("a missing index at final verification makes apply incomplete and retry restores readiness", async () => {
  const raced = withCreateHook(async ({ name, create }) => {
    const result = await create();
    if (name === "quiz_rate_window_expiry") {
      // Simulate an external index change after this tool verified an earlier index.
      await db.collection("quizsessions").dropIndex("expiresAt_1");
    }
    return result;
  });
  const incomplete = await apply(raced, databaseName);
  assert.equal(incomplete.status, "APPLY_INCOMPLETE");
  assert.equal(incomplete.verificationStatus, "INDEXES_MISSING");
  assert.equal(incomplete.created.length, 6);
  assert.ok(incomplete.missing.some((entry) => entry.name === "expiresAt_1"));
  assert.equal(resultExitCode(true, incomplete), 2);
  assert.equal(resultExitCode(false, { status: "INDEXES_MISSING" }), 0,
    "the read-only preflight exit behavior is unchanged");
  const retry = await apply(db, databaseName);
  assert.equal(retry.status, "INDEXES_READY");
  assert.deepEqual(retry.created, [{ collection: "quizsessions", name: "expiresAt_1" }]);
  assert.equal(resultExitCode(true, retry), 0);
});

test("partial index-creation failure reports created indexes and can be retried safely", async () => {
  const interrupted = withCreateHook(async ({ name, create }) => {
    if (name === "quiz_1_user_1_attemptNumber_1") throw new Error("injected local failure");
    return create();
  });
  const failed = await apply(interrupted, databaseName);
  assert.equal(failed.status, "APPLY_FAILED");
  assert.deepEqual(failed.created, [
    { collection: "quizsessions", name: "expiresAt_1" },
    { collection: "quizsessions", name: "one_active_standalone_session" },
  ]);
  assert.equal(failed.afterFailure.status, "INDEXES_MISSING");
  assert.equal(resultExitCode(true, failed), 2);
  const retry = await apply(db, databaseName);
  assert.equal(retry.status, "INDEXES_READY");
  assert.equal(retry.created.length, 4);
  assert.equal(retry.existing.length, 6);
  assert.equal(resultExitCode(true, retry), 0);
});

test("an absent required collection is created only as a consequence of its approved indexes", async () => {
  const report = await apply(db, databaseName);
  assert.equal(report.status, "INDEXES_READY");
  assert.equal(report.created.length, 6);
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name).sort();
  assert.deepEqual(names, ["quizattempts", "quizratewindows", "quizsessions"]);
  for (const name of names) assert.equal(await db.collection(name).countDocuments({}), 0);
});

test("exact matching existing indexes are accepted without writes", async () => {
  await db.createCollection("quizsessions");
  const spec = INDEXES.quizsessions.find((entry) => entry.name === "expiresAt_1");
  await db.collection("quizsessions").createIndex(spec.key, { ...spec.options, name: spec.name });
  const report = await inspect(db, databaseName);
  assert.ok(report.existing.some((entry) => entry.collection === "quizsessions" && entry.name === "expiresAt_1"));
  assert.equal(report.missing.length, 5);
  const applied = await apply(db, databaseName);
  assert.equal(applied.status, "INDEXES_READY");
  assert.equal(applied.created.length, 5);
  assert.ok(!applied.created.some((entry) => entry.name === "expiresAt_1"));
  assert.ok((await db.collection("quizsessions").listIndexes().toArray())
    .some((entry) => sameDefinition(entry, spec)));
});

test("same-name or same-key conflicts block all creation without dropping the existing index", async () => {
  await db.createCollection("quizsessions");
  await db.collection("quizsessions").createIndex({ quiz: 1, user: 1 }, { name: "one_active_standalone_session" });
  const before = await db.collection("quizsessions").listIndexes().toArray();
  const report = await apply(db, databaseName);
  assert.equal(report.status, "BLOCKED_FOR_REVIEW");
  assert.deepEqual(report.created, []);
  assert.ok(report.blockedIndexes.some((entry) => entry.name === "one_active_standalone_session"));
  assert.ok(report.conflicts.some((entry) => entry.required === "one_active_standalone_session"));
  assert.deepEqual(await db.collection("quizsessions").listIndexes().toArray(), before);
});

test("duplicate active slots, session references, rate keys, and attempt numbers block creation", async () => {
  const quiz = id(); const user = id(); const session = id(); const date = new Date(Date.now() + 60000);
  await db.collection("quizsessions").insertMany([
    { quiz, user, contextType: "standalone", activeSlot: true, expiresAt: date },
    { quiz, user, contextType: "standalone", activeSlot: true, expiresAt: date },
  ]);
  await db.collection("quizattempts").insertMany([
    { quiz, user, attemptNumber: 1, session, submissionSnapshot: { contextType: "standalone" } },
    { quiz, user, attemptNumber: 1, session, submissionSnapshot: { contextType: "standalone" } },
  ]);
  const windowStart = new Date(Math.floor(Date.now() / 900000) * 900000);
  const expiresAt = new Date(windowStart.getTime() + 900000);
  await db.collection("quizratewindows").insertMany([
    { user, operation: "start", windowStart, expiresAt, count: 1 },
    { user, operation: "start", windowStart, expiresAt, count: 1 },
  ]);
  const report = await apply(db, databaseName);
  assert.equal(report.status, "BLOCKED_FOR_REVIEW");
  assert.deepEqual(report.created, []);
  assert.equal(report.issues.duplicateActiveSessionGroups, 1);
  assert.equal(report.issues.duplicateSessionReferenceGroups, 1);
  assert.equal(report.issues.duplicateRateWindowGroups, 1);
  assert.equal(report.issues.duplicateAttemptNumberGroups, 1);
});

test("malformed index keys and legacy standalone records are reported without repair", async () => {
  const quiz = id();
  await db.collection("quizsessions").insertOne({ quiz: "not-an-id", user: id(), contextType: "standalone",
    activeSlot: true, expiresAt: "not-a-date" });
  await db.collection("quizzes").insertOne({ _id: quiz, contextType: "standalone", status: "published",
    title: "Legacy published practice", revision: 1, questions: [] });
  const beforeSession = await db.collection("quizsessions").findOne({ quiz: "not-an-id" });
  const beforeQuiz = await db.collection("quizzes").findOne({ _id: quiz });
  const report = await apply(db, databaseName);
  assert.equal(report.status, "BLOCKED_FOR_REVIEW");
  assert.deepEqual(report.created, []);
  assert.ok(report.issues.malformedIndexRecords > 0);
  assert.ok(report.issues.legacyStandaloneWithoutPublication > 0);
  assert.ok(report.legacyAndDataReview.standaloneQuizzes.records.some((entry) => entry.quizId === String(quiz)));
  assert.deepEqual(await db.collection("quizsessions").findOne({ quiz: "not-an-id" }), beforeSession);
  assert.deepEqual(await db.collection("quizzes").findOne({ _id: quiz }), beforeQuiz);
});

test("malformed existing rate windows block index creation without changing records", async () => {
  // A late expiry passes the older lower-bound preflight but cannot be used by
  // the live fixed-window limiter, which requires the exact window boundary.
  const row = { user: id(), operation: "start", windowStart: new Date(0),
    expiresAt: new Date(900001), count: 1 };
  const inserted = await db.collection("quizratewindows").insertOne(row);
  const before = await db.collection("quizratewindows").findOne({ _id: inserted.insertedId });
  const report = await apply(db, databaseName);
  assert.equal(report.status, "BLOCKED_FOR_REVIEW");
  assert.deepEqual(report.created, []);
  assert.equal(report.issues.malformedIndexRecords, 1);
  assert.equal(report.issues.invalidRateWindows, 0);
  assert.deepEqual(await db.collection("quizratewindows").findOne({ _id: inserted.insertedId }), before);
});

test("a valid published standalone Quiz without runtimeFence is reported but not blocked", async () => {
  await db.collection("quizzes").insertOne({ contextType: "standalone", status: "published",
    title: "Published practice", revision: 1, publishedRevision: 1,
    category: "Vocabulary", difficulty: "Beginner", standaloneAccess: "public",
    questions: [{ prompt: "Choose A", options: ["A", "B"], correctAnswer: 0 }] });
  const report = await inspect(db, databaseName);
  assert.equal(report.issues.standaloneWithoutRuntimeFence, 1);
  assert.equal(report.issues.invalidStandaloneQuizzes, 0);
  assert.equal(report.status, "INDEXES_MISSING");
  assert.equal((await apply(db, databaseName)).status, "INDEXES_READY");
});
