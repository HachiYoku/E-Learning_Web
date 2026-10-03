const { randomUUID } = require("node:crypto");
const Payment = require("../models/paymentModel");
const { addCalendarMonths } = require("./paymentProofRetention");
const CLAIM_MS = 10 * 60 * 1000;
const DETAIL_FIELDS = ["paymentMethodSnapshot.instructions", "paymentMethodSnapshot.recipient.accountName", "paymentMethodSnapshot.recipient.accountNumber", "paymentMethodSnapshot.recipient.bankName", "paymentMethodSnapshot.recipient.phoneNumber", "paymentMethodSnapshot.recipient.referenceHint", "paymentMethodSnapshot.qrImage.url", "paymentMethodSnapshot.qrImage.publicId"];
const deadline = (payment) => ["approved", "rejected"].includes(payment?.status) && payment.reviewedAt ? addCalendarMonths(payment.reviewedAt, 12) : null;
const eligible = (payment, now = new Date()) => Boolean(deadline(payment) && deadline(payment) <= now && !payment.proofRetentionHold?.active);
const detailQuery = { $or: DETAIL_FIELDS.map((field) => ({ [field]: { $exists: true, $ne: "" } })) };
async function processPaymentSnapshotMinimization({ limit = 50, now = new Date() } = {}) {
  const results = [];
  for await (const payment of Payment.find({ status: { $in: ["approved", "rejected"] }, reviewedAt: { $lte: now }, "proofRetentionHold.active": { $ne: true }, "proofRetentionCleanupClaim.token": { $exists: false }, "paymentMethodSnapshotMinimizationClaim.token": { $exists: false }, "paymentFinalDeletionClaim.token": { $exists: false }, ...detailQuery }).select("+proofRetentionHold +proofRetentionCleanupClaim +paymentMethodSnapshotMinimizationClaim +paymentFinalDeletionClaim").limit(limit)) {
    if (!eligible(payment, now)) continue;
    const token = randomUUID(); const claim = { token, claimedAt: now, expiresAt: new Date(now.getTime() + CLAIM_MS) };
    const claimed = await Payment.findOneAndUpdate({ _id: payment._id, status: { $in: ["approved", "rejected"] }, reviewedAt: payment.reviewedAt, "proofRetentionHold.active": { $ne: true }, "proofRetentionCleanupClaim.token": { $exists: false }, "paymentMethodSnapshotMinimizationClaim.token": { $exists: false }, "paymentFinalDeletionClaim.token": { $exists: false }, ...detailQuery }, { $set: { paymentMethodSnapshotMinimizationClaim: claim } }, { returnDocument: "after" });
    if (!claimed) continue;
    const unset = Object.fromEntries([...DETAIL_FIELDS, "paymentMethodSnapshotMinimizationClaim"].map((field) => [field, 1]));
    const result = await Payment.updateOne({ _id: payment._id, "paymentMethodSnapshotMinimizationClaim.token": token, "proofRetentionHold.active": { $ne: true }, "proofRetentionCleanupClaim.token": { $exists: false }, "paymentFinalDeletionClaim.token": { $exists: false } }, { $unset: unset });
    results.push(result.modifiedCount ? "minimized" : "preserved");
  }
  return results;
}
async function recoverStalePaymentSnapshotClaims({ now = new Date() } = {}) { const result = await Payment.updateMany({ "paymentMethodSnapshotMinimizationClaim.expiresAt": { $lte: now }, "paymentFinalDeletionClaim.token": { $exists: false } }, { $unset: { paymentMethodSnapshotMinimizationClaim: 1 } }); return result.modifiedCount; }
module.exports = { DETAIL_FIELDS, deadline, eligible, processPaymentSnapshotMinimization, recoverStalePaymentSnapshotClaims };
