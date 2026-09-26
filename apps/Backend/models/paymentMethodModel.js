const mongoose = require("mongoose");

const recipientSchema = new mongoose.Schema({
  accountName: { type: String, trim: true, default: "" },
  accountNumber: { type: String, trim: true, default: "" },
  bankName: { type: String, trim: true, default: "" },
  phoneNumber: { type: String, trim: true, default: "" },
  referenceHint: { type: String, trim: true, default: "" },
}, { _id: false });

const qrImageSchema = new mongoose.Schema({
  url: { type: String, trim: true, default: "" },
  publicId: { type: String, trim: true, default: "" },
}, { _id: false });

const paymentMethodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  currency: { type: String, required: true, enum: ["THB", "MMK"] },
  // type is how the student pays; provider is how that payment is processed.
  type: { type: String, required: true, enum: ["qr", "bank_transfer", "wallet"] },
  provider: { type: String, required: true, enum: ["manual"], default: "manual" },
  instructions: { type: String, trim: true, default: "", maxlength: 4000 },
  recipient: { type: recipientSchema, default: () => ({}) },
  qrImage: { type: qrImageSchema, default: () => ({}) },
  isActive: { type: Boolean, default: true },
  mutationVersion: { type: Number, default: 0, min: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

paymentMethodSchema.index({ currency: 1, isActive: 1 });

module.exports = mongoose.model("PaymentMethod", paymentMethodSchema);
