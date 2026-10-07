const mongoose = require("mongoose");

// A session authorizes a submission against the exact Quiz revision the learner
// opened. It is deliberately separate from immutable QuizAttempt history.
const quizSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true, immutable: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true, immutable: true },
  revision: { type: Number, required: true, min: 1, immutable: true },
  contextType: { type: String, required: true, immutable: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  startedAt: { type: Date, required: true, default: Date.now, immutable: true },
  expiresAt: { type: Date, required: true, immutable: true },
  invalidatedAt: { type: Date, default: null },
  invalidationReason: { type: String, trim: true, default: "" },
}, { timestamps: true });

quizSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
quizSessionSchema.index({ quiz: 1, expiresAt: 1, invalidatedAt: 1 });

module.exports = mongoose.model("QuizSession", quizSessionSchema);
