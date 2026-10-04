const FlashcardReviewProgress = require("../models/flashcardReviewProgressModel");
const { buildReviewSchedule } = require("./flashcardReviewSchedule");

// Optimistic retries prevent concurrent ratings from losing a review-count
// increment while retaining a small, adjustable pure scheduling algorithm.
async function recordPersonalRating({ userId, cardId, rating, now = new Date() }) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const existing = await FlashcardReviewProgress.findOne({ userId, cardType: "personal", cardId }).lean();
    const schedule = buildReviewSchedule(existing, rating, now);

    if (!existing) {
      try {
        return await FlashcardReviewProgress.create({
          userId,
          cardType: "personal",
          cardId,
          lastRating: rating,
          reviewCount: 1,
          ...schedule,
        });
      } catch (error) {
        if (error?.code === 11000) continue;
        throw error;
      }
    }

    const updated = await FlashcardReviewProgress.findOneAndUpdate(
      { _id: existing._id, reviewCount: existing.reviewCount },
      { $set: { lastRating: rating, ...schedule }, $inc: { reviewCount: 1 } },
      { returnDocument: "after", runValidators: true }
    );
    if (updated) return updated;
  }
  const error = new Error("Unable to save the flashcard review. Please try again.");
  error.status = 409;
  throw error;
}

module.exports = { recordPersonalRating };
