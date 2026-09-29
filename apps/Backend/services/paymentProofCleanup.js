const Cleanup = require("../models/paymentProofCleanupModel");
const Payment = require("../models/paymentModel");
const storage = require("./paymentProofStorage");

async function cleanFailedProof(publicId) {
  try {
    // Never delete a proof already attached to a committed payment.
    if (await Payment.exists({ paymentProofPublicId: publicId }).read("primary").readConcern("majority")) return;
    const job = await Cleanup.findOne({ publicId, state: "cleanup" });
    if (!job) return;
    await storage.deletePaymentProof(publicId);
    await Cleanup.deleteOne({ _id: job._id, state: "cleanup" });
  } catch (_error) {
    console.error("Payment proof cleanup pending; run payments:cleanup-proofs.");
  }
}

module.exports = { cleanFailedProof };
