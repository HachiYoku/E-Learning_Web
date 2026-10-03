const mongoose = require("mongoose");
const claimSchema = new mongoose.Schema({ token: { type: String, required: true }, claimedAt: { type: Date, required: true } }, { _id: false });
const schema = new mongoose.Schema({ publicId: { type: String, required: true, unique: true }, state: { type: String, enum: ["pending", "processing", "failed"], default: "pending" }, attempts: { type: Number, default: 0 }, lastError: { type: String, default: "" }, nextAttemptAt: { type: Date, default: null }, claim: { type: claimSchema, default: undefined, select: false } }, { timestamps: true });
module.exports = mongoose.model("PaymentMethodQrCleanup", schema);
