const mongoose = require("mongoose");

const flashcardSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true, maxlength: 280 },
    answer: { type: String, required: true, trim: true, maxlength: 280 },
    translation: { type: String, trim: true, maxlength: 280, default: "" },
    image: { type: String, trim: true, default: "" },
    imagePublicId: { type: String, trim: true, default: "" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "FlashcardCategory", required: true, index: true },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Flashcard", flashcardSchema);
