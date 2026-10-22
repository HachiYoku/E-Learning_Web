const mongoose = require("mongoose");

// Retained indefinitely: expiring a key would allow a delayed retry to create
// another quiz. The snapshot is the original Admin creation response only.
const quizCreationRequestSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quizSetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  creationRequestId: { type: String, required: true },
  payloadHash: { type: String, required: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, required: true },
  responseSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, required: true },
}, { collection: "quizcreationrequests" });

quizCreationRequestSchema.index(
  { adminId: 1, quizSetId: 1, creationRequestId: 1 },
  { name: "one_set_quiz_creation_request", unique: true }
);

module.exports = mongoose.model("QuizCreationRequest", quizCreationRequestSchema);
