const mongoose = require("mongoose");

const flashcardReviewProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Public is reserved for a later phase. V1 APIs only operate on personal cards.
    cardType: { type: String, enum: ["personal", "public"], required: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, required: true },
    lastReviewedAt: { type: Date, required: true },
    nextReviewAt: { type: Date, required: true },
    lastRating: { type: String, enum: ["again", "hard", "easy"], required: true },
    reviewCount: { type: Number, required: true, min: 1, default: 1 },
    intervalMinutes: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

flashcardReviewProgressSchema.index({ userId: 1, cardType: 1, cardId: 1 }, { unique: true });
flashcardReviewProgressSchema.index({ userId: 1, cardType: 1, nextReviewAt: 1 });

module.exports = mongoose.model("FlashcardReviewProgress", flashcardReviewProgressSchema);
