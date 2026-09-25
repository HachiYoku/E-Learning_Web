require("dotenv").config();
const mongoose = require("mongoose");
const Cleanup = require("../models/paymentProofCleanupModel");
const Payment = require("../models/paymentModel");
const { cleanFailedProof } = require("../services/paymentProofCleanup");

async function main() {
  await mongoose.connect(process.env.MONGO_DB);
  const reconcile = process.argv.includes("--reconcile-staged");
  // Explicit offline recovery: no in-flight uploader/transaction may exist.
  // Normal runs process only definitively failed submissions.
  if (reconcile && !process.argv.includes("--writers-stopped")) {
    throw new Error("--reconcile-staged requires --writers-stopped after stopping all backend writers and allowing in-flight uploads/transactions to finish.");
  }
  for await (const job of Cleanup.find(reconcile ? {} : { state: "cleanup" })) {
    const payment = await Payment.findOne({ paymentProofPublicId: job.publicId }).read("primary").readConcern("majority");
    if (payment) {
      await Cleanup.deleteOne({ _id: job._id });
      continue;
    }
    if (job.state !== "cleanup") {
      await Cleanup.updateOne({ _id: job._id }, { state: "cleanup" });
    }
    await cleanFailedProof(job.publicId);
  }
  const remaining = await Cleanup.countDocuments();
  console.log(JSON.stringify({ remainingProofCleanupRecords: remaining }));
  if (remaining) process.exitCode = 1;
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
