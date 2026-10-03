const Cleanup = require("../models/paymentProofCleanupModel");
const Payment = require("../models/paymentModel");
const storage = require("./paymentProofStorage");

async function cleanFailedProof(publicId) {
  try {
    const job = await Cleanup.findOne({ publicId, state: "cleanup" });
    if (!job) return;
    // Never delete a proof already attached to a committed payment. Keep this
    // check immediately adjacent to the external deletion for failed-upload
    // cleanup; the normal transaction removes this job when it commits.
    if (await Payment.exists({ paymentProofPublicId: publicId }).read("primary").readConcern("majority")) return;
    await storage.deletePaymentProof(publicId);
    await Cleanup.deleteOne({ _id: job._id, state: "cleanup" });
  } catch (_error) {
    console.error("Payment proof cleanup pending; run payments:cleanup-proofs.");
  }
}

module.exports = { cleanFailedProof };
