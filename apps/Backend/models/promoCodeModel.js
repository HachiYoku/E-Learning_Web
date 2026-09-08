const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  discountType: { type: String, enum: ["percent", "fixed"], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  applicableCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  startsAt: { type: Date, default: null }, expiresAt: { type: Date, default: null },
  usageLimit: { type: Number, default: null, min: 1 }, usageCount: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
module.exports = mongoose.model("PromoCode", promoCodeSchema);
