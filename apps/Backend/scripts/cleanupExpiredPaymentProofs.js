require("dotenv").config();
const mongoose = require("mongoose");
const { processExpiredPaymentProofs, recoverStalePaymentProofRetentionClaims } = require("../services/paymentProofRetention");
const { assertRetentionJobEnvironment } = require("../services/retentionJobGuard");

async function main() {
  assertRetentionJobEnvironment(); await mongoose.connect(process.env.MONGO_DB);
  const recoverStaleClaims = process.argv.includes("--recover-stale-claims");
  if (recoverStaleClaims && !process.argv.includes("--writers-stopped")) {
    throw new Error("--recover-stale-claims requires --writers-stopped after stopping all backend writers and allowing in-flight cleanup workers to finish.");
  }
  const recoveredClaims = recoverStaleClaims ? await recoverStalePaymentProofRetentionClaims() : 0;
  const results = await processExpiredPaymentProofs({ limit: Number(process.env.PAYMENT_PROOF_RETENTION_CLEANUP_LIMIT || 50) });
  const retryableFailures = results.filter((result) => result.retryable).length;
  console.log(JSON.stringify({ status: retryableFailures ? "retryable_backlog" : "ok", recoveredClaims, processed: results.length, retryableFailures }));
  if (retryableFailures) process.exitCode = 2;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
