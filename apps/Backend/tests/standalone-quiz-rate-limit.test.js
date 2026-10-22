const assert = require("node:assert/strict");
const { before, beforeEach, after, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const QuizRateWindow = require("../models/quizRateWindowModel");
const { LIMIT, WINDOW_MS, consumeStandaloneQuizRateLimit: consume } =
  require("../services/standaloneQuizRateLimit");
const { standaloneQuizRateLimit } = require("../middleware/standaloneQuizRateLimit");
const rateIndexPreparation = require("../scripts/prepareStandaloneRateWindowIndexes");
const { TESTING_HOST } = require("../scripts/productionQuizTarget");

let mongo; let directory;
const userId = () => new mongoose.Types.ObjectId();
const quizId = () => new mongoose.Types.ObjectId();
const firstQuiz = quizId();
const connection = () => ({ readyState: 1, db: mongoose.connection.db });
const take = (user, operation = "start", instance = connection(), quiz = firstQuiz) =>
  consume({ userId: user, quizId: quiz, operation, connection: instance });

async function localPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const selected = server.address().port;
      server.close((error) => error ? reject(error) : resolve(selected));
    });
  });
}

before(async () => {
  const port = await localPort();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-quiz-rate-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory,
    "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/quiz_rate_limit_test?replicaSet=paymentTests`,
    { autoIndex: false, autoCreate: false });
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await QuizRateWindow.createCollection();
  await QuizRateWindow.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  if (mongo && mongo.exitCode === null) {
    await new Promise((resolve) => { mongo.once("exit", resolve); mongo.kill("SIGTERM"); });
  }
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

function mockResponse() {
  return { statusCode: 200, headers: {}, body: undefined,
    set(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; } };
}

test("first and twentieth requests pass; twenty-first returns the fixed-window Retry-After", async () => {
  const user = userId();
  for (let request = 1; request <= LIMIT; request += 1) {
    assert.deepEqual(await take(user), { allowed: true });
  }
  const rejected = await take(user);
  assert.equal(rejected.allowed, false);
  assert.ok(Number.isInteger(rejected.retryAfter) && rejected.retryAfter >= 1 && rejected.retryAfter <= 900);
  const row = await QuizRateWindow.findOne({ user, operation: "start" }).lean();
  assert.equal(row.count, LIMIT);
  assert.equal(row.windowStart.getTime() % WINDOW_MS, 0);
  assert.equal(row.expiresAt.getTime() - row.windowStart.getTime(), WINDOW_MS);
});

test("start/submit, different users, and Student/Admin identities have separate or equal allowances", async () => {
  const student = userId(); const admin = userId();
  for (let request = 0; request < LIMIT; request += 1) await take(student, "start");
  assert.equal((await take(student, "start")).allowed, false);
  assert.equal((await take(student, "submit")).allowed, true);
  for (let request = 0; request < LIMIT; request += 1) assert.equal((await take(admin, "start")).allowed, true);
  assert.equal((await take(admin, "start")).allowed, false);
  // No role is supplied to the store: only the authenticated user ID matters.
  assert.equal(await QuizRateWindow.countDocuments({}), 3);
});

test("Quiz B has independent start and submit allowances after Quiz A is exhausted", async () => {
  const student = userId(); const secondQuiz = quizId();
  for (let request = 0; request < LIMIT; request += 1) {
    assert.equal((await take(student, "start")).allowed, true);
    assert.equal((await take(student, "submit")).allowed, true);
  }
  assert.equal((await take(student, "start")).allowed, false);
  assert.equal((await take(student, "submit")).allowed, false);
  assert.equal((await take(student, "start", connection(), secondQuiz)).allowed, true);
  assert.equal((await take(student, "submit", connection(), secondQuiz)).allowed, true);
  assert.equal(await QuizRateWindow.countDocuments({ user: student }), 4);
});

test("missing or malformed Quiz identity cannot create a counter", async () => {
  const student = userId();
  await assert.rejects(consume({ userId: student, operation: "start" }), /Invalid rate-limit input/);
  await assert.rejects(consume({ userId: student, quizId: "not-a-quiz", operation: "submit" }), /Invalid rate-limit input/);
  assert.equal(await QuizRateWindow.countDocuments({}), 0);
});

test("database-authoritative UTC window rollover resets allowance", async () => {
  const db = mongoose.connection.db;
  const originalAdmin = db.admin;
  const first = new Date("2030-01-01T00:14:59.000Z");
  let clock = first;
  db.admin = () => ({ command: async () => ({ localTime: clock }) });
  try {
    const user = userId();
    for (let request = 0; request < LIMIT; request += 1) await take(user);
    assert.deepEqual(await take(user), { allowed: false, retryAfter: 1 });
    clock = new Date("2030-01-01T00:15:00.000Z");
    assert.deepEqual(await take(user), { allowed: true });
    assert.equal(await QuizRateWindow.countDocuments({ user }), 2);
  } finally { db.admin = originalAdmin; }
});

test("concurrent first inserts and updates never admit more than twenty across simulated instances", async () => {
  const user = userId();
  const instances = [connection(), connection(), connection()];
  const results = await Promise.all(Array.from({ length: 40 }, (_, index) =>
    take(user, "submit", instances[index % instances.length])));
  assert.equal(results.filter(({ allowed }) => allowed).length, LIMIT);
  assert.equal(results.filter(({ allowed }) => !allowed).length, 20);
  assert.equal((await QuizRateWindow.findOne({ user, operation: "submit" })).count, LIMIT);
});

test("a transient write conflict retries with fresh persisted state", async () => {
  const user = userId();
  await take(user);
  const db = mongoose.connection.db;
  const originalCollection = db.collection;
  const collection = originalCollection.call(db, QuizRateWindow.collection.name);
  const original = collection.findOneAndUpdate;
  let injected = false;
  collection.findOneAndUpdate = async function findOneAndUpdateWithConflict(...args) {
    if (!injected) {
      injected = true;
      throw Object.assign(new Error("injected write conflict"), { code: 112 });
    }
    return original.apply(this, args);
  };
  db.collection = function collectionWithConflict(name, ...args) {
    return name === QuizRateWindow.collection.name ? collection : originalCollection.call(this, name, ...args);
  };
  try { assert.deepEqual(await take(user), { allowed: true }); }
  finally { db.collection = originalCollection; collection.findOneAndUpdate = original; }
  assert.equal(injected, true);
  assert.equal((await QuizRateWindow.findOne({ user })).count, 2);
});

test("malformed existing rows fail closed without changing their count", async () => {
  const user = userId();
  await take(user);
  await QuizRateWindow.collection.updateOne({ user, operation: "start" }, { $set: { count: 1.5 } });
  await assert.rejects(take(user), /malformed/);
  assert.equal((await QuizRateWindow.findOne({ user })).count, 1.5);
});

test("missing indexes and MongoDB failures cannot bypass enforcement", async () => {
  const user = userId();
  await QuizRateWindow.collection.dropIndex("one_standalone_quiz_rate_window");
  await assert.rejects(take(user), /indexes/);
  assert.equal(await QuizRateWindow.countDocuments({}), 0);
  await QuizRateWindow.syncIndexes();
  await assert.rejects(take(user, "start", { readyState: 0 }), /Database/);
  const db = mongoose.connection.db;
  const originalAdmin = db.admin;
  db.admin = () => ({ command: async () => { throw new Error("injected private database failure"); } });
  try { await assert.rejects(take(user), /private database failure/); }
  finally { db.admin = originalAdmin; }
  assert.equal(await QuizRateWindow.countDocuments({}), 0);
});

test("middleware uses authenticated identity, rejects missing auth, and sanitizes 429/503", async () => {
  let called = 0;
  const user = userId();
  const req = { user: { id: String(user), role: "admin" }, body: { userId: String(userId()) } };
  const resolvedQuiz = String(firstQuiz);
  const resolve = async () => ({ quizId: resolvedQuiz });
  const limiter = standaloneQuizRateLimit("start", async (args) => {
    assert.equal(args.userId, String(user));
    assert.equal(args.quizId, resolvedQuiz);
    assert.equal(args.operation, "start");
    called += 1;
    return called === 1 ? { allowed: true } : { allowed: false, retryAfter: 19 };
  }, resolve);
  const unauthenticated = mockResponse();
  await limiter({ body: req.body }, unauthenticated, () => { throw new Error("bypassed auth"); });
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(called, 0);
  let proceeded = false;
  await limiter(req, mockResponse(), () => { proceeded = true; });
  assert.equal(proceeded, true);
  const limited = mockResponse();
  await limiter(req, limited, () => { throw new Error("bypassed limit"); });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers["Retry-After"], "19");
  assert.equal(limited.body.code, "quiz_rate_limited");
  const unavailable = mockResponse();
  await standaloneQuizRateLimit("submit", async () => { throw new Error("secret database detail"); }, resolve)(
    req, unavailable, () => { throw new Error("bypassed database failure"); });
  assert.deepEqual(unavailable.body, { code: "quiz_rate_limit_unavailable",
    message: "Quiz requests are temporarily unavailable." });
  assert.equal(unavailable.statusCode, 503);
});

