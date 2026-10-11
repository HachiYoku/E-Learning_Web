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

let mongo; let directory;
const userId = () => new mongoose.Types.ObjectId();
const connection = () => ({ readyState: 1, db: mongoose.connection.db });
const take = (user, operation = "start", instance = connection()) =>
  consume({ userId: user, operation, connection: instance });

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
  await QuizRateWindow.collection.dropIndex("one_quiz_rate_window");
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
  const limiter = standaloneQuizRateLimit("start", async (args) => {
    assert.equal(args.userId, String(user));
    assert.equal(args.operation, "start");
    called += 1;
    return called === 1 ? { allowed: true } : { allowed: false, retryAfter: 19 };
  });
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
  await standaloneQuizRateLimit("submit", async () => { throw new Error("secret database detail"); })(
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
