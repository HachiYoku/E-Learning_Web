const mongoose = require("mongoose");

const quizAttemptGrantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true, immutable: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true, immutable: true },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  reason: { type: String, trim: true, maxlength: 300, default: "", immutable: true },
  grantedAt: { type: Date, default: Date.now, immutable: true },
}, { timestamps: true });

quizAttemptGrantSchema.index({ quiz: 1, user: 1, grantedAt: -1 });

module.exports = mongoose.model("QuizAttemptGrant", quizAttemptGrantSchema);
