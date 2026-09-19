const mongoose = require("mongoose");

const refreshSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    sessionVersion: { type: Number, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RefreshSession", refreshSessionSchema);
