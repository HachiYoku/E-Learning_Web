const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const Campaign = require("../models/campaignModel");
const Cleanup = require("../models/campaignAssetCleanupModel");
const { processExpiredCampaigns, recoverStaleCampaignClaims } = require("../services/campaignLifecycle");

const freePort = () => new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); }); });
const stop = (child) => new Promise((resolve) => { if (!child || child.exitCode !== null) return resolve(); const timer = setTimeout(() => child.kill("SIGKILL"), 5000); child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM"); });
const expired = new Date("2024-01-01T00:00:00.000Z");
const now = new Date("2025-01-01T00:00:00.000Z");
let mongo; let directory;

async function campaign(fields = {}) {
  const _id = new mongoose.Types.ObjectId();
  await Campaign.collection.insertOne({ _id, subject: "Retention test", message: "test", createdBy: new mongoose.Types.ObjectId(), cleanupState: "claimed", expiresAt: expired, createdAt: expired, updatedAt: expired, ...fields });
  return _id;
}

before(async () => {
  const port = await freePort(); directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-recovery-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000); mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } }); mongo.once("error", reject); });
  await initiateReplicaSet(port); await mongoose.connect(`mongodb://127.0.0.1:${port}/campaign_recovery?replicaSet=paymentTests`);
});
beforeEach(async () => { await Promise.all([Campaign.deleteMany({}), Cleanup.deleteMany({})]); });
after(async () => { await mongoose.disconnect(); await stop(mongo); if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });

test("normal campaign workers never steal a stale claimed campaign", async () => {
  const id = await campaign();
  assert.deepEqual(await processExpiredCampaigns({ now }), []);
  assert.ok(await Campaign.exists({ _id: id, cleanupState: "claimed" }));
});

test("campaign recovery requires writers to be stopped", async () => {
  await campaign();
  await assert.rejects(recoverStaleCampaignClaims(), /writersStopped/);
  assert.equal(await Campaign.countDocuments(), 1);
});

test("campaign recovery handles only expired claimed records and finalizes no-image records conservatively", async () => {
  const eligible = await campaign();
  const future = await campaign({ expiresAt: new Date("2026-01-01T00:00:00.000Z") });
  const active = await campaign({ cleanupState: "active" });
  assert.equal(await recoverStaleCampaignClaims({ writersStopped: true, now }), 1);
  assert.equal(await Campaign.exists({ _id: eligible }), null);
  assert.ok(await Campaign.exists({ _id: future, cleanupState: "claimed" }));
  assert.ok(await Campaign.exists({ _id: active, cleanupState: "active" }));
});

test("campaign recovery creates one durable cleanup job for an eligible owned image and preserves existing work", async () => {
  const publicId = "english_kafe/campaigns/recovery-image";
  const id = await campaign({ imagePublicId: publicId });
  assert.equal(await recoverStaleCampaignClaims({ writersStopped: true, now }), 1);
  const job = await Cleanup.findOne({ publicId });
  assert.ok(job); assert.equal(String(job.campaignId), String(id)); assert.equal(job.removeCampaign, true);
  assert.equal(await recoverStaleCampaignClaims({ writersStopped: true, now }), 0);
  assert.equal(await Cleanup.countDocuments({ publicId }), 1);
  assert.ok(await Campaign.exists({ _id: id, cleanupState: "claimed" }));
});

test("campaign recovery leaves unrelated or non-expired work untouched and is repeat-safe", async () => {
  const nonOwned = await campaign({ imagePublicId: "external/campaign-image" });
  const future = await campaign({ imagePublicId: "english_kafe/campaigns/future", expiresAt: new Date("2026-01-01T00:00:00.000Z") });
  await Cleanup.create({ campaignId: future, publicId: "english_kafe/campaigns/existing", removeCampaign: true });
  await recoverStaleCampaignClaims({ writersStopped: true, now });
  await recoverStaleCampaignClaims({ writersStopped: true, now });
  assert.ok(await Campaign.exists({ _id: nonOwned, cleanupState: "claimed" }));
  assert.ok(await Campaign.exists({ _id: future, cleanupState: "claimed" }));
  assert.equal(await Cleanup.countDocuments({ publicId: "english_kafe/campaigns/future" }), 0);
  assert.equal(await Cleanup.countDocuments({ publicId: "english_kafe/campaigns/existing" }), 1);
});

test("campaign recovery command applies the production retention guard before connecting or mutating", () => {
  const script = path.join(__dirname, "../scripts/cleanupExpiredCampaigns.js");
  const result = spawnSync(process.execPath, [script, "--recover-stale-claims", "--writers-stopped"], { env: { ...process.env, MONGO_DB: "mongodb://127.0.0.1:1/guarded_uat", RETENTION_ALLOWED_DB_NAME: "guarded_uat", RETENTION_JOBS_ENABLED: "false" }, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /RETENTION_JOBS_ENABLED=true/);
});
