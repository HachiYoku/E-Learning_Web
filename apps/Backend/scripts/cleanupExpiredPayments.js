require("dotenv").config();
const mongoose = require("mongoose");
const { processExpiredPayments, recoverStaleFinalDeletionClaims } = require("../services/paymentFinalRetention");

async function main() {
  await mongoose.connect(process.env.MONGO_DB);
  if (process.argv.includes("--recover-stale-claims")) {
    if (!process.argv.includes("--writers-stopped")) throw new Error("--recover-stale-claims requires --writers-stopped after all backend writers are stopped.");
    console.log(JSON.stringify({ recoveredClaims: await recoverStaleFinalDeletionClaims({ writersStopped: true }) }));
    return;
  }
  const results = await processExpiredPayments({ limit: Number(process.env.PAYMENT_FINAL_CLEANUP_LIMIT || 50) });
  console.log(JSON.stringify({ processed: results.length, deleted: results.filter((item) => item.deleted).length, preserved: results.filter((item) => item.preserved).length, retryableFailures: results.filter((item) => item.retryable).length }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
