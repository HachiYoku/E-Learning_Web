const mongoose = require("mongoose");
const { RESULT_MS } = require("../services/guestQuizSecurity");

// Temporary, immutable result. The snapshot is authoritative for answer review;
// TTL is storage cleanup only, while reads must enforce expiresAt explicitly.
const schema = new mongoose.Schema({
  ownerHash: { type: String, required: true, immutable: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, immutable: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: "GuestQuizSession", required: true, immutable: true },
  answers: { type: [Number], required: true, immutable: true },
  score: { type: Number, required: true, min: 0, immutable: true },
  total: { type: Number, required: true, min: 1, immutable: true },
  submissionSnapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  submittedAt: { type: Date, required: true, immutable: true },
  expiresAt: { type: Date, required: true, immutable: true },
}, { collection: "guestquizattempts", timestamps: true });

schema.path("expiresAt").validate(function exactlyOneDay(value) {
  return this.submittedAt instanceof Date && value instanceof Date
    && value.getTime() - this.submittedAt.getTime() === RESULT_MS;
}, "Guest result must expire exactly 24 hours after submission.");

schema.index({ session: 1 }, { name: "one_guest_attempt_per_session", unique: true });
schema.index({ expiresAt: 1 }, { name: "guest_quiz_result_expiry", expireAfterSeconds: 0 });
schema.index({ quiz: 1, expiresAt: 1 });

schema.pre("save", async function preserveResult() {
  if (this.isNew) return;
  throw new Error("Guest results are immutable.");
});
schema.pre(["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne"], function rejectResultMutation() {
  throw new Error("Guest results are immutable.");
});

module.exports = mongoose.model("GuestQuizAttempt", schema);
