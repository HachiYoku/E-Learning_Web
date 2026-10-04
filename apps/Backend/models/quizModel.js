const mongoose = require("mongoose");

const QUIZ_CONTEXTS = ["course_lesson", "course_final", "homework_lesson", "homework_final", "standalone"];
const QUIZ_STATUSES = ["draft", "published", "disabled", "archived"];
const STANDALONE_ACCESS = ["public", "students"];
const FINAL_CONTEXTS = new Set(["course_final", "homework_final"]);

const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, trim: true, maxlength: 280, default: "" },
    // Keep the legacy URL/public-id fields so existing readers remain
    // compatible while Quiz media gains the metadata needed for ownership and
    // lifecycle handling in the later media phase.
    image: { type: String, trim: true, default: "" },
    imagePublicId: { type: String, trim: true },
    imageResourceType: { type: String, trim: true, default: "image" },
    imageFormat: { type: String, trim: true, default: "" },
    audio: { type: String, trim: true, default: "" },
    audioPublicId: { type: String, trim: true, default: "" },
    audioResourceType: { type: String, trim: true, default: "" },
    audioFormat: { type: String, trim: true, default: "" },
    options: {
      type: [{ type: String, trim: true }],
      validate: {
        validator: (options) => Array.isArray(options) && options.length >= 2 && options.length <= 6 && options.every(Boolean),
        message: "Each question needs between 2 and 6 answer options.",
      },
    },
    correctAnswer: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

questionSchema.pre("validate", function validateQuestion() {
  if (!String(this.prompt || "").trim() && !String(this.image || "").trim() && !String(this.audio || "").trim()) {
    this.invalidate("prompt", "Each question needs text, an image, or audio.");
  }

  if (Number.isInteger(this.correctAnswer) && this.options?.length && this.correctAnswer < this.options.length) {
    return;
  }

  this.invalidate("correctAnswer", "Correct answer must refer to one of the options.");
});

const quizSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null, index: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null, index: true },
    homeworkSet: { type: mongoose.Schema.Types.ObjectId, ref: "HomeworkSet", default: null, index: true },
    contextType: { type: String, enum: QUIZ_CONTEXTS, default: undefined, index: true },
    status: { type: String, enum: QUIZ_STATUSES, default: "draft", index: true },
    standaloneAccess: { type: String, enum: STANDALONE_ACCESS, default: null },
    revision: { type: Number, default: 1, min: 1 },
    sortOrder: { type: Number, default: null, min: 1 },
    quizType: { type: String, enum: ["lesson", "course"], default: "lesson", index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    maxAttempts: { type: Number, min: 1, default: null },
    goalPercent: { type: Number, min: 0, max: 100, default: null },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true }
);

function inferLegacyContext(quiz) {
  if (quiz.contextType) return quiz.contextType;
  if (quiz.homeworkSet) return quiz.quizType === "course" ? "homework_final" : "homework_lesson";
  return quiz.quizType === "course" ? "course_final" : "course_lesson";
}

function invalidateContext(quiz, field, message) {
  quiz.invalidate(field, message);
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value) !== "";
}

