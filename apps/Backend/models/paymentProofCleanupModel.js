const mongoose = require("mongoose");

// This record exists before the external upload starts. It is removed in the
// payment transaction, or retained for retry if Cloudinary cleanup fails.
const schema = new mongoose.Schema({
  publicId: { type: String, required: true, unique: true },
  state: { type: String, enum: ["staged", "cleanup", "uncertain"], default: "staged" },
}, { timestamps: true });
module.exports = mongoose.model("PaymentProofCleanup", schema);
