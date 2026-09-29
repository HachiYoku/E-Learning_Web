function expectedPaymentIntegrityDatabase(env = process.env) {
  const requested = env.PAYMENT_INTEGRITY_EXPECTED_DB;
  if (env.NODE_ENV === "production") {
    if (requested && requested !== "arunthai") {
      throw new Error("Production payment-integrity operations may target only arunthai.");
    }
    return "arunthai";
  }
  if (!requested) {
    throw new Error("Set PAYMENT_INTEGRITY_EXPECTED_DB explicitly for a non-production payment-integrity operation.");
  }
  return requested;
}

function assertPaymentIntegrityDatabase(db, env = process.env) {
  const expected = expectedPaymentIntegrityDatabase(env);
  if (db.databaseName !== expected) {
    throw new Error(`Refusing to inspect or migrate database ${db.databaseName}; expected ${expected}.`);
  }
  return expected;
}

module.exports = { expectedPaymentIntegrityDatabase, assertPaymentIntegrityDatabase };
