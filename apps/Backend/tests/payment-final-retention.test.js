const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const Payment = require("../models/paymentModel");
const Enrollment = require("../models/enrollmentModel");
const PromoCode = require("../models/promoCodeModel");
const PromoRedemption = require("../models/promoRedemptionModel");
const PaymentProofCleanup = require("../models/paymentProofCleanupModel");
const PaymentProofRetentionCleanup = require("../models/paymentProofRetentionCleanupModel");
const User = require("../models/userModel");
const Course = require("../models/courseModel");
const PaymentMethod = require("../models/paymentMethodModel");
const ReceiptDelivery = require("../models/receiptDeliveryModel");
const { getMyEnrollments, checkEnrollment } = require("../controllers/enrollmentController");
const { openPaymentProofRetentionHold } = require("../controllers/paymentController");
const { addCalendarYears, retentionEligible, acquireClaim, deleteClaimedPayment, processExpiredPayments, recoverStaleFinalDeletionClaims } = require("../services/paymentFinalRetention");

const freePort = () => new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); }); });
const stop = (child) => new Promise((resolve) => { if (!child || child.exitCode !== null) return resolve(); const timer = setTimeout(() => child.kill("SIGKILL"), 5000); child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM"); });
let mongo; let directory; let admin; let student; let course;
const old = (date = new Date("2019-02-28T12:00:00Z")) => date;
const oid = () => new mongoose.Types.ObjectId();

async function payment(fields = {}) {
  const createdAt = fields.createdAt || old();
  const item = await Payment.create({ userId: fields.userId || student._id, courseId: fields.courseId || course._id, amount: 100, status: fields.status || "approved", ...fields });
  await Payment.collection.updateOne({ _id: item._id }, { $set: { createdAt, updatedAt: createdAt } });
  return Payment.findById(item._id).select("+proofRetentionHold +proofRetentionCleanupClaim +paymentMethodSnapshotMinimizationClaim +paymentFinalDeletionClaim +receiptEmailReservation +paymentProofPublicId +paymentImagePublicId +paymentImage");
}
async function validPromoPayment(extra = {}) {
  const promo = await PromoCode.create({ code: `OLD-${Math.random().toString(16).slice(2, 8)}`, discountType: "percent", discountValue: 10 });
  const record = await payment({ promoCode: promo.code, ...extra });
  const redemption = await PromoRedemption.create({ promoCode: promo._id, userId: record.userId, paymentId: record._id, active: record.status !== "rejected" });
  await Payment.updateOne({ _id: record._id }, { $set: { promoRedemptionId: redemption._id } });
  return { payment: await Payment.findById(record._id).select("+proofRetentionHold +proofRetentionCleanupClaim +paymentMethodSnapshotMinimizationClaim +paymentFinalDeletionClaim +paymentProofPublicId +paymentImagePublicId +paymentImage"), redemption };
}

before(async () => {
  const port = await freePort(); directory = await fs.mkdtemp(path.join(os.tmpdir(), "payment-final-retention-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000); mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } }); mongo.once("error", reject); });
  await initiateReplicaSet(port); await mongoose.connect(`mongodb://127.0.0.1:${port}/payment_final_retention?replicaSet=paymentTests`);
});
beforeEach(async () => {
  await Promise.all([Payment.deleteMany({}), Enrollment.deleteMany({}), PromoRedemption.deleteMany({}), PromoCode.deleteMany({}), PaymentProofCleanup.deleteMany({}), PaymentProofRetentionCleanup.deleteMany({}), ReceiptDelivery.deleteMany({}), PaymentMethod.deleteMany({}), Course.deleteMany({}), User.deleteMany({})]);
  admin = await User.create({ name: "Reviewer", email: `reviewer-${Math.random()}@test.local`, password: "test", role: "admin", isActive: true, isVerified: true });
  student = await User.create({ name: "Student", email: `student-${Math.random()}@test.local`, password: "test", isActive: true, isVerified: true });
  course = await Course.create({ title: "Retained course", price: 100, createdBy: admin._id });
});
after(async () => { await mongoose.disconnect(); await stop(mongo); if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });

test("uses seven calendar years and preserves younger, pending, and held payments", async () => {
  assert.equal(addCalendarYears(new Date("2020-02-29T10:00:00Z"), 7).toISOString(), "2027-02-28T10:00:00.000Z");
  const now = new Date("2027-02-28T10:00:00Z");
  const exact = await payment({ createdAt: new Date("2020-02-29T10:00:00Z") });
  assert.equal(retentionEligible(exact, now), true);
  const rejectedExpired = await payment({ createdAt: new Date("2020-02-28T10:00:00Z"), status: "rejected" });
  const approvedYoung = await payment({ createdAt: new Date("2021-03-01T00:00:00Z"), status: "approved" });
  const rejectedYoung = await payment({ createdAt: new Date("2021-03-01T00:00:00Z"), status: "rejected" });
  const pendingOld = await payment({ createdAt: old(), status: "pending" });
  const held = await payment({ proofRetentionHold: { active: true, reason: "dispute", openedAt: now, openedBy: admin._id } });
  const resolved = await payment({ proofRetentionHold: { active: false, reason: "dispute", openedAt: new Date("2020-01-01"), resolvedAt: now, openedBy: admin._id, resolvedBy: admin._id } });
  await processExpiredPayments({ now });
  assert.equal(await Payment.exists({ _id: exact._id }), null);
  assert.equal(await Payment.exists({ _id: rejectedExpired._id }), null);
  assert.equal(await Payment.exists({ _id: resolved._id }), null);
  for (const item of [approvedYoung, rejectedYoung, pendingOld, held]) assert.ok(await Payment.exists({ _id: item._id }));
});

test("deletes terminal Payment and valid redemption atomically while unsetting every enrollment relationship", async () => {
  const { payment: record, redemption } = await validPromoPayment();
  await ReceiptDelivery.create({ paymentId: record._id, deliveryType: "approval" });
  const otherStudent = await User.create({ name: "Other", email: `other-${Math.random()}@test.local`, password: "test", isActive: true, isVerified: true });
  const otherCourse = await Course.create({ title: "Other course", price: 100, createdBy: admin._id });
  const first = await Enrollment.create({ userId: student._id, courseId: course._id, paymentId: record._id, completedLessonIds: [oid()], lastOpenedAt: new Date("2024-01-01") });
  const second = await Enrollment.create({ userId: otherStudent._id, courseId: otherCourse._id, paymentId: record._id });
  await processExpiredPayments();
  assert.equal(await Payment.exists({ _id: record._id }), null); assert.equal(await PromoRedemption.exists({ _id: redemption._id }), null);
  assert.equal(await ReceiptDelivery.exists({ paymentId: record._id }), null);
  const savedFirst = await Enrollment.findById(first._id); const savedSecond = await Enrollment.findById(second._id);
  assert.equal(savedFirst.paymentId, undefined); assert.equal(savedSecond.paymentId, undefined);
  assert.equal(savedFirst.completedLessonIds.length, 1); assert.equal(savedFirst.lastOpenedAt.toISOString(), "2024-01-01T00:00:00.000Z");
  const response = await new Promise((resolve) => getMyEnrollments({ user: { id: student._id } }, { status() { return this; }, json: resolve }));
  assert.equal(response.length, 1); assert.equal(response[0].paymentId, undefined); assert.equal(String(response[0].courseId._id), String(course._id));
  const access = await new Promise((resolve) => checkEnrollment({ user: { id: student._id }, params: { courseId: course._id } }, { status() { return this; }, json: resolve }));
  assert.equal(access.enrolled, true);
  assert.ok(await User.exists({ _id: student._id })); assert.ok(await Course.exists({ _id: course._id })); assert.ok(await User.exists({ _id: admin._id }));
});

test("transaction failure restores payment, valid redemption, and enrollment links", async () => {
  const { payment: record, redemption } = await validPromoPayment();
  const enrollment = await Enrollment.create({ userId: student._id, courseId: course._id, paymentId: record._id });
  const claim = await acquireClaim(record, new Date()); assert.ok(claim);
  const result = await deleteClaimedPayment(claim, { forceFailure: true }); assert.equal(result.retryable, true);
  assert.ok(await Payment.exists({ _id: record._id })); assert.ok(await PromoRedemption.exists({ _id: redemption._id }));
  assert.equal(String((await Enrollment.findById(enrollment._id)).paymentId), String(record._id));
});

test("conservatively preserves inconsistent redemption records and proof/claim dependencies", async () => {
  const inconsistent = await payment({ promoRedemptionId: oid() });
  await PaymentProofRetentionCleanup.create({ paymentId: inconsistent._id, publicId: "arun_thai/payment_proofs/old", storage: "authenticated" });
  const heldByJob = await processExpiredPayments(); assert.equal(heldByJob[0].reason, "proof_retention_cleanup_pending");
  await PaymentProofRetentionCleanup.deleteMany({});
  const result = await processExpiredPayments(); assert.match(result[0].reason, /promo_redemption/); assert.ok(await Payment.exists({ _id: inconsistent._id }));
  const proofClaim = await payment({ paymentProofPublicId: "arun_thai/payment_proofs/legacy", paymentProofStorage: "authenticated" });
  await PaymentProofCleanup.create({ publicId: proofClaim.paymentProofPublicId, state: "cleanup" });
  await processExpiredPayments(); assert.ok(await Payment.exists({ _id: proofClaim._id }));
  const claimed = await payment({ proofRetentionCleanupClaim: { token: "proof", publicId: "x", storage: "authenticated", claimedAt: new Date(), expiresAt: new Date(Date.now() + 60000) } });
  const minimized = await payment({ paymentMethodSnapshotMinimizationClaim: { token: "snapshot", claimedAt: new Date(), expiresAt: new Date(Date.now() + 60000) } });
  await processExpiredPayments(); assert.ok(await Payment.exists({ _id: claimed._id })); assert.ok(await Payment.exists({ _id: minimized._id }));
});

test("active and unresolved receipt reservations defer final deletion until safely resolved", async () => {
  const now = new Date("2027-02-28T12:00:00.000Z");
  const record = await payment({ receiptEmailReservation: {
    token: "receipt-send", deliveryType: "self_service", state: "uncertain",
    startedAt: new Date("2027-02-28T11:00:00.000Z"),
  } });
  const deferred = await processExpiredPayments({ now });
  assert.equal(deferred[0].reason, "claim_unavailable");
  assert.ok(await Payment.exists({ _id: record._id }));

  await Payment.updateOne({ _id: record._id }, { $unset: { receiptEmailReservation: 1 } });
  await processExpiredPayments({ now });
  assert.equal(await Payment.exists({ _id: record._id }), null);
});

test("only one worker owns deletion, normal workers do not steal claims, and repeated runs are idempotent", async () => {
  const record = await payment();
  const [first, second] = await Promise.all([processExpiredPayments(), processExpiredPayments()]);
  assert.equal([...first, ...second].filter((item) => item.deleted).length, 1); assert.equal(await Payment.exists({ _id: record._id }), null);
  const claimed = await payment({ paymentFinalDeletionClaim: { token: "paused", claimedAt: new Date("2020-01-01") } });
  assert.deepEqual(await processExpiredPayments(), []); assert.ok(await Payment.exists({ _id: claimed._id }));
  await assert.rejects(recoverStaleFinalDeletionClaims(), /writersStopped/);
  assert.equal(await recoverStaleFinalDeletionClaims({ writersStopped: true }), 1);
  await processExpiredPayments(); assert.equal(await Payment.exists({ _id: claimed._id }), null);
});

test("a final-deletion claim wins the hold-opening race", async () => {
  const record = await payment({ paymentProofPublicId: "arun_thai/payment_proofs/hold-race", paymentProofFormat: "png", paymentProofStorage: "authenticated", paymentFinalDeletionClaim: { token: "final-owner", claimedAt: new Date() } });
  const response = await new Promise((resolve) => openPaymentProofRetentionHold({ params: { paymentId: record._id }, body: { reason: "dispute" }, user: { id: admin._id } }, { status(code) { this.code = code; return this; }, json(value) { resolve({ code: this.code, value }); } }));
  assert.equal(response.code, 409); assert.match(response.value.message, /cleanup is already in progress/i);
  const stored = await Payment.findById(record._id).select("+proofRetentionHold"); assert.equal(stored.proofRetentionHold, undefined);
});
