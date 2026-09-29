const Payment = require("../models/paymentModel");
const PaymentProofRetentionCleanup = require("../models/paymentProofRetentionCleanupModel");
const { deletePaymentProof } = require("./paymentProofStorage");
const { randomUUID } = require("node:crypto");

const PAYMENT_PROOF_FIELDS = "+paymentImage +paymentImagePublicId +paymentProofPublicId +paymentProofFormat +paymentProofStorage +proofRetentionHold +proofRetentionCleanupClaim";
const TERMINAL_STATUSES = new Set(["approved", "rejected"]);
const PROOF_CLEANUP_CLAIM_MS = 10 * 60 * 1000;

function addCalendarMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  return result;
}

function paymentProofRetentionDeadline(payment) {
  if (!TERMINAL_STATUSES.has(payment?.status) || !payment?.reviewedAt) return null;
  return addCalendarMonths(payment.reviewedAt, 12);
}

function isPaymentProofRetentionEligible(payment, now = new Date()) {
  const deadline = paymentProofRetentionDeadline(payment);
  return Boolean(deadline && deadline <= now && !payment.proofRetentionHold?.active);
}

function expectedPaymentProof(payment) {
  if (payment?.paymentProofPublicId) return { publicId: payment.paymentProofPublicId, storage: "authenticated" };
  // A legacy URL without its exact public ID is not safe to delete. It is left
  // untouched for a separately reviewed recovery path.
  if (payment?.paymentImagePublicId) return { publicId: payment.paymentImagePublicId, storage: "legacy" };
  return null;
}

function retryAt(attempts, now = new Date()) {
  return new Date(now.getTime() + Math.min(24 * 60 * 60 * 1000, 60 * 1000 * (2 ** Math.min(attempts, 10))));
}

function expectedProofQuery(proof) {
  return proof.storage === "authenticated"
    ? { paymentProofPublicId: proof.publicId, paymentProofStorage: "authenticated" }
    : { paymentImagePublicId: proof.publicId, paymentProofStorage: { $in: ["legacy", null] } };
}

function claimAvailableQuery() {
  return { "proofRetentionCleanupClaim.token": { $exists: false } };
}

async function releasePaymentProofRetentionClaim(paymentId, token) {
  await Payment.updateOne(
    { _id: paymentId, "proofRetentionCleanupClaim.token": token },
    { $unset: { proofRetentionCleanupClaim: 1 } },
  );
}

async function acquirePaymentProofRetentionClaim(job, payment, proof, now) {
  const token = randomUUID();
  const claimedAt = new Date(now);
  const claim = { token, publicId: proof.publicId, storage: proof.storage, claimedAt, expiresAt: new Date(claimedAt.getTime() + PROOF_CLEANUP_CLAIM_MS) };
  const claimed = await Payment.findOneAndUpdate({
    _id: payment._id,
    status: { $in: [...TERMINAL_STATUSES] },
    reviewedAt: payment.reviewedAt,
    "proofRetentionHold.active": { $ne: true },
    ...expectedProofQuery(proof),
    ...claimAvailableQuery(),
  }, { $set: { proofRetentionCleanupClaim: claim } }, { returnDocument: "after" }).select(PAYMENT_PROOF_FIELDS).read("primary").readConcern("majority");
  return claimed ? { payment: claimed, token } : null;
}

async function queuePaymentProofRetentionCleanup(payment) {
  const proof = expectedPaymentProof(payment);
  if (!proof || !isPaymentProofRetentionEligible(payment)) return { queued: false };
  await PaymentProofRetentionCleanup.updateOne(
    { publicId: proof.publicId },
    { $setOnInsert: { paymentId: payment._id, publicId: proof.publicId, storage: proof.storage, state: "pending", attempts: 0 } },
    { upsert: true },
  );
  return { queued: true, ...proof };
}

