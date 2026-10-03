const { randomUUID } = require("node:crypto");
const Payment = require("../models/paymentModel");
const Enrollment = require("../models/enrollmentModel");
const PromoRedemption = require("../models/promoRedemptionModel");
const PromoCode = require("../models/promoCodeModel");
const PaymentProofCleanup = require("../models/paymentProofCleanupModel");
const PaymentProofRetentionCleanup = require("../models/paymentProofRetentionCleanupModel");
const ReceiptDelivery = require("../models/receiptDeliveryModel");
const { paymentTransaction } = require("./paymentTransaction");
const { addCalendarMonths } = require("./paymentProofRetention");

const TERMINAL = ["approved", "rejected"];
const FINAL_CLAIM_FIELDS = "+proofRetentionHold +proofRetentionCleanupClaim +paymentMethodSnapshotMinimizationClaim +paymentFinalDeletionClaim +receiptEmailReservation +paymentImage +paymentImagePublicId +paymentProofPublicId +paymentProofFormat +paymentProofStorage";

const addCalendarYears = (date, years) => addCalendarMonths(date, years * 12);
const deadline = (payment) => payment?.createdAt && TERMINAL.includes(payment.status) ? addCalendarYears(payment.createdAt, 7) : null;
const retentionEligible = (payment, now = new Date()) => Boolean(deadline(payment) && deadline(payment) <= now && !payment.proofRetentionHold?.active);
const noCurrentProof = {
  paymentProofPublicId: { $in: [null, ""] },
  paymentImagePublicId: { $in: [null, ""] },
  paymentImage: { $in: [null, ""] },
};
const receiptReservationAvailable = (now = new Date()) => ({
  $or: [
    { "receiptEmailReservation.token": { $exists: false } },
    { "receiptEmailReservation.state": "rendering", "receiptEmailReservation.renderDeadlineAt": { $lte: now } },
  ],
});
const availableClaim = {
  "proofRetentionHold.active": { $ne: true },
  "proofRetentionCleanupClaim.token": { $exists: false },
  "paymentMethodSnapshotMinimizationClaim.token": { $exists: false },
  "paymentFinalDeletionClaim.token": { $exists: false },
  ...noCurrentProof,
};
const claimedEligibility = {
  "proofRetentionHold.active": { $ne: true },
  "proofRetentionCleanupClaim.token": { $exists: false },
  "paymentMethodSnapshotMinimizationClaim.token": { $exists: false },
  ...noCurrentProof,
};

async function releaseClaim(paymentId, token) {
  await Payment.updateOne({ _id: paymentId, "paymentFinalDeletionClaim.token": token }, { $unset: { paymentFinalDeletionClaim: 1 } });
}

async function acquireClaim(payment, now) {
  const token = randomUUID();
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: TERMINAL }, createdAt: payment.createdAt, ...availableClaim, ...receiptReservationAvailable(now) },
    { $set: { paymentFinalDeletionClaim: { token, claimedAt: now } } },
    { returnDocument: "after" },
  ).select(FINAL_CLAIM_FIELDS).read("primary").readConcern("majority");
  return claimed ? { payment: claimed, token } : null;
}

async function relatedRedemption(payment, session) {
  const alternatives = [];
  if (payment.promoRedemptionId) alternatives.push({ _id: payment.promoRedemptionId });
  alternatives.push({ paymentId: payment._id });
  const redemptions = await PromoRedemption.find({ $or: alternatives }).session(session);
  if (!payment.promoRedemptionId && !redemptions.length) return { redemption: null };
  if (redemptions.length !== 1 || !payment.promoRedemptionId) return { inconsistent: "promo_redemption_link_missing_or_multiple" };
  const [redemption] = redemptions;
  if (String(redemption._id) !== String(payment.promoRedemptionId)
    || String(redemption.paymentId) !== String(payment._id)
    || String(redemption.userId) !== String(payment.userId)
    || !payment.promoCode) return { inconsistent: "promo_redemption_link_mismatch" };
  const promo = await PromoCode.findById(redemption.promoCode).select("code").session(session);
  if (!promo || promo.code !== payment.promoCode) return { inconsistent: "promo_redemption_promo_mismatch" };
  return { redemption };
}

async function legacyProofCleanupExists(payment, session) {
  const publicIds = [payment.paymentProofPublicId, payment.paymentImagePublicId].filter(Boolean);
  return publicIds.length ? PaymentProofCleanup.exists({ publicId: { $in: publicIds } }).session(session) : false;
}

