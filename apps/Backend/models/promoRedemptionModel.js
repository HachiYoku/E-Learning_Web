const mongoose = require("mongoose");

const promoRedemptionSchema = new mongoose.Schema({
  promoCode: { type: mongoose.Schema.Types.ObjectId, ref: "PromoCode", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
  active: { type: Boolean, default: true, required: true },
  releasedAt: { type: Date, default: null },
  releaseReason: { type: String, enum: ["payment_rejected"], default: undefined },
}, { timestamps: true });

promoRedemptionSchema.index({ promoCode: 1, userId: 1 }, {
  name: "active_promo_user_unique",
  unique: true,
  partialFilterExpression: { active: true },
});
module.exports = mongoose.model("PromoRedemption", promoRedemptionSchema);
