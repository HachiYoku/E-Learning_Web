const mongoose = require("mongoose");

const reelSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, unique: true, maxlength: 2048 },
    platform: { type: String, required: true, enum: ["facebook", "youtube", "tiktok"] },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

reelSchema.index({ isActive: 1, displayOrder: 1, createdAt: 1, _id: 1 });

module.exports = mongoose.model("Reel", reelSchema);
