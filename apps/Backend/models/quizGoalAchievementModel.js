const mongoose = require("mongoose");

// A durable achievement record prevents a later goalPercent increase from
// revoking a learner's previously earned Goal Reached state.
const quizGoalAchievementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
  reachedAt: { type: Date, default: Date.now, immutable: true },
  goalPercentAtAchievement: { type: Number, min: 0, max: 100, required: true, immutable: true },
  scorePercentAtAchievement: { type: Number, min: 0, max: 100, required: true, immutable: true },
}, { timestamps: true });

quizGoalAchievementSchema.index({ user: 1, quiz: 1 }, { unique: true });

module.exports = mongoose.model("QuizGoalAchievement", quizGoalAchievementSchema);
