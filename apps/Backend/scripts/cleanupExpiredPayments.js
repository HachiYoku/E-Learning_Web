require("dotenv").config();
const mongoose = require("mongoose");
const { processExpiredPayments, recoverStaleFinalDeletionClaims } = require("../services/paymentFinalRetention");
const { assertRetentionJobEnvironment } = require("../services/retentionJobGuard");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  assertRetentionJobEnvironment({ dryRun }); await mongoose.connect(process.env.MONGO_DB);
  if (dryRun) {
    const { inspectExpiredPayments } = require("../services/paymentFinalRetention");
    const results = await inspectExpiredPayments({ limit: Number(process.env.PAYMENT_FINAL_CLEANUP_LIMIT || 50) });
    console.log(JSON.stringify({ status: "dry_run", candidates: results })); return;
  }
  if (process.argv.includes("--recover-stale-claims")) {
    if (!process.argv.includes("--writers-stopped")) throw new Error("--recover-stale-claims requires --writers-stopped after all backend writers are stopped.");
    console.log(JSON.stringify({ recoveredClaims: await recoverStaleFinalDeletionClaims({ writersStopped: true }) }));
    return;
  }
  const results = await processExpiredPayments({ limit: Number(process.env.PAYMENT_FINAL_CLEANUP_LIMIT || 50) });
  const retryableFailures = results.filter((item) => item.retryable).length;
  console.log(JSON.stringify({ status: retryableFailures ? "retryable_backlog" : "ok", processed: results.length, deleted: results.filter((item) => item.deleted).length, preserved: results.filter((item) => item.preserved).length, retryableFailures }));
  if (retryableFailures) process.exitCode = 2;
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
