// Removes only the user-confirmed HAPPY28/WELCOME01 disposable test chains.
// This script is intentionally not a general payment deletion tool.
const mongoose = require("mongoose");
const { assertPaymentIntegrityDatabase } = require("./paymentIntegrityDatabaseGuard");

const DATABASE = "english_kafe";
const CONFIRMATION = "--confirm=DELETE_ENGLISH_KAFE_DISPOSABLE_PROMO_TESTS";

const plan = {
  payments: [
    { _id: "6aace50faee2f7b24d226680", promoCode: "HAPPY28", status: "approved", promoRedemptionId: "6aace50faee2f7b24d22667f" },
    { _id: "6ab52a27fd930d6eb468a663", promoCode: "WELCOME01", status: "rejected", promoRedemptionId: "6ab52a26fd930d6eb468a662" },
    { _id: "6ab52cf2fd930d6eb468a66b", promoCode: "WELCOME01", status: "approved", promoRedemptionId: "6ab52cf1fd930d6eb468a66a" },
  ],
  redemptions: [
    { _id: "6aace50faee2f7b24d22667f", promoCode: "6aa3b5017691d1af3a326703", paymentId: "6aace50faee2f7b24d226680" },
    { _id: "6ab52cf1fd930d6eb468a66a", promoCode: "6ab529aafd930d6eb468a65f", paymentId: "6ab52cf2fd930d6eb468a66b" },
  ],
  promoCodes: [{ _id: "6ab529aafd930d6eb468a65f", code: "WELCOME01", usageCount: 1 }],
  enrollments: [
    { _id: "6aad00c4ea5d45806a5d61c9", paymentId: "6aace50faee2f7b24d226680" },
    { _id: "6ab52d836bc1c4366b0915b0", paymentId: "6ab52cf2fd930d6eb468a66b" },
  ],
  auditLogs: [
    { _id: "6aad00c4fae9058f7808adc0", action: "payment.approved", targetId: "6aace50faee2f7b24d226680" },
    { _id: "6ab52cbffd930d6eb468a667", action: "payment.rejected", targetId: "6ab52a27fd930d6eb468a663" },
    { _id: "6ab52d83fd930d6eb468a66d", action: "payment.approved", targetId: "6ab52cf2fd930d6eb468a66b" },
  ],
  notifications: [
    "6ab52a27fd930d6eb468a664", "6ab52cbffd930d6eb468a668",
    "6ab52cf2fd930d6eb468a66c", "6ab52d83fd930d6eb468a66e",
  ],
};

function uriDatabaseName(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i.exec(uri || "");
  return match ? decodeURIComponent(match[1]) : null;
}

function assertEnglishKafeCleanupEnvironment(env = process.env) {
  if (!["development", "test"].includes(env.NODE_ENV)) {
    throw new Error("Disposable promo-test cleanup is permitted only when NODE_ENV is development or test.");
  }
  if (env.PAYMENT_INTEGRITY_EXPECTED_DB !== DATABASE) {
    throw new Error("Set PAYMENT_INTEGRITY_EXPECTED_DB=english_kafe for this cleanup.");
  }
  if (uriDatabaseName(env.MONGO_DB) !== DATABASE) {
    throw new Error("MONGO_DB must explicitly target english_kafe; refusing to connect.");
  }
}

const objectId = (value) => new mongoose.Types.ObjectId(value);
const objectIdFields = {
  payments: new Set(["_id", "promoRedemptionId"]),
  redemptions: new Set(["_id", "promoCode", "paymentId"]),
  promoCodes: new Set(["_id"]),
  enrollments: new Set(["_id", "paymentId"]),
  auditLogs: new Set(["_id", "targetId"]),
};
const exactFilter = (collection, item) => Object.fromEntries(Object.keys(item).map((key) => [
  key, objectIdFields[collection]?.has(key) && item[key] ? objectId(item[key]) : item[key],
]));

async function readPlan(db) {
  const collections = {
    payments: db.collection("payments"), redemptions: db.collection("promoredemptions"),
    promoCodes: db.collection("promocodes"), enrollments: db.collection("enrollments"),
    auditLogs: db.collection("auditlogs"), notifications: db.collection("notifications"),
  };
  const results = {};
  for (const [name, items] of Object.entries(plan)) {
    const collection = collections[name];
    results[name] = [];
    for (const item of items) {
      const filter = name === "notifications" ? { _id: objectId(item) }
        : exactFilter(name, item);
      const record = await collection.findOne(filter);
      results[name].push({ id: typeof item === "string" ? item : item._id, found: Boolean(record) });
    }
  }
  return results;
}

function assertPlanComplete(results) {
  const missing = Object.entries(results).flatMap(([collection, items]) =>
    items.filter((item) => !item.found).map((item) => `${collection}/${item.id}`));
  if (missing.length) throw new Error(`Cleanup preconditions changed or records are missing: ${missing.join(", ")}`);
}

async function deletePlan(db, session) {
  const collections = {
    payments: db.collection("payments"), redemptions: db.collection("promoredemptions"),
    promoCodes: db.collection("promocodes"), enrollments: db.collection("enrollments"),
    auditLogs: db.collection("auditlogs"), notifications: db.collection("notifications"),
  };
  const deleted = {};
  // Delete dependents first. MongoDB has no foreign keys, but this order makes
  // the intended relationships clear if the plan is ever reviewed manually.
  for (const name of ["enrollments", "redemptions", "payments", "promoCodes", "auditLogs", "notifications"]) {
    deleted[name] = 0;
    for (const item of plan[name]) {
      const filter = name === "notifications" ? { _id: objectId(item) }
        : exactFilter(name, item);
      const result = await collections[name].deleteOne(filter, { session });
      if (result.deletedCount !== 1) throw new Error(`Cleanup precondition changed while deleting ${name}.`);
      deleted[name] += result.deletedCount;
    }
  }
  return deleted;
}

async function main() {
  require("dotenv").config({ quiet: true });
  assertEnglishKafeCleanupEnvironment();
  await mongoose.connect(process.env.MONGO_DB, { autoIndex: false });
  try {
    const db = mongoose.connection.db;
    assertPaymentIntegrityDatabase(db);
    const hello = await db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("A transaction-capable database is required for cleanup.");
    const results = await readPlan(db);
    console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "dry-run", database: db.databaseName, records: results, counts: Object.fromEntries(Object.entries(results).map(([key, value]) => [key, value.length])) }, null, 2));
    assertPlanComplete(results);
    if (!process.argv.includes("--apply")) {
      console.log(`Dry run only. To apply, add --apply ${CONFIRMATION}`);
      return;
    }
    if (!process.argv.includes(CONFIRMATION)) throw new Error(`Applying requires ${CONFIRMATION}`);
    const deleted = await mongoose.connection.transaction(
      (session) => deletePlan(db, session),
      { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
    console.log(JSON.stringify({ deleted }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { plan, uriDatabaseName, assertEnglishKafeCleanupEnvironment };
