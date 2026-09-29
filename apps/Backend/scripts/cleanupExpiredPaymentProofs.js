require("dotenv").config();
const mongoose = require("mongoose");
const { processExpiredPaymentProofs, recoverStalePaymentProofRetentionClaims } = require("../services/paymentProofRetention");

async function main() {
  await mongoose.connect(process.env.MONGO_DB);
  const recoverStaleClaims = process.argv.includes("--recover-stale-claims");
  if (recoverStaleClaims && !process.argv.includes("--writers-stopped")) {
    throw new Error("--recover-stale-claims requires --writers-stopped after stopping all backend writers and allowing in-flight cleanup workers to finish.");
  }
  const recoveredClaims = recoverStaleClaims ? await recoverStalePaymentProofRetentionClaims() : 0;
  const results = await processExpiredPaymentProofs({ limit: Number(process.env.PAYMENT_PROOF_RETENTION_CLEANUP_LIMIT || 50) });
  console.log(JSON.stringify({ recoveredClaims, processed: results.length, retryableFailures: results.filter((result) => result.retryable).length }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
