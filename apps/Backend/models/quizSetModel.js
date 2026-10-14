const mongoose = require("mongoose");

const QUIZ_SET_STATUSES = ["disabled", "active", "archived"];
const QUIZ_SET_DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

const quizSetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  coverImage: { type: String, trim: true, maxlength: 2048, default: "" },
  difficulty: { type: String, enum: QUIZ_SET_DIFFICULTIES, default: null },
  status: { type: String, enum: QUIZ_SET_STATUSES, default: "disabled", required: true },
  displayOrder: { type: Number, min: 1, default: 1, required: true },
  version: { type: Number, min: 1, default: 1, required: true },
  runtimeEpoch: { type: Number, min: 0, default: 0, required: true },
  runtimeFence: { type: Number, min: 0, default: 0, required: true },
}, { timestamps: true });

quizSetSchema.pre("validate", function validateSet() {
  if (!this.name?.trim()) this.invalidate("name", "A Quiz Set name is required.");
  if (!Number.isSafeInteger(this.displayOrder)) this.invalidate("displayOrder", "Display order must be an integer.");
  if (!Number.isSafeInteger(this.version)) this.invalidate("version", "Version must be an integer.");
  if (!Number.isSafeInteger(this.runtimeEpoch)) this.invalidate("runtimeEpoch", "Runtime epoch must be an integer.");
  if (!Number.isSafeInteger(this.runtimeFence)) this.invalidate("runtimeFence", "Runtime fence must be an integer.");
});

quizSetSchema.index({ status: 1, displayOrder: 1, _id: 1 }, { name: "quiz_set_catalog" });
quizSetSchema.index({ status: 1, difficulty: 1, displayOrder: 1, _id: 1 }, { name: "quiz_set_difficulty_catalog" });

module.exports = mongoose.model("QuizSet", quizSetSchema);
module.exports.QUIZ_SET_STATUSES = QUIZ_SET_STATUSES;
module.exports.QUIZ_SET_DIFFICULTIES = QUIZ_SET_DIFFICULTIES;