function validateQuizContext(quiz) {
  const context = inferLegacyContext(quiz);
  quiz.contextType = context;

  const hasCourse = hasValue(quiz.course);
  const hasLesson = hasValue(quiz.lesson);
  const hasHomeworkSet = hasValue(quiz.homeworkSet);

  if (context === "course_lesson") {
    if (!hasCourse) invalidateContext(quiz, "course", "A course lesson quiz requires a course.");
    if (!hasLesson) invalidateContext(quiz, "lesson", "A course lesson quiz requires a lesson.");
    if (hasHomeworkSet) invalidateContext(quiz, "homeworkSet", "A course lesson quiz cannot belong to a homework set.");
    quiz.quizType = "lesson";
  } else if (context === "course_final") {
    if (!hasCourse) invalidateContext(quiz, "course", "A course final quiz requires a course.");
    if (hasLesson) invalidateContext(quiz, "lesson", "A course final quiz cannot belong to a lesson.");
    if (hasHomeworkSet) invalidateContext(quiz, "homeworkSet", "A course final quiz cannot belong to a homework set.");
    quiz.quizType = "course";
  } else if (context === "homework_lesson") {
    if (!hasHomeworkSet) invalidateContext(quiz, "homeworkSet", "A homework lesson quiz requires a homework set.");
    if (hasCourse) invalidateContext(quiz, "course", "A homework lesson quiz cannot belong to a course.");
    if (hasLesson) invalidateContext(quiz, "lesson", "A homework lesson quiz cannot belong to a lesson.");
    quiz.quizType = "lesson";
  } else if (context === "homework_final") {
    if (!hasHomeworkSet) invalidateContext(quiz, "homeworkSet", "A homework final quiz requires a homework set.");
    if (hasCourse) invalidateContext(quiz, "course", "A homework final quiz cannot belong to a course.");
    if (hasLesson) invalidateContext(quiz, "lesson", "A homework final quiz cannot belong to a lesson.");
    quiz.quizType = "course";
  } else if (context === "standalone") {
    if (hasCourse) invalidateContext(quiz, "course", "A standalone quiz cannot belong to a course.");
    if (hasLesson) invalidateContext(quiz, "lesson", "A standalone quiz cannot belong to a lesson.");
    if (hasHomeworkSet) invalidateContext(quiz, "homeworkSet", "A standalone quiz cannot belong to a homework set.");
    if (!quiz.standaloneAccess) quiz.standaloneAccess = "students";
    quiz.quizType = "lesson";
  }

  if (context !== "standalone" && quiz.standaloneAccess) {
    invalidateContext(quiz, "standaloneAccess", "Only standalone quizzes can define standalone access.");
  }

  if (FINAL_CONTEXTS.has(context) && (quiz.maxAttempts === null || quiz.maxAttempts === undefined)) {
    // Finals are always finite. This preserves the approved default for both
    // legacy Admin creation and future final-quiz management flows.
    quiz.maxAttempts = 3;
  } else if (!FINAL_CONTEXTS.has(context)) {
    // Legacy clients may still submit this field for lesson quizzes. Keeping
    // it null makes unlimited-retake semantics explicit without rejecting an
    // otherwise valid transitional request.
    quiz.maxAttempts = null;
    quiz.goalPercent = null;
  }
}

function scoringFieldsChanged(quiz) {
  return [
    "questions",
    "contextType",
    "course",
    "lesson",
    "homeworkSet",
    "status",
    "maxAttempts",
    "goalPercent",
  ].some((field) => quiz.isModified(field));
}

quizSchema.pre("validate", function validateContext() {
  validateQuizContext(this);
});

quizSchema.pre("validate", async function validateLessonCourseOwnership() {
  if (this.contextType !== "course_lesson" || !hasValue(this.course) || !hasValue(this.lesson)) return;
  const Lesson = require("./lessonModel");
  const lesson = await Lesson.findById(this.lesson).select("course").lean();
  if (!lesson || String(lesson.course) !== String(this.course)) {
    this.invalidate("lesson", "Lesson must belong to the quiz course.");
  }
});

quizSchema.pre("save", function incrementRevisionForScoringChanges() {
  if (!this.isNew && scoringFieldsChanged(this) && !this.$locals.quizRevisionAlreadyIncremented) {
    this.revision = Number(this.revision || 1) + 1;
  }
});

quizSchema.methods.markScoringChange = function markScoringChange() {
  if (!this.isNew) {
    this.revision = Number(this.revision || 1) + 1;
    this.$locals.quizRevisionAlreadyIncremented = true;
  }
  return this;
};

// Context-specific uniqueness is enforced by MongoDB, not only the Admin UI.
quizSchema.index(
  { lesson: 1, contextType: 1 },
  { unique: true, partialFilterExpression: { contextType: "course_lesson", lesson: { $type: "objectId" } } }
);
quizSchema.index(
  { course: 1, contextType: 1 },
  { unique: true, partialFilterExpression: { contextType: "course_final", course: { $type: "objectId" } } }
);
quizSchema.index(
  { homeworkSet: 1, contextType: 1 },
  { unique: true, partialFilterExpression: { contextType: "homework_final", homeworkSet: { $type: "objectId" } } }
);
quizSchema.index(
  { homeworkSet: 1, sortOrder: 1 },
  { unique: true, partialFilterExpression: { contextType: "homework_lesson", sortOrder: { $type: "number" } } }
);

quizSchema.statics.validateContext = validateQuizContext;
quizSchema.statics.scoringFieldsChanged = scoringFieldsChanged;

const Quiz = mongoose.model("Quiz", quizSchema);

module.exports = Quiz;
module.exports.QUIZ_CONTEXTS = QUIZ_CONTEXTS;
module.exports.QUIZ_STATUSES = QUIZ_STATUSES;
module.exports.STANDALONE_ACCESS = STANDALONE_ACCESS;
module.exports.FINAL_CONTEXTS = FINAL_CONTEXTS;