async function deleteClaimedPayment(claim, { now = new Date(), forceFailure = false } = {}) {
  try {
    const outcome = await paymentTransaction(async (session) => {
      const payment = await Payment.findOne({ _id: claim.payment._id, status: { $in: TERMINAL }, "paymentFinalDeletionClaim.token": claim.token, ...claimedEligibility, ...receiptReservationAvailable(now) }).select(FINAL_CLAIM_FIELDS).session(session);
      if (!payment || !retentionEligible(payment, now)) return { preserved: true, reason: "eligibility_changed" };
      if (await PaymentProofRetentionCleanup.exists({ paymentId: payment._id }).session(session)) return { preserved: true, reason: "proof_retention_cleanup_pending" };
      if (await legacyProofCleanupExists(payment, session)) return { preserved: true, reason: "legacy_proof_cleanup_pending" };
      const relation = await relatedRedemption(payment, session);
      if (relation.inconsistent) return { preserved: true, reason: relation.inconsistent };
      // paymentId is informational only; entitlement is the Enrollment itself.
      await Enrollment.updateMany({ paymentId: payment._id }, { $unset: { paymentId: 1 } }, { session });
      if (relation.redemption) await PromoRedemption.deleteOne({ _id: relation.redemption._id, paymentId: payment._id }, { session });
      await ReceiptDelivery.deleteMany({ paymentId: payment._id }).session(session);
      if (forceFailure) throw new Error("forced final-retention transaction failure");
      const removed = await Payment.deleteOne({ _id: payment._id, "paymentFinalDeletionClaim.token": claim.token }, { session });
      if (removed.deletedCount !== 1) throw new Error("final payment deletion lost its claim");
      return { deleted: true };
    });
    if (!outcome.deleted) await releaseClaim(claim.payment._id, claim.token);
    return outcome;
  } catch (error) {
    await releaseClaim(claim.payment._id, claim.token);
    return { retryable: true, reason: String(error.message || "final_payment_deletion_failed").slice(0, 200) };
  }
}

async function processExpiredPayments({ limit = 50, now = new Date() } = {}) {
  const results = [];
  for await (const payment of Payment.find({ status: { $in: TERMINAL }, createdAt: { $lte: now }, "paymentFinalDeletionClaim.token": { $exists: false } }).sort({ createdAt: 1, _id: 1 }).select(FINAL_CLAIM_FIELDS).limit(limit)) {
    if (!retentionEligible(payment, now)) continue;
    const claim = await acquireClaim(payment, now);
    results.push(claim ? await deleteClaimedPayment(claim, { now }) : { preserved: true, reason: "claim_unavailable" });
  }
  return results;
}

async function inspectExpiredPayments({ limit = 50, now = new Date() } = {}) {
  const results = [];
  for await (const payment of Payment.find({}).sort({ createdAt: 1, _id: 1 }).select(FINAL_CLAIM_FIELDS).limit(limit)) {
    let reason = "eligible";
    if (!TERMINAL.includes(payment.status)) reason = "non_terminal";
    else if (!deadline(payment) || deadline(payment) > now) reason = "too_young";
    else if (payment.proofRetentionHold?.active) reason = "active_hold";
    else if (payment.proofRetentionCleanupClaim?.token || payment.paymentMethodSnapshotMinimizationClaim?.token || payment.paymentFinalDeletionClaim?.token) reason = "conflicting_claim";
    else if (payment.receiptEmailReservation
      && !(payment.receiptEmailReservation.state === "rendering" && payment.receiptEmailReservation.renderDeadlineAt <= now)) reason = "receipt_reservation_active";
    else if (payment.paymentProofPublicId || payment.paymentImagePublicId || payment.paymentImage) reason = "proof_dependency";
    else if (await PaymentProofRetentionCleanup.exists({ paymentId: payment._id })) reason = "proof_cleanup_dependency";
    else {
      const relation = await relatedRedemption(payment, null);
      if (relation.inconsistent) reason = relation.inconsistent;
    }
    results.push({ paymentId: String(payment._id), status: payment.status, createdAt: payment.createdAt, reason });
  }
  return results;
}

// Explicitly offline only. Normal workers never steal a paused final-delete
// claim because doing so could race its transaction or a hold operation.
async function recoverStaleFinalDeletionClaims({ writersStopped = false } = {}) {
  if (!writersStopped) throw new Error("Final-deletion claim recovery requires writersStopped: true after all backend writers are stopped.");
  const result = await Payment.updateMany({ "paymentFinalDeletionClaim.token": { $exists: true } }, { $unset: { paymentFinalDeletionClaim: 1 } });
  return result.modifiedCount;
}

module.exports = { TERMINAL, FINAL_CLAIM_FIELDS, addCalendarYears, deadline, retentionEligible, availableClaim, acquireClaim, deleteClaimedPayment, processExpiredPayments, inspectExpiredPayments, recoverStaleFinalDeletionClaims };
