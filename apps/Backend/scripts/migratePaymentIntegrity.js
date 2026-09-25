// Keep the read-only JSON report machine-readable (dotenv otherwise logs).
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const { assertPaymentIntegrityDatabase } = require("./paymentIntegrityDatabaseGuard");

const identifier = (value) => value == null ? null : String(value);

// These fields are intentionally limited to reconciliation identifiers and
// purchase snapshots. Do not add proof URLs, email addresses, or credentials.
function redemptionDiagnostic(redemption, payment) {
  return {
    redemptionId: identifier(redemption._id),
    referencedPromoId: identifier(redemption.promoCode),
    userId: identifier(redemption.userId),
    paymentId: identifier(redemption.paymentId),
    active: redemption.active ?? null,
    createdAt: redemption.createdAt ?? null,
    associatedPaymentId: identifier(payment?._id),
    paymentStatus: payment?.status ?? null,
    paymentPromoCode: payment?.promoCode ?? null,
    courseId: identifier(payment?.courseId),
    paymentAmount: payment?.amount ?? null,
  };
}

function paymentDiagnostic(payment) {
  return {
    paymentId: identifier(payment._id),
    userId: identifier(payment.userId),
    courseId: identifier(payment.courseId),
    paymentStatus: payment.status ?? null,
    paymentPromoCode: payment.promoCode ?? null,
    promoRedemptionId: identifier(payment.promoRedemptionId),
    paymentAmount: payment.amount ?? null,
    createdAt: payment.createdAt ?? null,
  };
}

// Stop old application instances before --apply. Never run syncIndexes here:
// only the obsolete redemption constraint is replaced.
async function main() {
  await mongoose.connect(process.env.MONGO_DB, { autoIndex: false });
  const db = mongoose.connection.db;
  assertPaymentIntegrityDatabase(db);
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("A replica set or sharded cluster is required.");
  const redemptions = db.collection("promoredemptions");
  const payments = db.collection("payments");
  const promos = db.collection("promocodes");
  const enrollments = db.collection("enrollments");
  const plan = [];
  const validationIssues = [];
  for await (const redemption of redemptions.find({})) {
    const payment = await payments.findOne({ promoRedemptionId: redemption._id })
      || (redemption.paymentId ? await payments.findOne({ _id: redemption.paymentId }) : null);
    const promo = await promos.findOne({ _id: redemption.promoCode });
    const problems = [];
    if (!payment) problems.push("missing_payment_association");
    else if (!["pending", "approved", "rejected"].includes(payment.status)) problems.push("invalid_payment_status");
    if (payment && String(payment.userId) !== String(redemption.userId)) problems.push("payment_user_mismatch");
    if (!promo) problems.push("missing_promo");
    if (payment && promo && (payment.promoCode !== promo.code || String(payment.promoRedemptionId) !== String(redemption._id))) {
      problems.push("payment_promo_or_redemption_mismatch");
    }
    if (problems.length) {
      validationIssues.push({ problems, ...redemptionDiagnostic(redemption, payment) });
    } else {
      plan.push({ redemption, payment });
    }
  }
  const approvedWithoutEnrollment = [];
  for await (const payment of payments.find({ status: "approved" })) {
    if (!await enrollments.findOne({ userId: payment.userId, courseId: payment.courseId })) {
      approvedWithoutEnrollment.push(paymentDiagnostic(payment));
    }
  }
  const retainedIds = plan.map(({ redemption }) => redemption._id);
  const paymentsWithMissingRedemptionEvidence = [];
  for await (const payment of payments.find({ promoRedemptionId: { $ne: null, $nin: retainedIds } })) {
    paymentsWithMissingRedemptionEvidence.push(paymentDiagnostic(payment));
  }
  const report = {
    mode: process.argv.includes("--apply") ? "apply-preflight" : "read-only",
    summary: {
      validRedemptions: plan.length,
      validationIssueCount: validationIssues.length,
      historicalPaymentsWithoutRedemption: paymentsWithMissingRedemptionEvidence.length,
      approvedWithoutEnrollment: approvedWithoutEnrollment.length,
    },
    validationIssues,
    historicalReview: {
      paymentsWithMissingRedemptionEvidence,
      approvedPaymentsWithoutEnrollment: approvedWithoutEnrollment,
    },
  };
  console.log(JSON.stringify(report, null, 2));
  if (validationIssues.length) {
    throw new Error(`Migration validation failed with ${validationIssues.length} record(s). No changes were made.`);
  }
  if (!process.argv.includes("--apply")) {
    console.log("Read-only check complete. Stop all application writers before rerunning with --apply.");
    return;
  }
  for (const { redemption, payment } of plan) {
    const active = payment.status !== "rejected";
    await redemptions.updateOne({ _id: redemption._id }, { $set: {
      active, paymentId: payment._id,
      ...(active ? {} : { releasedAt: redemption.releasedAt || payment.reviewedAt || payment.updatedAt, releaseReason: "payment_rejected" }),
    } });
  }
  // Recompute current capacity, not lifetime usage. Keep every historical row.
  for await (const promo of promos.find({})) {
    const usageCount = await redemptions.countDocuments({ promoCode: promo._id, active: true });
    await promos.updateOne({ _id: promo._id }, { $set: { usageCount } });
  }
  await redemptions.createIndex({ promoCode: 1, userId: 1 }, {
    name: "active_promo_user_unique", unique: true, partialFilterExpression: { active: true },
  });
  for (const index of await redemptions.indexes()) {
    if (index.unique && Object.keys(index.key).length === 2 && index.key.promoCode === 1 && index.key.userId === 1 && !index.partialFilterExpression) {
      await redemptions.dropIndex(index.name);
    }
  }
  console.log("Migration complete. No payment snapshots or historical redemption records were deleted.");
  if (approvedWithoutEnrollment.length) console.log("Existing approved payments without enrollment require operator review; migration does not grant course access.");
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
