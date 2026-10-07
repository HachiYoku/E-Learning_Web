const mongoose = require("mongoose");

// Cloudinary identifiers are never accepted from an Admin as deletion
// authority. This record ties an asset to one Quiz question and allows
// reference-aware cleanup after successful persistence.
const quizMediaSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true, immutable: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, immutable: true },
  mediaType: { type: String, enum: ["image", "audio"], required: true, immutable: true },
  publicId: { type: String, required: true, unique: true, immutable: true },
  resourceType: { type: String, required: true, immutable: true },
  url: { type: String, required: true, immutable: true },
  format: { type: String, default: "", immutable: true },
  bytes: { type: Number, default: 0, immutable: true },
  cleanupState: { type: String, enum: ["active", "pending_cleanup", "cleanup_failed", "deleted"], default: "active", index: true },
  cleanupError: { type: String, default: "" },
}, { timestamps: true });

quizMediaSchema.index({ quiz: 1, questionId: 1, mediaType: 1 });

module.exports = mongoose.model("QuizMedia", quizMediaSchema);
