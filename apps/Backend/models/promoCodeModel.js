const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  discountType: { type: String, enum: ["percent", "fixed"], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  // Compatibility field: discountValue remains authoritative until checkout is
  // changed in a later phase. fixedAmounts gives future fixed discounts an
  // explicit, non-converted currency meaning.
  fixedAmounts: {
    THB: { type: Number, min: 0 },
    MMK: { type: Number, min: 0 },
  },
  applicableCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  startsAt: { type: Date, default: null }, expiresAt: { type: Date, default: null },
  usageLimit: { type: Number, default: null, min: 1 }, usageCount: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  archivedAt: { type: Date, default: null },
  mutationVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });
module.exports = mongoose.model("PromoCode", promoCodeSchema);
