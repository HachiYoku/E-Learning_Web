const mongoose = require("mongoose");

const keyVocabularySchema = new mongoose.Schema({
  thai: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  translation: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160,
  },
  transliteration: {
    type: String,
    trim: true,
    maxlength: 160,
    default: "",
  },
});

const lessonSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    keyVocabulary: {
      type: [keyVocabularySchema],
      default: [],
      validate: {
        validator: (entries) => Array.isArray(entries) && entries.length <= 50,
        message: "A lesson can have at most 50 key vocabulary entries.",
      },
    },
  },
  { timestamps: true }
);

lessonSchema.index({ course: 1, order: 1 }, { unique: true });

module.exports = mongoose.model("Lesson", lessonSchema);
