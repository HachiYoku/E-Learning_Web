const mongoose = require("mongoose");

// A reservation is written before Cloudinary receives bytes, so an ambiguous
// provider response always has an owner and a recoverable public ID.
const schema = new mongoose.Schema({
  quizSet: { type: mongoose.Schema.Types.ObjectId, ref: "QuizSet", required: true, immutable: true },
  environment: { type: String, enum: ["testing", "production"], required: true, immutable: true },
  publicId: { type: String, required: true, immutable: true },
  url: { type: String, default: "" },
  state: { type: String, enum: ["reserved", "available", "active", "cleanup_pending", "cleanup_processing", "deleted"], default: "reserved" },
  abandonAfter: { type: Date, required: true },
  cleanupError: { type: String, default: "" },
  cleanupReason: { type: String, enum: ["", "abandoned", "replaced", "set_deleted"], default: "" },
  cleanupAttempts: { type: Number, default: 0 },
  cleanupStartedAt: { type: Date, default: null },
  cleanupFinishedAt: { type: Date, default: null },
  cleanupOutcome: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("QuizSetCoverAsset", schema);
