const mongoose = require("mongoose");
const PersonalFlashcardDeck = require("../models/personalFlashcardDeckModel");
const PersonalFlashcard = require("../models/personalFlashcardModel");

const DECK_NOT_FOUND = "Flashcard deck not found.";
const CARD_NOT_FOUND = "Flashcard not found.";

const isObjectId = (value) => mongoose.isValidObjectId(value);
const text = (value) => typeof value === "string" ? value.trim() : "";

function deckResponse(deck, cardCount = 0) {
  return {
    _id: deck._id,
    name: deck.name,
    cardCount,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
  };
}

function cardResponse(card) {
  return {
    _id: card._id,
    prompt: card.prompt,
    answer: card.answer,
  };
}

function deckName(body) {
  const name = text(body?.name);
  if (!name) return null;
  return name;
}

function cardFields(body) {
  const prompt = text(body?.prompt);
  const answer = text(body?.answer);
  if (!prompt || !answer) return null;
  return { prompt, answer };
}

function sendError(res, error) {
  if (error?.code === 11000) return res.status(409).json({ message: "You already have a flashcard deck with that name." });
  if (error?.name === "ValidationError") return res.status(400).json({ message: error.message });
  return res.status(500).json({ message: error.message });
}

exports.listDecks = async (req, res) => {
  try {
    const decks = await PersonalFlashcardDeck.aggregate([
      { $match: { ownerId: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $lookup: {
          from: PersonalFlashcard.collection.name,
          let: { deckId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$deckId", "$$deckId"] } } },
            { $count: "count" },
          ],
          as: "cardCountResult",
        },
      },
      { $addFields: { cardCount: { $ifNull: [{ $arrayElemAt: ["$cardCountResult.count", 0] }, 0] } } },
      { $project: { name: 1, cardCount: 1, createdAt: 1, updatedAt: 1 } },
      { $sort: { updatedAt: -1, _id: -1 } },
    ]);
    return res.json(decks);
  } catch (error) { return sendError(res, error); }
};

exports.createDeck = async (req, res) => {
  const name = deckName(req.body);
  if (!name) return res.status(400).json({ message: "A flashcard deck name is required." });
  try {
    const deck = await PersonalFlashcardDeck.create({ ownerId: req.user.id, name });
    return res.status(201).json(deckResponse(deck));
  } catch (error) { return sendError(res, error); }
};

exports.updateDeck = async (req, res) => {
  const name = deckName(req.body);
  if (!name) return res.status(400).json({ message: "A flashcard deck name is required." });
  if (!isObjectId(req.params.deckId)) return res.status(404).json({ message: DECK_NOT_FOUND });
  try {
    const deck = await PersonalFlashcardDeck.findOneAndUpdate(
      { _id: req.params.deckId, ownerId: req.user.id },
      { $set: { name } },
      { new: true, runValidators: true }
    );
    if (!deck) return res.status(404).json({ message: DECK_NOT_FOUND });
    const cardCount = await PersonalFlashcard.countDocuments({ ownerId: req.user.id, deckId: deck._id });
    return res.json(deckResponse(deck, cardCount));
  } catch (error) { return sendError(res, error); }
};

exports.deleteDeck = async (req, res) => {
  if (!isObjectId(req.params.deckId)) return res.status(404).json({ message: DECK_NOT_FOUND });
  try {
    let deletedCardCount = 0;
    const deleted = await mongoose.connection.transaction(async (session) => {
      const deck = await PersonalFlashcardDeck.findOne({ _id: req.params.deckId, ownerId: req.user.id }).session(session);
      if (!deck) return false;
      const cardDeletion = await PersonalFlashcard.deleteMany({ ownerId: req.user.id, deckId: deck._id }, { session });
      deletedCardCount = cardDeletion.deletedCount;
      await deck.deleteOne({ session });
      return true;
    });
    if (!deleted) return res.status(404).json({ message: DECK_NOT_FOUND });
    return res.json({ deletedCardCount });
  } catch (error) { return sendError(res, error); }
};

exports.listCards = async (req, res) => {
  if (!isObjectId(req.params.deckId)) return res.status(404).json({ message: DECK_NOT_FOUND });
  try {
    const deck = await PersonalFlashcardDeck.exists({ _id: req.params.deckId, ownerId: req.user.id });
    if (!deck) return res.status(404).json({ message: DECK_NOT_FOUND });
    const cards = await PersonalFlashcard.find({ ownerId: req.user.id, deckId: req.params.deckId })
      .select("prompt answer")
      .sort({ createdAt: -1 });
    return res.json(cards.map(cardResponse));
  } catch (error) { return sendError(res, error); }
};

exports.createCard = async (req, res) => {
  const fields = cardFields(req.body);
  if (!fields) return res.status(400).json({ message: "Flashcard prompt and answer are required." });
  if (!isObjectId(req.params.deckId)) return res.status(404).json({ message: DECK_NOT_FOUND });
  try {
    const deck = await PersonalFlashcardDeck.exists({ _id: req.params.deckId, ownerId: req.user.id });
    if (!deck) return res.status(404).json({ message: DECK_NOT_FOUND });
    const card = await PersonalFlashcard.create({ ownerId: req.user.id, deckId: req.params.deckId, ...fields });
    return res.status(201).json(cardResponse(card));
  } catch (error) { return sendError(res, error); }
};

exports.updateCard = async (req, res) => {
  const fields = cardFields(req.body);
  if (!fields) return res.status(400).json({ message: "Flashcard prompt and answer are required." });
  if (!isObjectId(req.params.deckId) || !isObjectId(req.params.cardId)) return res.status(404).json({ message: CARD_NOT_FOUND });
  try {
    const card = await PersonalFlashcard.findOneAndUpdate(
      { _id: req.params.cardId, deckId: req.params.deckId, ownerId: req.user.id },
      { $set: fields },
      { new: true, runValidators: true }
    );
    if (!card) return res.status(404).json({ message: CARD_NOT_FOUND });
    return res.json(cardResponse(card));
  } catch (error) { return sendError(res, error); }
};

exports.deleteCard = async (req, res) => {
  if (!isObjectId(req.params.deckId) || !isObjectId(req.params.cardId)) return res.status(404).json({ message: CARD_NOT_FOUND });
  try {
    const card = await PersonalFlashcard.findOneAndDelete({ _id: req.params.cardId, deckId: req.params.deckId, ownerId: req.user.id });
    if (!card) return res.status(404).json({ message: CARD_NOT_FOUND });
    return res.json({ message: "Flashcard deleted successfully" });
  } catch (error) { return sendError(res, error); }
};
