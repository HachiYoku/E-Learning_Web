// This exercises exported planning/apply logic only against an ephemeral local
// mongod; the production CLI target guard is tested separately with mocks.
const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { mongo: { MongoClient } } = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const { inspect, apply } = require("../scripts/prepareProductionQuizIndexes");

let processHandle; let directory; let client; let db;

async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

before(async () => {
  const port = await freePort();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-production-index-fixture-"));
  processHandle = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port),
    "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local mongod fixture timed out")), 15000);
    processHandle.stdout.on("data", (data) => {
      if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); }
    });
    processHandle.once("error", reject);
  });
  await initiateReplicaSet(port);
  client = new MongoClient(`mongodb://127.0.0.1:${port}/production_index_fixture?replicaSet=paymentTests`);
  await client.connect();
  db = client.db("production_index_fixture");
});

after(async () => {
  if (client) await client.close();
  if (processHandle?.exitCode === null) {
    await new Promise((resolve) => { processHandle.once("exit", resolve); processHandle.kill("SIGTERM"); });
  }
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

test("real local snapshot preflight and additive apply are idempotent", async () => {
  const initial = await inspect(db, client);
  assert.equal(initial.status, "READY_FOR_ADDITIVE_APPLY");
  assert.equal(initial.transactionReady, true);
  assert.equal((await db.listCollections({}, { nameOnly: true }).toArray()).length, 0);
  const result = await apply(db, client, initial);
  assert.equal(result.status, "INDEXES_READY");
  assert.equal(result.created.length, 28);
  assert.equal((await apply(db, client, await inspect(db, client))).created.length, 0);
  assert.equal((await db.collection("quizsets").countDocuments({})), 0);
});
