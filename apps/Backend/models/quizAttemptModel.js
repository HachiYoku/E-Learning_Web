const mongoose = require("mongoose");

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    answers: { type: [Number], default: [] },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

quizAttemptSchema.index({ quiz: 1, user: 1, createdAt: -1 });
quizAttemptSchema.index(
  { quiz: 1, user: 1, attemptNumber: 1 },
  { unique: true, partialFilterExpression: { attemptNumber: { $exists: true } } }
);

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
