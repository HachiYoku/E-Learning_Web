const mongoose = require("mongoose");

// A small durable outbox for assets that can only be removed after the
// account-deletion transaction has committed. Cloudinary cannot participate
// in the MongoDB transaction, so failures remain visible and retryable.
const accountAssetCleanupSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, trim: true },
    resourceType: { type: String, enum: ["image"], default: "image", required: true },
    deliveryType: { type: String, enum: ["upload"], default: "upload", required: true },
    state: { type: String, enum: ["pending", "failed"], default: "pending", index: true },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: "", maxlength: 500 },
    nextAttemptAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccountAssetCleanup", accountAssetCleanupSchema);
