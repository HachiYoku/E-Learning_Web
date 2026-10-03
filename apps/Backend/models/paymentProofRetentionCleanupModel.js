const mongoose = require("mongoose");

// Durable work record for proof-only retention cleanup. The financial Payment
// document is retained; each job contains the exact asset identity expected at
// the time it was queued and is revalidated immediately before deletion.
const schema = new mongoose.Schema({
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
  publicId: { type: String, required: true, unique: true },
  storage: { type: String, enum: ["authenticated", "legacy"], required: true },
  state: { type: String, enum: ["pending", "failed"], default: "pending", index: true },
  attempts: { type: Number, default: 0, min: 0 },
  lastError: { type: String, default: "" },
  nextAttemptAt: { type: Date, default: null, index: true },
}, { timestamps: true });

module.exports = mongoose.model("PaymentProofRetentionCleanup", schema);
