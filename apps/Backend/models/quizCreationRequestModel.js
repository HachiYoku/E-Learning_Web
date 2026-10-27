const mongoose = require("mongoose");

// Retained indefinitely: expiring a key would allow a delayed retry to create
// another quiz. Existing records without status are committed. Failed media
// requests retain their fingerprint so a later retry cannot change its payload.
const quizCreationRequestSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quizSetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  creationRequestId: { type: String, required: true },
  payloadHash: { type: String, required: true },
  status: { type: String, enum: ["failed", "abandoned", "committed"] },
  mediaCleanup: { type: String, enum: ["complete", "unverified", "retry_required"] },
  quizId: { type: mongoose.Schema.Types.ObjectId, required() { return !["failed", "abandoned"].includes(this.status); } },
  responseSnapshot: { type: mongoose.Schema.Types.Mixed, required() { return !["failed", "abandoned"].includes(this.status); } },
  createdAt: { type: Date, default: Date.now, required: true },
}, { collection: "quizcreationrequests" });

quizCreationRequestSchema.index(
  { adminId: 1, quizSetId: 1, creationRequestId: 1 },
  { name: "one_set_quiz_creation_request", unique: true }
);

module.exports = mongoose.model("QuizCreationRequest", quizCreationRequestSchema);
