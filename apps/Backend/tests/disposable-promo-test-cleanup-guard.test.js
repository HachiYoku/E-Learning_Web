const assert = require("node:assert/strict");
const test = require("node:test");
const { plan, uriDatabaseName, assertEnglishKafeCleanupEnvironment } = require("../scripts/cleanupDisposablePromoTests");

test("disposable promo-test cleanup is fixed to the confirmed english_kafe plan", () => {
  assert.equal(plan.payments.length, 3);
  assert.equal(plan.redemptions.length, 2);
  assert.equal(plan.promoCodes.length, 1);
  assert.equal(plan.enrollments.length, 2);
  assert.equal(plan.auditLogs.length, 3);
  assert.equal(plan.notifications.length, 4);
  assert.equal(uriDatabaseName("mongodb+srv://user:password@cluster.example/english_kafe?retryWrites=true"), "english_kafe");
});

test("disposable promo-test cleanup rejects production and non-english_kafe URIs before connecting", () => {
  const valid = { NODE_ENV: "development", PAYMENT_INTEGRITY_EXPECTED_DB: "english_kafe", MONGO_DB: "mongodb://127.0.0.1:27017/english_kafe" };
  assert.doesNotThrow(() => assertEnglishKafeCleanupEnvironment(valid));
  assert.throws(() => assertEnglishKafeCleanupEnvironment({ ...valid, NODE_ENV: "production" }), /development or test/);
  assert.throws(() => assertEnglishKafeCleanupEnvironment({ ...valid, PAYMENT_INTEGRITY_EXPECTED_DB: "arunthai" }), /PAYMENT_INTEGRITY_EXPECTED_DB/);
  assert.throws(() => assertEnglishKafeCleanupEnvironment({ ...valid, MONGO_DB: "mongodb://127.0.0.1:27017/arunthai" }), /MONGO_DB must explicitly target english_kafe/);
});
