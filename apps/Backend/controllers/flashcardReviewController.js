const mongoose = require("mongoose");
const PersonalFlashcard = require("../models/personalFlashcardModel");
const FlashcardReviewProgress = require("../models/flashcardReviewProgressModel");
const { recordPersonalRating } = require("../services/flashcardReviewProgress");

const PERSONAL_SCOPE = "personal";
const MAX_DUE_LIMIT = 50;
const validRating = new Set(["again", "hard", "easy"]);

function reviewResponse(progress) {
  return {
    cardType: progress.cardType,
    cardId: progress.cardId,
    lastReviewedAt: progress.lastReviewedAt,
    nextReviewAt: progress.nextReviewAt,
    lastRating: progress.lastRating,
    reviewCount: progress.reviewCount,
    intervalMinutes: progress.intervalMinutes,
  };
}

function parsePersonalScope(scope) {
  return scope === PERSONAL_SCOPE;
}

function parseLimit(rawLimit) {
  if (rawLimit === undefined) return 20;
  if (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit)) return null;
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_DUE_LIMIT) return null;
  return limit;
}

exports.rate = async (req, res) => {
  const { cardType, cardId, rating } = req.body || {};
  if (cardType !== PERSONAL_SCOPE) return res.status(400).json({ message: "Only personal flashcard reviews are supported." });
  if (!mongoose.isValidObjectId(cardId)) return res.status(400).json({ message: "A valid flashcard is required." });
  if (!validRating.has(rating)) return res.status(400).json({ message: "A valid flashcard rating is required." });

  try {
    const card = await PersonalFlashcard.exists({ _id: cardId, ownerId: req.user.id });
    if (!card) return res.status(404).json({ message: "Flashcard not found." });
    const progress = await recordPersonalRating({ userId: req.user.id, cardId, rating });
    return res.status(200).json({ review: reviewResponse(progress) });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to save the flashcard review." });
  }
};

exports.due = async (req, res) => {
  if (!parsePersonalScope(req.query.scope)) return res.status(400).json({ message: "Only the personal review scope is supported." });
  const limit = parseLimit(req.query.limit);
  if (!limit) return res.status(400).json({ message: `limit must be a whole number between 1 and ${MAX_DUE_LIMIT}.` });

  try {
    const progressRows = await FlashcardReviewProgress.find({
      userId: req.user.id,
      cardType: PERSONAL_SCOPE,
      nextReviewAt: { $lte: new Date() },
    }).sort({ nextReviewAt: 1, _id: 1 }).limit(limit).lean();
    const cardIds = progressRows.map((progress) => progress.cardId);
    const cards = await PersonalFlashcard.find({ _id: { $in: cardIds }, ownerId: req.user.id }).select("deckId prompt answer").lean();
    const cardsById = new Map(cards.map((card) => [String(card._id), card]));
    const staleProgressIds = progressRows.filter((progress) => !cardsById.has(String(progress.cardId))).map((progress) => progress._id);
    if (staleProgressIds.length) {
      await FlashcardReviewProgress.deleteMany({ _id: { $in: staleProgressIds }, userId: req.user.id, cardType: PERSONAL_SCOPE });
    }
    const reviews = progressRows.flatMap((progress) => {
      const card = cardsById.get(String(progress.cardId));
      return card ? [{ card: { _id: card._id, deckId: card.deckId, prompt: card.prompt, answer: card.answer }, review: reviewResponse(progress) }] : [];
    });
    return res.json({ reviews, limit });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load due flashcards." });
  }
};

exports.summary = async (req, res) => {
  if (!parsePersonalScope(req.query.scope)) return res.status(400).json({ message: "Only the personal review scope is supported." });
  try {
    const [summary] = await FlashcardReviewProgress.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id), cardType: PERSONAL_SCOPE, nextReviewAt: { $lte: new Date() } } },
      { $lookup: { from: PersonalFlashcard.collection.name, localField: "cardId", foreignField: "_id", as: "card" } },
      { $unwind: "$card" },
      { $match: { "card.ownerId": new mongoose.Types.ObjectId(req.user.id) } },
      { $count: "dueCount" },
    ]);
    return res.json({ dueCount: summary?.dueCount || 0 });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load flashcard review summary." });
  }
};
