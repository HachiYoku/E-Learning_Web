const mongoose = require("mongoose");

const quizUnlockSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
  unlockedAt: { type: Date, default: Date.now, immutable: true },
}, { timestamps: true });

quizUnlockSchema.index({ user: 1, quiz: 1 }, { unique: true });

module.exports = mongoose.model("QuizUnlock", quizUnlockSchema);
