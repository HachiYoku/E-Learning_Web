const mongoose = require("mongoose");

const mediaSnapshotSchema = new mongoose.Schema({
  url: { type: String, trim: true, default: "" },
  publicId: { type: String, trim: true, default: "" },
  resourceType: { type: String, trim: true, default: "" },
  format: { type: String, trim: true, default: "" },
}, { _id: false });

const questionSnapshotSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  prompt: { type: String, trim: true, default: "" },
  image: { type: mediaSnapshotSchema, default: () => ({}) },
  audio: { type: mediaSnapshotSchema, default: () => ({}) },
  options: { type: [{ type: String, trim: true }], default: [] },
  selectedAnswer: { type: Number, min: 0, required: true },
  correctAnswer: { type: Number, min: 0, required: true },
  isCorrect: { type: Boolean, required: true },
}, { _id: false });

const submissionSnapshotSchema = new mongoose.Schema({
  contextType: { type: String, trim: true, default: "" },
  quizTitle: { type: String, trim: true, default: "" },
  quizRevision: { type: Number, min: 1, default: null },
  score: { type: Number, min: 0, default: null },
  total: { type: Number, min: 1, default: null },
  submittedAt: { type: Date, default: null },
  course: {
    id: { type: mongoose.Schema.Types.ObjectId, default: null },
    title: { type: String, trim: true, default: "" },
  },
  lesson: {
    id: { type: mongoose.Schema.Types.ObjectId, default: null },
    title: { type: String, trim: true, default: "" },
  },
  homeworkSet: {
    id: { type: mongoose.Schema.Types.ObjectId, default: null },
    title: { type: String, trim: true, default: "" },
  },
  questions: { type: [questionSnapshotSchema], default: [] },
}, { _id: false });

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true, immutable: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true, immutable: true },
    attemptNumber: { type: Number, required: true, min: 1, immutable: true },
    // Legacy answer indexes remain readable during the evolutionary rollout.
    answers: { type: [Number], default: [], immutable: true },
    score: { type: Number, required: true, min: 0, immutable: true },
    total: { type: Number, required: true, min: 1, immutable: true },
    // New submissions will carry this immutable complete historical view.
    submissionSnapshot: { type: submissionSnapshotSchema, default: undefined },
  },
  { timestamps: true }
);

quizAttemptSchema.index({ quiz: 1, user: 1, createdAt: -1 });
quizAttemptSchema.index(
  { quiz: 1, user: 1, attemptNumber: 1 },
  { unique: true, partialFilterExpression: { attemptNumber: { $exists: true } } }
);

// A Mongoose nested subdocument can otherwise be changed even when its parent
// path is marked immutable. Preserve the persisted snapshot on document saves;
// application code must create a new attempt for every retake.
quizAttemptSchema.pre("save", async function preserveCompletedSnapshot() {
  if (this.isNew) return;
  const existing = await this.constructor.findById(this._id).select("submissionSnapshot").lean();
  if (!existing) return;
  this.submissionSnapshot = existing.submissionSnapshot;
  this.unmarkModified("submissionSnapshot");
});

const IMMUTABLE_SUBMISSION_PATHS = new Set([
  "quiz", "user", "attemptNumber", "answers", "score", "total", "submissionSnapshot",
]);

function touchesImmutableSubmissionPath(update) {
  const values = Object.entries(update || {}).flatMap(([operator, value]) => {
    if (operator.startsWith("$")) return Object.keys(value || {});
    return Object.keys(update || {});
  });
  return values.some((path) => [...IMMUTABLE_SUBMISSION_PATHS].some((field) => path === field || path.startsWith(`${field}.`)));
}

quizAttemptSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne"], function rejectSubmissionMutation() {
  if (touchesImmutableSubmissionPath(this.getUpdate())) {
    throw new Error("Quiz submissions are immutable. Create a new submission instead.");
  }
});

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