test("existing Course Quiz routes and global IP/body guards remain unchanged", () => {
  const router = require("../routes/quiz");
  const paths = router.stack.map((layer) => layer.route?.path).filter(Boolean);
  assert.ok(paths.includes("/standalone/:quizId/sessions"));
  assert.ok(paths.includes("/standalone/:quizId/submit"));
  assert.ok(paths.includes("/:quizId/sessions"));
  assert.ok(paths.includes("/:quizId/submit"));
  const serverSource = require("node:fs").readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert.match(serverSource, /windowMs:\s*15\s*\*\s*60\s*\*\s*1000/);
  assert.match(serverSource, /max:\s*500/);
  assert.match(serverSource, /express\.json\(\{\s*limit:\s*'1mb'\s*\}\)/);
});

test("new rate-index preparation is target-guarded, additive, and leaves legacy windows untouched", async () => {
  const db = mongoose.connection.db;
  const legacy = db.collection("quizratewindows");
  await legacy.insertOne({ marker: "retained" });
  await QuizRateWindow.collection.drop();
  const before = await rateIndexPreparation.inspect(db, db.databaseName);
  assert.equal(before.status, "INDEXES_MISSING");
  assert.equal(await legacy.countDocuments({}), 1);
  assert.throws(() => rateIndexPreparation.parseArgs(["--apply", "--expected-db", db.databaseName,
    "--expected-host", "127.0.0.1"]), /confirmation/);
  const args = rateIndexPreparation.parseArgs(["--apply", "--expected-db", db.databaseName,
    "--expected-host", "127.0.0.1", "--confirm-collection", "standalonequizratewindows"]);
  assert.equal(rateIndexPreparation.parseArgs(["--expected-db", db.databaseName,
    "--expected-host", "127.0.0.1"]).apply, false);
  assert.equal(rateIndexPreparation.resolveTarget({ MONGO_DB: `mongodb://127.0.0.1:27017/${db.databaseName}`,
    NODE_ENV: "test" }, args), db.databaseName);
  assert.throws(() => rateIndexPreparation.resolveTarget({ MONGO_DB: `mongodb://elsewhere:27017/${db.databaseName}` }, args));
  assert.throws(() => rateIndexPreparation.resolveTarget({ MONGO_DB: `mongodb://127.0.0.1:27017/other` }, args));
  assert.throws(() => rateIndexPreparation.resolveTarget({ MONGO_DB: `mongodb://127.0.0.1:27017/${db.databaseName}?DBNAME=other` }, args));
  assert.throws(() => rateIndexPreparation.resolveTarget({ MONGO_DB: `mongodb://127.0.0.1:27017/${db.databaseName}?tlsAllowInvalidCertificates=true` }, args));
  assert.equal((await rateIndexPreparation.apply(db, db.databaseName)).status, "INDEXES_READY");
  assert.equal((await rateIndexPreparation.apply(db, db.databaseName)).status, "INDEXES_READY");
  assert.equal(await legacy.countDocuments({}), 1);
  assert.equal((await QuizRateWindow.collection.listIndexes().toArray()).length, 3);
});

