const mongoose = require("mongoose");

// This is durable lifetime-accounting history only. PDFs and receipt contents
// are never stored; records are removed with their retained Payment.
const receiptDeliverySchema = new mongoose.Schema({
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
  sentAt: { type: Date, required: true, default: Date.now, immutable: true },
  deliveryType: { type: String, enum: ["approval", "self_service"], required: true, immutable: true },
}, { timestamps: true });

receiptDeliverySchema.index({ paymentId: 1, sentAt: -1 });

module.exports = mongoose.model("ReceiptDelivery", receiptDeliverySchema);
