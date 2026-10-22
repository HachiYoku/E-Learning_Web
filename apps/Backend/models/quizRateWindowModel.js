const mongoose = require("mongoose");

// Dedicated per-quiz authenticated standalone rate windows. The previous
// quizratewindows collection is retained for rollback and natural TTL expiry.
const quizRateWindowSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, immutable: true },
  operation: { type: String, enum: ["start", "submit"], required: true, immutable: true },
  windowStart: { type: Date, required: true, immutable: true },
  count: { type: Number, required: true, min: 0 },
  expiresAt: { type: Date, required: true },
}, { collection: "standalonequizratewindows", versionKey: false });

quizRateWindowSchema.index(
  { user: 1, quiz: 1, operation: 1, windowStart: 1 },
  { name: "one_standalone_quiz_rate_window", unique: true }
);
quizRateWindowSchema.index(
  { expiresAt: 1 },
  { name: "standalone_quiz_rate_window_expiry", expireAfterSeconds: 0 }
);

module.exports = mongoose.model("QuizRateWindow", quizRateWindowSchema);
