const assert = require("node:assert/strict");
const test = require("node:test");
const { expectedPaymentIntegrityDatabase, assertPaymentIntegrityDatabase } = require("../scripts/paymentIntegrityDatabaseGuard");

test("production payment-integrity operations permit only arunthai", () => {
  assert.equal(expectedPaymentIntegrityDatabase({ NODE_ENV: "production" }), "arunthai");
  assert.equal(expectedPaymentIntegrityDatabase({ NODE_ENV: "production", PAYMENT_INTEGRITY_EXPECTED_DB: "arunthai" }), "arunthai");
  assert.throws(() => expectedPaymentIntegrityDatabase({ NODE_ENV: "production", PAYMENT_INTEGRITY_EXPECTED_DB: "english_kafe" }), /only arunthai/);
  assert.throws(() => assertPaymentIntegrityDatabase({ databaseName: "english_kafe" }, { NODE_ENV: "production" }), /expected arunthai/);
});

test("non-production payment-integrity operations require an explicit matching database", () => {
  assert.throws(() => expectedPaymentIntegrityDatabase({ NODE_ENV: "test" }), /Set PAYMENT_INTEGRITY_EXPECTED_DB/);
  assert.equal(assertPaymentIntegrityDatabase({ databaseName: "english_kafe" }, { NODE_ENV: "development", PAYMENT_INTEGRITY_EXPECTED_DB: "english_kafe" }), "english_kafe");
  assert.throws(() => assertPaymentIntegrityDatabase({ databaseName: "arunthai" }, { NODE_ENV: "development", PAYMENT_INTEGRITY_EXPECTED_DB: "english_kafe" }), /expected english_kafe/);
});
