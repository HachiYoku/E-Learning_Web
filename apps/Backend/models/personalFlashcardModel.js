const mongoose = require("mongoose");

const personalFlashcardSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PersonalFlashcardDeck",
      required: true,
      index: true,
    },
    prompt: { type: String, required: true, trim: true, maxlength: 280 },
    answer: { type: String, required: true, trim: true, maxlength: 280 },
  },
  { timestamps: true }
);

personalFlashcardSchema.index({ ownerId: 1, deckId: 1, createdAt: -1 });

module.exports = mongoose.model("PersonalFlashcard", personalFlashcardSchema);
