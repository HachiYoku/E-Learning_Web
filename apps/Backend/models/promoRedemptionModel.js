const mongoose = require("mongoose");

const promoRedemptionSchema = new mongoose.Schema({
  promoCode: { type: mongoose.Schema.Types.ObjectId, ref: "PromoCode", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
}, { timestamps: true });

promoRedemptionSchema.index({ promoCode: 1, userId: 1 }, { unique: true });
module.exports = mongoose.model("PromoRedemption", promoRedemptionSchema);
