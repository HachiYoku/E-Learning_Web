const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    originalAmount: { type: Number, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    promoCode: { type: String, trim: true, uppercase: true },
    promoRedemptionId: { type: mongoose.Schema.Types.ObjectId, ref: "PromoRedemption", default: null },
    fee: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentImage: {
      type: String,
      required: true,
      trim: true,
    },
    paymentImagePublicId: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    rejectReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, courseId: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

module.exports = mongoose.model("Payment", paymentSchema);
