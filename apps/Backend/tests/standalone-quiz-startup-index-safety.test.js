const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const connectDB = require("../config/dbConnection");
const { REQUIRED_INDEXES, inspectStandaloneRuntimeReadiness, standaloneRuntimeGate } =
  require("../services/standaloneQuizRuntimeReadiness");

let mongo; let directory;
const databaseName = "quiz_startup_index_safety";
const enabled = { STANDALONE_QUIZ_RUNTIME_ENABLED: "true", STANDALONE_QUIZ_EXPECTED_DB: databaseName };
const Quiz = require("../models/quizModel");
const QuizSession = require("../models/quizSessionModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizRateWindow = require("../models/quizRateWindowModel");
const models = [Quiz, QuizSession, QuizAttempt, QuizRateWindow];

before(async () => {
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const selected = server.address().port;
      server.close((error) => error ? reject(error) : resolve(selected));
    });
  });
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-index-startup-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory,
    "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(port);
  await connectDB(`mongodb://127.0.0.1:${port}/${databaseName}?replicaSet=paymentTests`);
});

after(async () => {
  await mongoose.disconnect();
  if (mongo && mongo.exitCode === null) {
    await new Promise((resolve) => { mongo.once("exit", resolve); mongo.kill("SIGTERM"); });
  }
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

test("application connection disables autoIndex and autoCreate before model initialization", async () => {
  assert.equal(mongoose.connection.config.autoIndex, false);
  assert.equal(mongoose.connection.config.autoCreate, false);
  // Exercise every application model, including the existing payment Model.init
  // paths, under the same connection options as normal Backend startup.
  for (const file of await fs.readdir(path.join(__dirname, "../models"))) {
    if (file.endsWith("Model.js")) require(path.join(__dirname, "../models", file));
  }
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  assert.deepEqual(collections, [], "Model loading and Model.init must not create collections or indexes");
});

test("schema index declarations remain available for separately approved preparation", () => {
  for (const [name, required] of Object.entries(REQUIRED_INDEXES)) {
    const Model = { quizsessions: QuizSession, quizattempts: QuizAttempt,
      quizratewindows: QuizRateWindow }[name];
    const declared = Model.schema.indexes().map(([keys, options]) =>
      options.name || Object.entries(keys).map(([field, direction]) => `${field}_${direction}`).join("_"));
    for (const indexName of required) assert.ok(declared.includes(indexName), `${name}.${indexName} remains declared`);
  }
});

test("absent, false, malformed and ambiguous activation configuration fail closed", async () => {
  for (const env of [{}, { STANDALONE_QUIZ_RUNTIME_ENABLED: "false" },
    { STANDALONE_QUIZ_RUNTIME_ENABLED: "TRUE", STANDALONE_QUIZ_EXPECTED_DB: databaseName },
    { STANDALONE_QUIZ_RUNTIME_ENABLED: "true" },
    { STANDALONE_QUIZ_RUNTIME_ENABLED: "true", STANDALONE_QUIZ_EXPECTED_DB: ` ${databaseName}` },
    { STANDALONE_QUIZ_RUNTIME_ENABLED: "true", STANDALONE_QUIZ_EXPECTED_DB: "another_database" }]) {
    assert.equal((await inspectStandaloneRuntimeReadiness({ env })).ready, false);
  }
});

test("an enable flag and matching database cannot bypass missing collections or indexes", async () => {
  assert.deepEqual(await inspectStandaloneRuntimeReadiness({ env: enabled }),
    { ready: false, reason: "index_readiness_unverified" });
  for (const Model of models) await Model.createCollection(); // Isolated local database only.
  assert.equal((await inspectStandaloneRuntimeReadiness({ env: enabled })).ready, false);
  for (const Model of models) await Model.syncIndexes(); // Isolated local database only.
  assert.deepEqual(await inspectStandaloneRuntimeReadiness({ env: enabled }), { ready: true });
});

test("a missing required index fails closed even with activation configured", async () => {
  await QuizRateWindow.collection.dropIndex("one_quiz_rate_window"); // Isolated local database only.
  assert.deepEqual(await inspectStandaloneRuntimeReadiness({ env: enabled }),
    { ready: false, reason: "index_readiness_unverified" });
  await QuizRateWindow.syncIndexes();
});

test("transaction verification failure fails closed", async () => {
  const connection = mongoose.connection;
  const original = connection.startSession;
  connection.startSession = async () => { throw new Error("injected transaction failure"); };
  try {
    assert.deepEqual(await inspectStandaloneRuntimeReadiness({ connection, env: enabled }),
      { ready: false, reason: "readiness_unverified" });
  } finally {
    connection.startSession = original;
  }
});

test("the reusable gate returns a sanitized 503 when disabled and does not alter existing Quiz routes", async () => {
  let status; let body; let proceeded = false;
  const res = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
  await standaloneRuntimeGate({ env: {} })({}, res, () => { proceeded = true; });
  assert.equal(status, 503);
  assert.deepEqual(body, { code: "standalone_runtime_unavailable",
    message: "General Practice is temporarily unavailable." });
  assert.equal(proceeded, false);
  const router = require("../routes/quiz");
  const paths = router.stack.map((layer) => layer.route?.path).filter(Boolean);
  for (const existing of ["/standalone", "/standalone/:quizId", "/course/:courseId/lesson/:lessonId",
    "/course/:courseId", "/:quizId/sessions", "/:quizId/submit"]) assert.ok(paths.includes(existing));
  assert.equal(paths.some((entry) => entry.startsWith("/standalone/") &&
    (entry.endsWith("/sessions") || entry.endsWith("/submit"))), false);
});
