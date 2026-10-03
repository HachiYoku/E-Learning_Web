require("dotenv").config(); const mongoose = require("mongoose"); const { processPaymentMethodQrCleanup, recoverStalePaymentMethodQrClaims } = require("../services/paymentMethodQrCleanup"); const { assertRetentionJobEnvironment } = require("../services/retentionJobGuard");
assertRetentionJobEnvironment();
mongoose.connect(process.env.MONGO_DB)
  .then(async () => { const recover = process.argv.includes("--recover-stale-claims"); if (recover && !process.argv.includes("--writers-stopped")) throw new Error("--recover-stale-claims requires --writers-stopped."); const recoveredClaims = recover ? await recoverStalePaymentMethodQrClaims({ writersStopped: true }) : 0; const results = await processPaymentMethodQrCleanup({ limit: Number(process.env.PAYMENT_METHOD_QR_CLEANUP_LIMIT || 50) }); const retryableFailures = results.filter((item) => item.retryable).length; console.log(JSON.stringify({ status: retryableFailures ? "retryable_backlog" : "ok", recoveredClaims, processed: results.length, retryableFailures })); if (retryableFailures) process.exitCode = 2; })
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
