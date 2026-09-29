const mongoose = require("mongoose");

const campaignAssetCleanupSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
  publicId: { type: String, required: true, unique: true, trim: true },
  removeCampaign: { type: Boolean, default: false },
  state: { type: String, enum: ["pending", "failed"], default: "pending", index: true },
  attempts: { type: Number, default: 0, min: 0 },
  lastError: { type: String, default: "", maxlength: 500 },
  nextAttemptAt: { type: Date, default: null, index: true },
}, { timestamps: true });

module.exports = mongoose.model("CampaignAssetCleanup", campaignAssetCleanupSchema);