test("rate-index apply rejects production and ambiguous targets before connecting or writing", async () => {
  const database = mongoose.connection.db.databaseName;
  const local = `mongodb://127.0.0.1:27017/${database}`;
  const args = rateIndexPreparation.parseArgs(["--apply", "--expected-db", database,
    "--expected-host", "127.0.0.1", "--confirm-collection", "standalonequizratewindows"]);
  const target = (uri, changes = {}) => ({ MONGO_DB: uri, NODE_ENV: "test", ...changes });
  assert.throws(() => rateIndexPreparation.resolveTarget(target(local, { NODE_ENV: "production" }), args));
  assert.throws(() => rateIndexPreparation.resolveTarget(target(local, { NODE_ENV: undefined }), args));
  assert.throws(() => rateIndexPreparation.resolveTarget(target(local, { PRODUCTION_MONGO_EXPECTED_HOST: "production.example.test" }), args));
  assert.throws(() => rateIndexPreparation.resolveTarget(target(local, { QUIZ_INDEX_EXPECTED_DB: "arunthai" }), args));
  assert.throws(() => rateIndexPreparation.resolveTarget(target(local, { STANDALONE_QUIZ_EXPECTED_DB: "arunthai" }), args));
  assert.throws(() => rateIndexPreparation.resolveTarget(target(`mongodb://127.0.0.1:27017/arunthai`,
    { NODE_ENV: "testing" }), { ...args, expectedDatabase: "arunthai" }));
  assert.throws(() => rateIndexPreparation.resolveTarget(target(`mongodb://127.0.0.1:27017/arunthai`,
    { NODE_ENV: "production" }), { ...args, expectedDatabase: "arunthai" }));
  assert.throws(() => rateIndexPreparation.resolveTarget(target(`mongodb://example.mongodb.net/${database}`),
    { ...args, expectedHost: "example.mongodb.net" }));
  assert.throws(() => rateIndexPreparation.resolveTarget(target("mongodb://production.mongodb.net/arunthai",
    { NODE_ENV: "production" }), { ...args, expectedDatabase: "arunthai",
    expectedHost: "production.mongodb.net" }));
  assert.throws(() => rateIndexPreparation.resolveTarget(target(`mongodb+srv://other.mongodb.net/${database}`),
    { ...args, expectedHost: "other.mongodb.net" }));
  assert.equal(rateIndexPreparation.resolveTarget(target(`mongodb+srv://${TESTING_HOST}/${database}`),
    { ...args, expectedHost: TESTING_HOST }), database);
  assert.throws(() => rateIndexPreparation.parseArgs(["--apply", "--expected-db", database,
    "--expected-host", "127.0.0.1", "--confirm-collection", "quizratewindows"]));
  const before = await QuizRateWindow.collection.countDocuments({});
  await assert.rejects(rateIndexPreparation.main(["--apply", "--expected-db", database,
    "--expected-host", "127.0.0.1", "--confirm-collection", "standalonequizratewindows"],
  target(local, { NODE_ENV: "production" })), /classification|restricted/i);
  await assert.rejects(rateIndexPreparation.main(["--apply", "--expected-db", database,
    "--expected-host", "127.0.0.1", "--confirm-collection", "standalonequizratewindows"],
  target(local, { NODE_ENV: "production" })), /classification|restricted/i);
  assert.equal(await QuizRateWindow.collection.countDocuments({}), before);
});

