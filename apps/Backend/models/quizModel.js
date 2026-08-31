const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, trim: true, maxlength: 280, default: "" },
    image: { type: String, required: true, trim: true },
    imagePublicId: { type: String, trim: true },
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

questionSchema.pre("validate", function validateCorrectAnswer() {
  if (Number.isInteger(this.correctAnswer) && this.options?.length && this.correctAnswer < this.options.length) {
    return;
  }

  this.invalidate("correctAnswer", "Correct answer must refer to one of the options.");
});

const quizSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null, index: true },
    quizType: { type: String, enum: ["lesson", "course"], default: "lesson", index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    maxAttempts: { type: Number, min: 1, default: null },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true }
);

// Unique index for lesson quizzes
quizSchema.index({ lesson: 1, title: 1 }, { unique: true, partialFilterExpression: { quizType: "lesson" } });

// Unique index for course quizzes
quizSchema.index({ course: 1, title: 1 }, { unique: true, partialFilterExpression: { quizType: "course" } });

module.exports = mongoose.model("Quiz", quizSchema);
