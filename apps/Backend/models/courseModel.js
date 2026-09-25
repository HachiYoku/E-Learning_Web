const mongoose = require("mongoose");

const currencyPriceSchema = new mongoose.Schema({
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, required: true, min: 0 },
}, { _id: false });

currencyPriceSchema.pre("validate", function validateOriginalPrice() {
  if (this.originalPrice < this.price) throw new Error("Currency originalPrice must not be lower than price.");
});

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    originalPrice: {
      type: Number,
      min: 0,
    },
    // Legacy price fields remain in place during the compatibility rollout.
    // New checkout behavior is deliberately not enabled in this phase.
    prices: {
      THB: { type: currencyPriceSchema, default: undefined },
      MMK: { type: currencyPriceSchema, default: undefined },
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    thumbnail: {
      type: String,
      trim: true,
    },
    thumbnailPublicId: {
      type: String,
      trim: true,
    },
    paymentQr: {
      type: String,
      trim: true,
    },
    paymentQrPublicId: {
      type: String,
      trim: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
