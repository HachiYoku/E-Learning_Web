const assert = require("node:assert/strict");
const { before, after, afterEach, test, mock } = require("node:test");
const { spawn } = require("node:child_process");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const { initiateReplicaSet } = require("./helpers/replicaSet");

process.env.JWT_SECRET = "isolated-payment-integrity-test-secret";
process.env.RESEND_API_KEY = "re_test_placeholder";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL_LOCAL = "http://localhost:5173";
process.env.ADMIN_URL_LOCAL = "http://localhost:5174";
process.env.BACKEND_URL = "http://localhost:3000";
// Only the external email delivery is replaced; routes, auth, controllers,
// transaction callbacks, indexes and database are real.
require.cache[require.resolve("../services/sendEmail")] = {
  id: require.resolve("../services/sendEmail"), filename: require.resolve("../services/sendEmail"),
  loaded: true, exports: async () => {},
};
const storage = require("../services/paymentProofStorage");
const proofs = new Set();
const deleted = [];
let uploadHook;
let cleanupFails = false;
storage.uploadPaymentProof = async (_buffer, publicId) => {
  proofs.add(publicId);
  if (uploadHook) await uploadHook();
  return { public_id: publicId, format: "png" };
};
storage.deletePaymentProof = async (publicId) => {
  if (cleanupFails) throw new Error("Simulated storage outage");
  deleted.push(publicId);
  proofs.delete(publicId);
};
const User = require("../models/userModel");
const Course = require("../models/courseModel");
const Payment = require("../models/paymentModel");
const Enrollment = require("../models/enrollmentModel");
const Promo = require("../models/promoCodeModel");
const PaymentMethod = require("../models/paymentMethodModel");
const Redemption = require("../models/promoRedemptionModel");
const Cleanup = require("../models/paymentProofCleanupModel");
const { cleanFailedProof } = require("../services/paymentProofCleanup");
let server, mongo, directory, base, admin, adminToken, mongoPort;
const password = "PaymentTestPassword123";
let serial = 0;
const token = (user) => jwt.sign({ id: String(user._id), sessionVersion: 0 }, process.env.JWT_SECRET);
const freePort = () => new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.on("error", reject);
  listener.listen(0, "127.0.0.1", () => { const port = listener.address().port; listener.close(() => resolve(port)); });
});
async function request(route, { method = "GET", body, access = adminToken } = {}) {
  const response = await fetch(base + route, {
    method, headers: { ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
async function fixture({ withPromo = true, limit = 5 } = {}) {
  const student = await User.create({ name: "Student", email: `payment-${++serial}@example.test`, password: "unused", isActive: true, isVerified: true });
  const course = await Course.create({ title: `Course ${serial}`, price: 3000, originalPrice: 3000, prices: { THB: { price: 3000, originalPrice: 3000 } }, createdBy: admin._id });
  const method = await PaymentMethod.create({ name: `THB method ${serial}`, currency: "THB", type: "qr", provider: "manual", isActive: true, createdBy: admin._id, updatedBy: admin._id });
  const promo = withPromo ? await Promo.create({ code: `INTEGRITY-${serial}`, discountType: "fixed", discountValue: 500, fixedAmounts: { THB: 500 }, usageLimit: limit }) : null;
  return { student, course, method, promo };
}
async function submit(f) {
  const body = new FormData();
  body.append("paymentProof", new Blob([Buffer.from("89504e470d0a1a0a00000000", "hex")], { type: "image/png" }), "proof.png");
  if (f.promo) body.append("promoCode", f.promo.code);
  body.append("paymentMethodId", String(f.method._id));
  body.append("courseMutationVersion", "0");
  body.append("paymentMethodMutationVersion", "0");
  body.append("amount", "1"); // Must be ignored.
  return request(`/payments/course/${f.course._id}`, { method: "POST", access: token(f.student), body });
}
const review = (id, action, access = adminToken) => request(`/payments/${id}/${action}`, {
  method: "PATCH", access, body: { adminPassword: password, rejectReason: "Wrong receipt" },
});
async function pending(f) {
  const result = await submit(f);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}
async function assertRolledBack(f, previousDeletes) {
  assert.equal(await Payment.countDocuments({ userId: f.student._id }), 0);
  assert.equal(await Redemption.countDocuments({ userId: f.student._id }), 0);
  if (f.promo) assert.equal((await Promo.findById(f.promo._id)).usageCount, 0);
  assert.equal(deleted.length, previousDeletes + 1);
  assert.equal(await Cleanup.countDocuments(), 0);
}

before(async () => {
  const port = await freePort();
  mongoPort = port;
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "payment-integrity-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    mongo.stderr.on("data", () => {});
    mongo.once("error", reject);
  });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/payment_integrity?replicaSet=paymentTests`);
  const app = express();
  app.use(express.json());
  app.use("/payments", require("../routes/payment"));
  app.use("/promo-codes", require("../routes/promoCode"));
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  admin = await User.create({ name: "Admin", email: "integrity-admin@example.test", password: await bcrypt.hash(password, 4), role: "admin", isActive: true, isVerified: true });
  adminToken = token(admin);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => { mock.restoreAll(); uploadHook = undefined; cleanupFails = false; });
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo && mongo.exitCode === null) await new Promise((resolve) => {
    const timer = setTimeout(() => mongo.kill("SIGKILL"), 5000);
    mongo.once("exit", () => { clearTimeout(timer); resolve(); }); mongo.kill("SIGTERM");
  });
  if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test("real multipart submission creates linked records and approval commits enrollment", async () => {
  const f = await fixture();
  const payment = await pending(f);
  assert.equal(payment.amount, 2500);
  assert.equal(payment.originalAmount, 3000);
  const redemption = await Redemption.findById(payment.promoRedemptionId);
  assert.equal(String(redemption.paymentId), payment._id);
  assert.equal((await Promo.findById(f.promo._id)).usageCount, 1);
  const result = await review(payment._id, "approve");
  assert.equal(result.status, 200);
  assert.equal((await Payment.findById(payment._id)).status, "approved");
  assert.ok(await Enrollment.exists({ userId: f.student._id, courseId: f.course._id, paymentId: payment._id }));
  assert.equal((await Redemption.findById(redemption._id)).active, true);
});

test("enrollment failure after its database write rolls back approval and enrollment", async () => {
  const f = await fixture();
  const payment = await pending(f);
  const original = Enrollment.findOneAndUpdate.bind(Enrollment);
  mock.method(Enrollment, "findOneAndUpdate", async (...args) => {
    await original(...args); throw new Error("Injected failure after enrollment insert");
  });
  assert.equal((await review(payment._id, "approve")).status, 500);
  const record = await Payment.findById(payment._id);
  assert.equal(record.status, "pending");
  assert.equal(record.reviewedBy, undefined);
  assert.equal(await Enrollment.countDocuments({ userId: f.student._id }), 0);
  assert.equal((await Promo.findById(f.promo._id)).usageCount, 1);
  mock.restoreAll();
  assert.equal((await review(payment._id, "approve")).status, 200);
});

for (const actions of [["approve", "approve"], ["approve", "reject"], ["reject", "reject"]]) {
  test(`concurrent ${actions.join("/")} has exactly one terminal winner`, async () => {
    const f = await fixture();
    const payment = await pending(f);
    const other = await User.create({ name: "Other admin", email: `other-${++serial}@example.test`, password: await bcrypt.hash(password, 4), role: "admin", isActive: true, isVerified: true });
    const results = await Promise.all([review(payment._id, actions[0]), review(payment._id, actions[1], token(other))]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const record = await Payment.findById(payment._id);
    const approved = record.status === "approved";
    assert.equal(await Enrollment.countDocuments({ userId: f.student._id }), approved ? 1 : 0);
    assert.equal((await Promo.findById(f.promo._id)).usageCount, approved ? 1 : 0);
    assert.equal((await Redemption.findById(payment.promoRedemptionId)).active, approved);
  });
}

test("rejection preserves snapshots and redemption evidence and permits eligible reuse", async () => {
  const f = await fixture({ limit: 1 });
  const payment = await pending(f);
  assert.equal((await review(payment._id, "reject")).status, 200);
  const record = await Payment.findById(payment._id);
  assert.equal(record.amount, 2500);
  assert.equal(record.originalAmount, 3000);
  assert.equal(record.discountAmount, 500);
  assert.equal(record.promoCode, f.promo.code);
  const released = await Redemption.findById(payment.promoRedemptionId);
  assert.equal(released.active, false);
  assert.ok(released.releasedAt);
  assert.equal(released.releaseReason, "payment_rejected");
  const again = await pending(f);
  assert.notEqual(again.promoRedemptionId, payment.promoRedemptionId);
  assert.equal(await Redemption.countDocuments({ userId: f.student._id }), 2);
  assert.equal((await Promo.findById(f.promo._id)).usageCount, 1);
});

test("promo becoming inactive after proof upload cleans the proof without consuming capacity", async () => {
  const f = await fixture();
  const before = deleted.length;
  uploadHook = () => Promo.updateOne({ _id: f.promo._id }, { isActive: false });
  assert.equal((await submit(f)).status, 400);
  await assertRolledBack(f, before);
});

test("upload failure cleans even an externally created asset using its predetermined ID", async () => {
  const f = await fixture();
  const before = deleted.length;
  uploadHook = async () => { throw new Error("Upload response lost"); };
  assert.equal((await submit(f)).status, 500);
  await assertRolledBack(f, before);
});

test("failure after reservation increment rolls back promo and cleans proof", async () => {
  const f = await fixture();
  const before = deleted.length;
  mock.method(Redemption, "create", async () => { throw new Error("Redemption insert failed"); });
  assert.equal((await submit(f)).status, 500);
  await assertRolledBack(f, before);
});

test("Payment insertion failure rolls back reservation and proof", async () => {
  const f = await fixture();
  const before = deleted.length;
  mock.method(Payment, "create", async () => { throw new Error("Payment insert failed"); });
  assert.equal((await submit(f)).status, 500);
  await assertRolledBack(f, before);
});

test("failure after Payment insertion rolls back payment, linked redemption and capacity", async () => {
  const f = await fixture();
  const before = deleted.length;
  const original = Payment.create.bind(Payment);
  mock.method(Payment, "create", async (...args) => {
    await original(...args); throw new Error("Injected failure after Payment creation");
  });
  assert.equal((await submit(f)).status, 500);
  await assertRolledBack(f, before);
});

test("failed proof deletion remains durable for retry after a failed submission", async () => {
  const f = await fixture();
  cleanupFails = true;
  mock.method(Payment, "create", async () => { throw new Error("Payment insert failed"); });
  assert.equal((await submit(f)).status, 500);
  const job = await Cleanup.findOne({ state: "cleanup" });
  assert.ok(job);
  assert.ok(proofs.has(job.publicId));
  assert.equal((await Promo.findById(f.promo._id)).usageCount, 0);
  cleanupFails = false;
  await cleanFailedProof(job.publicId);
  assert.equal(await Cleanup.countDocuments(), 0);
  assert.equal(proofs.has(job.publicId), false);
});

test("simultaneous submissions cannot consume the final promo slot twice", async () => {
  const f = await fixture({ limit: 1 });
  const other = await fixture({ withPromo: false });
  other.promo = f.promo;
  const results = await Promise.all([submit(f), submit(other)]);
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal((await Promo.findById(f.promo._id)).usageCount, 1);
  assert.equal(await Redemption.countDocuments({ promoCode: f.promo._id, active: true }), 1);
});

test("duplicate same-user submissions retain exactly one payment, reservation and proof", async () => {
  const f = await fixture();
  const results = await Promise.all([submit(f), submit(f)]);
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(await Payment.countDocuments({ userId: f.student._id }), 1);
  assert.equal((await Promo.findById(f.promo._id)).usageCount, 1);
  assert.equal(await Redemption.countDocuments({ promoCode: f.promo._id }), 1);
  const saved = await Payment.findOne({ userId: f.student._id }).select("+paymentProofPublicId");
  assert.ok(proofs.has(saved.paymentProofPublicId));
});

test("promo edit racing first use cannot repurpose a redeemed offer", async () => {
  const f = await fixture();
  const results = await Promise.all([
    submit(f),
    request(`/promo-codes/admin/${f.promo._id}`, { method: "PUT", body: { ...f.promo.toObject(), discountValue: 800, adminPassword: password } }),
  ]);
  assert.equal(results[0].status, 201);
  const saved = await Promo.findById(f.promo._id);
  const payment = await Payment.findById(results[0].body._id);
  assert.equal(payment.discountAmount, saved.fixedAmounts?.THB ?? saved.discountValue);
  assert.ok([200, 400].includes(results[1].status));
});

test("delete racing first use either removes an unused promo or archives retained history", async () => {
  const f = await fixture();
  const [submitted, removed] = await Promise.all([
    submit(f),
    request(`/promo-codes/admin/${f.promo._id}`, { method: "DELETE", body: { adminPassword: password } }),
  ]);
  assert.equal(removed.status, 200);
  if (submitted.status === 201) {
    assert.ok((await Promo.findById(f.promo._id)).archivedAt);
    assert.ok(await Redemption.exists({ promoCode: f.promo._id }));
  } else {
    assert.equal(submitted.status, 400);
    assert.equal(await Payment.countDocuments({ userId: f.student._id }), 0);
    assert.equal(await Redemption.countDocuments({ promoCode: f.promo._id }), 0);
  }
});

test("notification failure after commit never rolls back a payment or enrollment", async () => {
  const f = await fixture();
  const Notification = require("../models/notificationModel");
  mock.method(Notification, "create", async () => { throw new Error("Notification unavailable"); });
  const payment = await pending(f);
  assert.equal((await review(payment._id, "approve")).status, 200);
  assert.ok(await Enrollment.exists({ paymentId: payment._id }));
  assert.equal((await Payment.findById(payment._id)).status, "approved");
});

test("rejection failure after releasing capacity rolls back status and redemption together", async () => {
  const f = await fixture();
  const payment = await pending(f);
  const original = Promo.updateOne.bind(Promo);
  mock.method(Promo, "updateOne", async (...args) => {
    await original(...args); throw new Error("Failure after capacity release");
  });
  assert.equal((await review(payment._id, "reject")).status, 500);
  assert.equal((await Payment.findById(payment._id)).status, "pending");
  assert.equal((await Redemption.findById(payment.promoRedemptionId)).active, true);
  assert.equal((await Promo.findById(f.promo._id)).usageCount, 1);
  mock.restoreAll();
  assert.equal((await review(payment._id, "reject")).status, 200);
});

test("commit acknowledgement failure does not delete a committed payment proof or release capacity", async () => {
  const f = await fixture();
  const original = mongoose.connection.transaction.bind(mongoose.connection);
  mock.method(mongoose.connection, "transaction", async (...args) => {
    await original(...args);
    const error = new Error("Commit acknowledgement lost");
    error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
    throw error;
  });
  const before = deleted.length;
  assert.equal((await submit(f)).status, 503);
  const payment = await Payment.findOne({ userId: f.student._id }).select("+paymentProofPublicId");
  assert.ok(payment);
  assert.ok(proofs.has(payment.paymentProofPublicId));
  assert.equal(deleted.length, before);
  assert.equal((await Promo.findById(f.promo._id)).usageCount, 1);
  assert.equal((await Redemption.findById(payment.promoRedemptionId)).active, true);
});

test("unknown transaction result without a commit retains proof for offline reconciliation", async () => {
  const f = await fixture();
  mock.method(mongoose.connection, "transaction", async () => {
    const error = new Error("Transaction outcome unavailable");
    error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
    throw error;
  });
  assert.equal((await submit(f)).status, 503);
  const job = await Cleanup.findOne({ state: "uncertain" });
  assert.ok(job);
  await cleanFailedProof(job.publicId);
  assert.ok(proofs.has(job.publicId));
  assert.equal(await Payment.countDocuments({ userId: f.student._id }), 0);
  // Test teardown simulates offline operator verification, not a runtime retry.
  await Cleanup.updateOne({ _id: job._id }, { state: "cleanup" });
  await cleanFailedProof(job.publicId);
});

test("submission without a promo also rolls back after Payment insertion fails", async () => {
  const f = await fixture({ withPromo: false });
  const before = deleted.length;
  const original = Payment.create.bind(Payment);
  mock.method(Payment, "create", async (...args) => {
    await original(...args); throw new Error("Failure after non-promo Payment insert");
  });
  assert.equal((await submit(f)).status, 500);
  await assertRolledBack(f, before);
});

test("migration preserves legacy snapshots, releases rejected history and replaces only the obsolete index", async () => {
  const db = mongoose.connection.client.db("integrity_migration_test");
  const promoId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const redemptionId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  await db.collection("promocodes").insertOne({ _id: promoId, code: "LEGACY", usageCount: 1 });
  const snapshot = { _id: paymentId, userId, promoCode: "LEGACY", promoRedemptionId: redemptionId, amount: 2500, originalAmount: 3000, discountAmount: 500, status: "rejected", reviewedAt: new Date() };
  await db.collection("payments").insertOne(snapshot);
  await db.collection("promoredemptions").insertOne({ _id: redemptionId, userId, promoCode: promoId, paymentId });
  await db.collection("promoredemptions").createIndex({ promoCode: 1, userId: 1 }, { unique: true });
  await db.collection("promoredemptions").createIndex({ paymentId: 1 }, { name: "preserve_this_index" });
  const command = promisify(execFile);
  const args = [path.resolve(__dirname, "../scripts/migratePaymentIntegrity.js")];
  const options = { env: { ...process.env, MONGO_DB: `mongodb://127.0.0.1:${mongoPort}/integrity_migration_test?replicaSet=paymentTests`, PAYMENT_INTEGRITY_EXPECTED_DB: "integrity_migration_test" } };
  await command(process.execPath, args, options);
  assert.equal((await db.collection("promoredemptions").findOne({ _id: redemptionId })).active, undefined);
  await command(process.execPath, [...args, "--apply"], options);
  await command(process.execPath, [...args, "--apply"], options);
  assert.deepEqual(await db.collection("payments").findOne({ _id: paymentId }), snapshot);
  assert.equal((await db.collection("promoredemptions").findOne({ _id: redemptionId })).active, false);
  assert.equal((await db.collection("promocodes").findOne({ _id: promoId })).usageCount, 0);
  const indexes = await db.collection("promoredemptions").indexes();
  assert.ok(indexes.some((index) => index.name === "active_promo_user_unique"));
  assert.ok(indexes.some((index) => index.name === "preserve_this_index"));
  assert.ok(!indexes.some((index) => index.name === "promoCode_1_userId_1"));
  await db.collection("promoredemptions").insertOne({ userId, promoCode: promoId, active: true });
  await assert.rejects(db.collection("promoredemptions").insertOne({ userId, promoCode: promoId, active: true }), /duplicate key/);
});

test("read-only migration reports safe identifiers for every invalid redemption without writing", async () => {
  const db = mongoose.connection.client.db("integrity_migration_diagnostics_test");
  const redemptionId = new mongoose.Types.ObjectId();
  const missingPromoId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const createdAt = new Date("2026-01-02T03:04:05.000Z");
  await db.collection("payments").insertOne({
    _id: paymentId, userId, courseId: new mongoose.Types.ObjectId(), status: "approved",
    promoCode: "REMOVED-OFFER", promoRedemptionId: redemptionId, amount: 1750, createdAt,
  });
  await db.collection("promoredemptions").insertOne({
    _id: redemptionId, promoCode: missingPromoId, userId, paymentId, active: true, createdAt,
  });
  const command = promisify(execFile);
  const args = [path.resolve(__dirname, "../scripts/migratePaymentIntegrity.js")];
  const options = { env: { ...process.env, MONGO_DB: `mongodb://127.0.0.1:${mongoPort}/integrity_migration_diagnostics_test?replicaSet=paymentTests`, PAYMENT_INTEGRITY_EXPECTED_DB: "integrity_migration_diagnostics_test" } };
  await assert.rejects(command(process.execPath, args, options), (error) => {
    const report = JSON.parse(error.stdout);
    assert.equal(report.mode, "read-only");
    assert.equal(report.summary.validationIssueCount, 1);
    assert.deepEqual(report.validationIssues[0].problems, ["missing_promo"]);
    assert.equal(report.validationIssues[0].redemptionId, String(redemptionId));
    assert.equal(report.validationIssues[0].referencedPromoId, String(missingPromoId));
    assert.equal(report.validationIssues[0].userId, String(userId));
    assert.equal(report.validationIssues[0].paymentId, String(paymentId));
    assert.equal(report.validationIssues[0].active, true);
    assert.equal(report.validationIssues[0].createdAt, createdAt.toISOString());
    assert.equal(report.validationIssues[0].paymentStatus, "approved");
    assert.equal(report.validationIssues[0].paymentPromoCode, "REMOVED-OFFER");
    assert.equal(report.validationIssues[0].paymentAmount, 1750);
    assert.match(error.stderr, /No changes were made/);
    return true;
  });
  assert.equal(await db.collection("promoredemptions").countDocuments({ _id: redemptionId }), 1);
  assert.equal(await db.collection("promocodes").countDocuments(), 0);
});