async function processPaymentProofRetentionCleanup(job, { now = new Date() } = {}) {
  const payment = await Payment.findById(job.paymentId).select(PAYMENT_PROOF_FIELDS).read("primary").readConcern("majority");
  const proof = expectedPaymentProof(payment);
  if (!payment || !proof || proof.publicId !== job.publicId || proof.storage !== job.storage) {
    await job.deleteOne();
    return { cleaned: false, preserved: true, reason: "reference_changed" };
  }
  if (!isPaymentProofRetentionEligible(payment, now)) {
    // The job remains durable while a proof is pending review or an active
    // operational hold; a later explicit command run rechecks it.
    return { cleaned: false, preserved: true, reason: "not_eligible" };
  }

  // This conditional update is the cross-process destructive boundary. A hold
  // can only be opened when no live claim exists, and an active hold prevents
  // this claim from being acquired.
  const acquired = await acquirePaymentProofRetentionClaim(job, payment, proof, now);
  if (!acquired) return { cleaned: false, preserved: true, reason: "claim_unavailable" };
  const claimedPayment = acquired.payment;
  const claimFilter = {
    _id: claimedPayment._id,
    "proofRetentionCleanupClaim.token": acquired.token,
    ...expectedProofQuery(proof),
  };
  const stillOwned = await Payment.exists(claimFilter).read("primary").readConcern("majority");
  if (!stillOwned) {
    await releasePaymentProofRetentionClaim(claimedPayment._id, acquired.token);
    return { cleaned: false, preserved: true, reason: "claim_lost" };
  }
  const otherPaymentReference = job.storage === "authenticated"
    ? await Payment.exists({ _id: { $ne: claimedPayment._id }, paymentProofPublicId: job.publicId })
    : await Payment.exists({ _id: { $ne: claimedPayment._id }, paymentImagePublicId: job.publicId });
  if (otherPaymentReference) {
    // Shared/incorrectly duplicated legacy data must never cause an asset that
    // another Payment still references to be removed. A future run can queue
    // this payment again once the other reference is gone.
    await releasePaymentProofRetentionClaim(claimedPayment._id, acquired.token);
    await job.deleteOne();
    return { cleaned: false, preserved: true, reason: "referenced_elsewhere" };
  }

  try {
    // Recheck ownership immediately before the irreversible external action.
    if (!await Payment.exists(claimFilter).read("primary").readConcern("majority")) {
      await releasePaymentProofRetentionClaim(claimedPayment._id, acquired.token);
      return { cleaned: false, preserved: true, reason: "claim_lost" };
    }
    await deletePaymentProof(job.publicId, { legacy: job.storage === "legacy" });
    const filter = { ...claimFilter, "proofRetentionHold.active": { $ne: true } };
    const unset = job.storage === "authenticated"
      ? { paymentProofPublicId: 1, paymentProofFormat: 1, paymentProofStorage: 1, proofRetentionCleanupClaim: 1 }
      : { paymentImage: 1, paymentImagePublicId: 1, paymentProofStorage: 1, proofRetentionCleanupClaim: 1 };
    const cleared = await Payment.updateOne(filter, { $unset: unset });
    if (!cleared.modifiedCount) throw new Error("Payment proof fields were not cleared after asset deletion");
    await job.deleteOne();
    return { cleaned: true };
  } catch (error) {
    await releasePaymentProofRetentionClaim(claimedPayment._id, acquired.token);
    job.state = "failed";
    job.attempts += 1;
    job.lastError = String(error?.message || "Payment proof retention cleanup failed").slice(0, 500);
    job.nextAttemptAt = retryAt(job.attempts, now);
    await job.save();
    return { cleaned: false, retryable: true };
  }
}

async function processExpiredPaymentProofs({ limit = 50, now = new Date() } = {}) {
  const results = [];
  // Calendar-month eligibility is rechecked in JavaScript so 29th–31st dates
  // retain their correct month-end anniversary semantics.
  for await (const payment of Payment.find({
    status: { $in: [...TERMINAL_STATUSES] },
    reviewedAt: { $exists: true, $lte: now },
    "proofRetentionHold.active": { $ne: true },
    $or: [{ paymentProofPublicId: { $exists: true, $ne: "" } }, { paymentImagePublicId: { $exists: true, $ne: "" } }],
  }).sort({ reviewedAt: 1, _id: 1 }).select(PAYMENT_PROOF_FIELDS).limit(limit)) {
    await queuePaymentProofRetentionCleanup(payment);
  }
  for await (const job of PaymentProofRetentionCleanup.find({
    $or: [{ state: "pending" }, { state: "failed", nextAttemptAt: { $lte: now } }],
  }).sort({ createdAt: 1 }).limit(limit)) {
    results.push(await processPaymentProofRetentionCleanup(job, { now }));
  }
  return results;
}

// Automatic workers never steal an expired lease: a process paused during an
// external deletion must not race a recovered worker or a newly opened hold.
// The offline script calls this only after all backend writers are stopped.
async function recoverStalePaymentProofRetentionClaims({ now = new Date() } = {}) {
  const result = await Payment.updateMany(
    { "proofRetentionCleanupClaim.expiresAt": { $lte: now } },
    { $unset: { proofRetentionCleanupClaim: 1 } },
  );
  return result.modifiedCount;
}

module.exports = {
  PROOF_CLEANUP_CLAIM_MS,
  TERMINAL_STATUSES,
  addCalendarMonths,
  expectedPaymentProof,
  isPaymentProofRetentionEligible,
  paymentProofRetentionDeadline,
  processExpiredPaymentProofs,
  processPaymentProofRetentionCleanup,
  queuePaymentProofRetentionCleanup,
  acquirePaymentProofRetentionClaim,
  claimAvailableQuery,
  expectedProofQuery,
  recoverStalePaymentProofRetentionClaims,
};