test("incomplete or malformed apply verification always fails closed with a sanitized result", async () => {
  const names = [];
  const database = "local_rate_index_test";
  const missing = { status: "INDEXES_MISSING", collection: "standalonequizratewindows",
    missing: ["one_standalone_quiz_rate_window",
    "standalone_quiz_rate_window_expiry"], existingRecords: 0 };
  let inspection = 0;
  const db = { databaseName: database,
    listCollections: () => ({ toArray: async () => [{ name: "standalonequizratewindows" }] }),
    collection: () => ({ createIndex: async (_key, options) => names.push(options.name) }) };
  const inspectIndexes = async () => { inspection += 1; return missing; };
  const result = await rateIndexPreparation.apply(db, database, { inspectIndexes });
  assert.equal(inspection, 4);
  assert.deepEqual(names, missing.missing);
  assert.equal(result.status, "APPLY_INCOMPLETE");
  assert.equal(result.verificationStatus, "INDEXES_MISSING");
  assert.deepEqual(result.created, missing.missing);
  assert.equal(JSON.stringify(result).includes("mongodb://"), false);
  const exit = rateIndexPreparation.resultExitCode;
  const ready = { status: "INDEXES_READY", collection: "standalonequizratewindows",
    missing: [], conflicts: [], unexpected: [], existingRecords: 0 };
  assert.equal(exit(true, ready), 0);
  for (const status of ["INDEXES_MISSING", "BLOCKED_FOR_REVIEW", "APPLY_INCOMPLETE", "UNKNOWN"]) {
    assert.equal(exit(true, { status }), 2);
  }
  assert.equal(exit(true, null), 2);
  assert.equal(exit(true, {}), 2);
  assert.equal(exit(true, { status: "INDEXES_READY" }), 2);
  assert.equal((await rateIndexPreparation.apply(db, database,
    { inspectIndexes: async () => ({ status: "INDEXES_READY" }) })).status, "APPLY_INCOMPLETE");
  assert.equal(exit(false, missing), 0);
  assert.equal(exit(false, { status: "UNKNOWN" }), 2);
  await assert.rejects(rateIndexPreparation.apply(db, database,
    { inspectIndexes: async () => { throw new Error("private connection detail"); } }));
  const previousExitCode = process.exitCode;
  const previousError = console.error;
  const errors = [];
  try {
    process.exitCode = 0;
    console.error = (line) => errors.push(JSON.parse(line));
    await rateIndexPreparation.runCli(["--apply"], {});
    assert.equal(process.exitCode, 1);
    assert.deepEqual(errors, [{ status: "ERROR", name: "Error", code: null }]);
    process.exitCode = 0;
    await rateIndexPreparation.runCli([], {}, async () => { throw new Error("private verification detail"); });
    assert.equal(process.exitCode, 1);
    assert.deepEqual(errors[1], { status: "ERROR", name: "Error", code: null });
  } finally {
    console.error = previousError;
    process.exitCode = previousExitCode;
  }
});
