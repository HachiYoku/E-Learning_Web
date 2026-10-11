const mongoose = require("mongoose");

// Shared by the standalone rate limiter; no public runtime route uses it yet.
const quizRateWindowSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  operation: { type: String, enum: ["start", "submit"], required: true, immutable: true },
  windowStart: { type: Date, required: true, immutable: true },
  count: { type: Number, required: true, min: 0 },
  expiresAt: { type: Date, required: true },
}, { collection: "quizratewindows", versionKey: false });

quizRateWindowSchema.index(
  { user: 1, operation: 1, windowStart: 1 },
  { name: "one_quiz_rate_window", unique: true }
);
quizRateWindowSchema.index(
  { expiresAt: 1 },
  { name: "quiz_rate_window_expiry", expireAfterSeconds: 0 }
);

module.exports = mongoose.model("QuizRateWindow", quizRateWindowSchema);
