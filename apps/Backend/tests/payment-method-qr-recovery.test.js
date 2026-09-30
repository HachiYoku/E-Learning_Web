const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const PaymentMethod = require("../models/paymentMethodModel");
const Cleanup = require("../models/paymentMethodQrCleanupModel");
const cloudinary = require("../config/cloudinary");
const { processPaymentMethodQrCleanup, recoverStalePaymentMethodQrClaims } = require("../services/paymentMethodQrCleanup");

const freePort = () => new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); }); });
const stop = (child) => new Promise((resolve) => { if (!child || child.exitCode !== null) return resolve(); const timer = setTimeout(() => child.kill("SIGKILL"), 5000); child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM"); });
const prefix = "arun_thai/payment_method_qr_codes/";
let mongo; let directory; let admin;

async function processing(publicId) {
  return Cleanup.create({ publicId, state: "processing", claim: { token: `claim-${Math.random()}`, claimedAt: new Date("2000-01-01T00:00:00.000Z") } });
}

before(async () => {
  const port = await freePort(); directory = await fs.mkdtemp(path.join(os.tmpdir(), "payment-method-qr-recovery-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000); mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } }); mongo.once("error", reject); });
  await initiateReplicaSet(port); await mongoose.connect(`mongodb://127.0.0.1:${port}/payment_method_qr_recovery?replicaSet=paymentTests`);
});
beforeEach(async () => { await Promise.all([PaymentMethod.deleteMany({}), Cleanup.deleteMany({})]); admin = new mongoose.Types.ObjectId(); });
after(async () => { await mongoose.disconnect(); await stop(mongo); if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });

test("normal QR cleanup never reclaims an old processing lease", async () => {
  const job = await processing(`${prefix}old-processing`);
  assert.deepEqual(await processPaymentMethodQrCleanup({ now: new Date("2025-01-01T00:00:00.000Z") }), []);
  assert.ok(await Cleanup.exists({ _id: job._id, state: "processing" }));
});

test("QR recovery requires writers to be stopped", async () => {
  await processing(`${prefix}requires-writers-stopped`);
  await assert.rejects(recoverStalePaymentMethodQrClaims(), /writersStopped/);
  assert.equal(await Cleanup.countDocuments({ state: "processing" }), 1);
});

test("current and unknown QR references are discarded without Cloudinary deletion", async () => {
  const currentId = `${prefix}current`;
  const unknownId = "untrusted/external-asset";
  await PaymentMethod.create({ name: "Current QR", currency: "THB", type: "qr", provider: "manual", qrImage: { url: "https://example.test/current.png", publicId: currentId }, createdBy: admin, updatedBy: admin });
  await processing(currentId); await processing(unknownId);
  const original = cloudinary.uploader.destroy; let destroys = 0; cloudinary.uploader.destroy = async () => { destroys += 1; return { result: "ok" }; };
  try { assert.equal(await recoverStalePaymentMethodQrClaims({ writersStopped: true }), 0); } finally { cloudinary.uploader.destroy = original; }
  assert.equal(destroys, 0);
  assert.equal(await Cleanup.exists({ publicId: currentId }), null);
  assert.equal(await Cleanup.exists({ publicId: unknownId }), null);
  assert.equal((await PaymentMethod.findOne({ "qrImage.publicId": currentId })).qrImage.publicId, currentId);
});

test("a safely unreferenced owned QR becomes pending for normal cleanup without recovery deleting it", async () => {
  const publicId = `${prefix}unreferenced`;
  const job = await processing(publicId);
  const original = cloudinary.uploader.destroy; let destroys = 0; cloudinary.uploader.destroy = async () => { destroys += 1; return { result: "ok" }; };
  try {
    assert.equal(await recoverStalePaymentMethodQrClaims({ writersStopped: true }), 1);
    assert.equal(await recoverStalePaymentMethodQrClaims({ writersStopped: true }), 0);
  } finally { cloudinary.uploader.destroy = original; }
  assert.equal(destroys, 0);
  const saved = await Cleanup.findById(job._id).select("+claim");
  assert.equal(saved.state, "pending"); assert.equal(saved.claim, undefined);
});

test("QR recovery command applies the production retention guard before connecting or mutating", () => {
  const script = path.join(__dirname, "../scripts/cleanupPaymentMethodQrs.js");
  const result = spawnSync(process.execPath, [script, "--recover-stale-claims", "--writers-stopped"], { env: { ...process.env, MONGO_DB: "mongodb://127.0.0.1:1/guarded_uat", RETENTION_ALLOWED_DB_NAME: "guarded_uat", RETENTION_JOBS_ENABLED: "false" }, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /RETENTION_JOBS_ENABLED=true/);
});
