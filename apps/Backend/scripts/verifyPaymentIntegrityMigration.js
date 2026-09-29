// Read-only verification for a completed payment-integrity migration.
require("dotenv").config({ quiet: true });
const { MongoClient } = require("mongoose").mongo;
const { assertPaymentIntegrityDatabase } = require("./paymentIntegrityDatabaseGuard");

const historicalPayments = [
  { id: "6a79cbcbe4811cbe3fd392d1", amount: null, originalAmount: null, discountAmount: null },
  { id: "6a79ccb8e4811cbe3fd39500", amount: null, originalAmount: null, discountAmount: null },
  { id: "6a79cebae4811cbe3fd39a76", amount: null, originalAmount: null, discountAmount: null },
  { id: "6a79d2ea0fefb4a0b5435374", amount: null, originalAmount: null, discountAmount: null },
  { id: "6a7c3225ef5fe60c5b9ab40b", amount: null, originalAmount: null, discountAmount: null },
  { id: "6a7c3d7d709318d97f92f5ac", amount: null, originalAmount: null, discountAmount: null },
  { id: "6ab152dc407e009368a75cfb", amount: 5000, originalAmount: 5000, discountAmount: 0 },
];

const id = (value) => value == null ? null : String(value);

async function main() {
  if (!process.argv.includes("--read-only")) throw new Error("Pass --read-only to run verification.");
  if (!process.env.MONGO_DB) throw new Error("MONGO_DB is required.");
  const client = new MongoClient(process.env.MONGO_DB, { readPreference: "primary", readConcern: { level: "majority" } });
  await client.connect();
  try {
    const db = client.db();
    assertPaymentIntegrityDatabase(db);
    const redemptions = db.collection("promoredemptions");
    const promos = db.collection("promocodes");
    const payments = db.collection("payments");
    const indexes = await redemptions.indexes();
    const newIndex = indexes.find((index) => index.name === "active_promo_user_unique");
    const oldLifetimeIndexes = indexes.filter((index) => index.unique
      && index.key?.promoCode === 1 && index.key?.userId === 1 && !index.partialFilterExpression);
    const lifecycle = await redemptions.aggregate([
      { $lookup: { from: "payments", localField: "paymentId", foreignField: "_id", as: "payment" } },
      { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { active: "$active", paymentStatus: "$payment.status" }, count: { $sum: 1 } } },
      { $sort: { "_id.active": 1, "_id.paymentStatus": 1 } },
    ]).toArray();
    const missingActive = await redemptions.countDocuments({ active: { $exists: false } });
    const lifecycleMismatches = await redemptions.aggregate([
      { $lookup: { from: "payments", localField: "paymentId", foreignField: "_id", as: "payment" } },
      { $unwind: "$payment" },
      { $match: { $expr: { $ne: ["$active", { $ne: ["$payment.status", "rejected"] }] } } },
      { $project: { _id: 1, paymentId: 1, active: 1, paymentStatus: "$payment.status" } },
    ]).toArray();
    const promoUsage = await promos.aggregate([
      { $lookup: { from: "promoredemptions", let: { promoId: "$_id" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$promoCode", "$$promoId"] }, { $eq: ["$active", true] }] } } },
      ], as: "activeRedemptions" } },
      { $project: { _id: 1, code: 1, usageCount: 1, activeRedemptionCount: { $size: "$activeRedemptions" } } },
      { $sort: { code: 1 } },
    ]).toArray();
    const usageMismatches = promoUsage.filter((promo) => promo.usageCount !== promo.activeRedemptionCount);
    const historical = [];
    for (const expected of historicalPayments) {
      const payment = await payments.findOne({ _id: new (require("mongoose").Types.ObjectId)(expected.id) }, { projection: {
        userId: 1, courseId: 1, status: 1, amount: 1, originalAmount: 1, discountAmount: 1,
        promoCode: 1, promoRedemptionId: 1, courseSnapshot: 1, createdAt: 1, reviewedAt: 1,
        paymentProofPublicId: 1, paymentImagePublicId: 1, paymentImage: 1,
      } });
      historical.push({
        paymentId: expected.id, exists: Boolean(payment), status: payment?.status ?? null,
        amount: payment?.amount ?? null, originalAmount: payment?.originalAmount ?? null,
        discountAmount: payment?.discountAmount ?? null, promoCode: payment?.promoCode ?? null,
        promoRedemptionId: id(payment?.promoRedemptionId), courseId: id(payment?.courseId),
        createdAt: payment?.createdAt ?? null, reviewedAt: payment?.reviewedAt ?? null,
        proofPresent: Boolean(payment?.paymentProofPublicId || payment?.paymentImagePublicId || payment?.paymentImage),
        matchesPreMigrationFinancialState: Boolean(payment && payment.status === "approved"
          && (expected.amount == null ? payment.amount == null : payment.amount === expected.amount)
          && (expected.originalAmount == null ? payment.originalAmount == null : payment.originalAmount === expected.originalAmount)
          && (expected.discountAmount == null ? payment.discountAmount == null : payment.discountAmount === expected.discountAmount)),
      });
    }
    console.log(JSON.stringify({
      mode: "read-only", database: db.databaseName,
      redemptionIndexes: indexes.map(({ name, key, unique, partialFilterExpression }) => ({ name, key, unique: Boolean(unique), partialFilterExpression: partialFilterExpression || null })),
      indexVerification: {
        oldLifetimeUniqueIndexes: oldLifetimeIndexes.map((index) => index.name),
        activePromoUserUnique: newIndex ? { name: newIndex.name, key: newIndex.key, unique: Boolean(newIndex.unique), partialFilterExpression: newIndex.partialFilterExpression || null } : null,
      },
      redemptionLifecycle: { groupedCounts: lifecycle, missingActive, lifecycleMismatches: lifecycleMismatches.map((item) => ({ redemptionId: id(item._id), paymentId: id(item.paymentId), active: item.active, paymentStatus: item.paymentStatus })) },
      promoUsage: promoUsage.map((item) => ({ promoId: id(item._id), code: item.code, usageCount: item.usageCount, activeRedemptionCount: item.activeRedemptionCount })),
      promoUsageMismatches: usageMismatches.map((item) => ({ promoId: id(item._id), code: item.code, usageCount: item.usageCount, activeRedemptionCount: item.activeRedemptionCount })),
      historicalApprovedWithoutEnrollment: historical,
      limitations: ["This verifies the seven records documented before migration. It cannot prove a database-wide absence of deletions without a pre-migration export or snapshot."],
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
