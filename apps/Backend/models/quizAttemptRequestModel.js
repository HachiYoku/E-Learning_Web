const mongoose = require("mongoose");

const REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled", "superseded"];

const quizAttemptRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, immutable: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, immutable: true, index: true },
  reason: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
  status: { type: String, enum: REQUEST_STATUSES, default: "pending", index: true },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  adminNote: { type: String, trim: true, maxlength: 500, default: "" },
  resultingGrant: { type: mongoose.Schema.Types.ObjectId, ref: "QuizAttemptGrant", default: null },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

// A partial unique index is the authoritative concurrency guard. Terminal
// records remain durable history while exactly one pending request can exist.
quizAttemptRequestSchema.index(
  { user: 1, quiz: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_course_final_request" }
);
quizAttemptRequestSchema.index({ quiz: 1, user: 1, createdAt: -1 });

module.exports = mongoose.model("QuizAttemptRequest", quizAttemptRequestSchema);
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
