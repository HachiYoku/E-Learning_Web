// Local rehearsal migration for the multi-currency data-model rollout.
// Default mode is read-only. This script intentionally cannot run in
// production and never creates PaymentMethod records.
require("dotenv").config({ quiet: true });

const { MongoClient } = require("mongoose").mongo;
const { assertPaymentIntegrityDatabase } = require("./paymentIntegrityDatabaseGuard");

const LOCAL_DATABASE = "english_kafe";
const LEGACY_METHOD_MARKER = Object.freeze({ schemaVersion: 1, kind: "legacy", reason: "legacy_method_not_captured" });
const id = (value) => value == null ? null : String(value);
const isAmount = (value) => value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0;

function assertLocalMigrationEnvironment(env = process.env) {
  if (env.NODE_ENV === "production") throw new Error("This local multi-currency rehearsal migration may not run in production.");
  if (env.PAYMENT_INTEGRITY_EXPECTED_DB !== LOCAL_DATABASE) {
    throw new Error(`Set PAYMENT_INTEGRITY_EXPECTED_DB=${LOCAL_DATABASE} explicitly for this local migration.`);
  }
}

function assertLocalMigrationTarget(db, env = process.env) {
  assertLocalMigrationEnvironment(env);
  assertPaymentIntegrityDatabase(db, env);
  if (db.databaseName !== LOCAL_DATABASE) throw new Error(`Refusing local migration target ${db.databaseName}; expected ${LOCAL_DATABASE}.`);
}

function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function planMigration({ courses, payments, promos }) {
  const changes = { courses: [], payments: [], promos: [] };
  const conflicts = [];
  for (const course of courses) {
    if (!isAmount(course.price)) {
      conflicts.push({ type: "course_invalid_legacy_price", courseId: id(course._id), price: course.price ?? null });
      continue;
    }
    const originalPrice = course.originalPrice === null || course.originalPrice === undefined ? Number(course.price) : Number(course.originalPrice);
    if (!isAmount(originalPrice) || originalPrice < Number(course.price)) {
      conflicts.push({ type: "course_invalid_legacy_original_price", courseId: id(course._id), price: course.price, originalPrice: course.originalPrice ?? null });
      continue;
    }
    const target = { price: Number(course.price), originalPrice };
    if (course.prices?.THB === undefined) changes.courses.push({ courseId: course._id, set: { "prices.THB": target } });
    else if (!sameJson(course.prices.THB, target)) conflicts.push({ type: "course_thb_price_conflict", courseId: id(course._id), existing: course.prices.THB, expected: target });
  }
  for (const payment of payments) {
    const set = {};
    if (payment.currency === undefined || payment.currency === null) set.currency = "THB";
    else if (payment.currency !== "THB") conflicts.push({ type: "payment_currency_conflict", paymentId: id(payment._id), existing: payment.currency });
    if (payment.paymentMethodId !== undefined && payment.paymentMethodId !== null) conflicts.push({ type: "payment_method_identity_conflict", paymentId: id(payment._id) });
    else if (!Object.hasOwn(payment, "paymentMethodId")) set.paymentMethodId = null;
    if (payment.paymentMethodSnapshot === undefined || payment.paymentMethodSnapshot === null) set.paymentMethodSnapshot = LEGACY_METHOD_MARKER;
    else if (!sameJson(payment.paymentMethodSnapshot, LEGACY_METHOD_MARKER)) conflicts.push({ type: "payment_method_snapshot_conflict", paymentId: id(payment._id) });
    if (Object.keys(set).length) changes.payments.push({ paymentId: payment._id, set });
  }
  for (const promo of promos) {
    if (promo.discountType !== "fixed") continue;
    if (!isAmount(promo.discountValue)) {
      conflicts.push({ type: "fixed_promo_invalid_discount_value", promoId: id(promo._id), discountValue: promo.discountValue ?? null });
      continue;
    }
    const target = Number(promo.discountValue);
    if (promo.fixedAmounts?.THB === undefined) changes.promos.push({ promoId: promo._id, set: { "fixedAmounts.THB": target } });
    else if (Number(promo.fixedAmounts.THB) !== target) conflicts.push({ type: "fixed_promo_thb_amount_conflict", promoId: id(promo._id), existing: promo.fixedAmounts.THB, expected: target });
  }
  return { changes, conflicts };
}

function serialisePlan(plan) {
  const mapChange = (entry, key) => ({ ...entry, [key]: id(entry[key]) });
  return {
    changes: {
      courses: plan.changes.courses.map((item) => mapChange(item, "courseId")),
      payments: plan.changes.payments.map((item) => mapChange(item, "paymentId")),
      promos: plan.changes.promos.map((item) => mapChange(item, "promoId")),
    },
    conflicts: plan.conflicts,
  };
}

async function main() {
  // This happens before MongoClient construction, so a production invocation
  // cannot establish a connection to arunthai.
  assertLocalMigrationEnvironment();
  if (!process.env.MONGO_DB) throw new Error("MONGO_DB is required.");
  const apply = process.argv.includes("--apply");
  if (apply && !process.argv.includes("--confirm-english-kafe")) throw new Error("Apply requires --confirm-english-kafe.");
  const client = new MongoClient(process.env.MONGO_DB, { readPreference: "primary", readConcern: { level: "majority" } });
  await client.connect();
  try {
    const db = client.db();
    assertLocalMigrationTarget(db);
    const [courses, payments, promos] = await Promise.all([
      db.collection("courses").find({}, { projection: { price: 1, originalPrice: 1, prices: 1 } }).toArray(),
      db.collection("payments").find({}, { projection: { currency: 1, paymentMethodId: 1, paymentMethodSnapshot: 1, originalAmount: 1, discountAmount: 1, amount: 1 } }).toArray(),
      db.collection("promocodes").find({}, { projection: { discountType: 1, discountValue: 1, fixedAmounts: 1 } }).toArray(),
    ]);
    const plan = planMigration({ courses, payments, promos });
    const report = {
      mode: apply ? "apply" : "dry-run",
      database: db.databaseName,
      writesPerformed: false,
      safeguards: ["local english_kafe target required", "production rejected before connection", "no PaymentMethod creation", "financial fields are neither read for calculation nor included in updates", "no MMK prices are planned"],
      summary: { coursesToUpdate: plan.changes.courses.length, paymentsToUpdate: plan.changes.payments.length, fixedPromosToUpdate: plan.changes.promos.length, conflicts: plan.conflicts.length, paymentMethodsToCreate: 0, mmkPricesToCreate: 0 },
      ...serialisePlan(plan),
    };
    if (plan.conflicts.length) {
      console.log(JSON.stringify(report, null, 2));
      throw new Error(`Migration preflight found ${plan.conflicts.length} conflict(s). No changes were made.`);
    }
    if (!apply) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    for (const change of plan.changes.courses) await db.collection("courses").updateOne({ _id: change.courseId }, { $set: change.set });
    for (const change of plan.changes.payments) await db.collection("payments").updateOne({ _id: change.paymentId }, { $set: change.set });
    for (const change of plan.changes.promos) await db.collection("promocodes").updateOne({ _id: change.promoId }, { $set: change.set });
    report.writesPerformed = true;
    console.log(JSON.stringify(report, null, 2));
  } finally { await client.close(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { LOCAL_DATABASE, LEGACY_METHOD_MARKER, assertLocalMigrationEnvironment, assertLocalMigrationTarget, planMigration };
