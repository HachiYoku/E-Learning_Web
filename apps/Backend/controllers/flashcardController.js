const Flashcard = require("../models/flashcardModel");
const FlashcardCategory = require("../models/flashcardCategoryModel");
const { uploadStream } = require("../services/uploadStream");

function cardFields(body) {
  return {
    prompt: String(body.prompt || "").trim(),
    answer: String(body.answer || "").trim(),
    translation: String(body.translation || "").trim(),
    isPublished: body.isPublished !== "false" && body.isPublished !== false,
  };
}

async function findCategory(categoryId) {
  if (!categoryId || !require("mongoose").isValidObjectId(categoryId)) return null;
  return FlashcardCategory.findById(categoryId);
}

async function assignLegacyCards() {
  const legacyCards = await Flashcard.exists({ $or: [{ category: { $exists: false } }, { category: null }] });
  if (!legacyCards) return;
  const category = await FlashcardCategory.findOneAndUpdate(
    { name: "Uncategorized" },
    { $setOnInsert: { name: "Uncategorized" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await Flashcard.updateMany({ $or: [{ category: { $exists: false } }, { category: null }] }, { $set: { category: category._id } });
}

async function applyImage(card, file) {
  if (!file) return;
  const upload = await uploadStream(file.buffer, "english_kafe/flashcards");
  card.image = upload.secure_url;
  card.imagePublicId = upload.public_id;
}

exports.getPublicFlashcards = async (_req, res) => {
  try {
    await assignLegacyCards();
    const cards = await Flashcard.find({ isPublished: true }).select("prompt answer translation image category").populate("category", "name").sort({ createdAt: -1 });
    return res.json(cards);
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

exports.getAdminFlashcards = async (_req, res) => {
  try { await assignLegacyCards(); return res.json(await Flashcard.find().populate("category", "name").sort({ createdAt: -1 })); }
  catch (error) { return res.status(500).json({ message: error.message }); }
};

exports.createFlashcard = async (req, res) => {
  try {
    const fields = cardFields(req.body);
    if (!fields.prompt || !fields.answer) return res.status(400).json({ message: "Front prompt and back answer are required." });
    const category = await findCategory(req.body.category);
    if (!category) return res.status(400).json({ message: "Choose a valid flashcard category." });
    const card = new Flashcard({ ...fields, category: category._id });
    await applyImage(card, req.file);
    await card.save();
    await card.populate("category", "name");
    return res.status(201).json(card);
  } catch (error) { return res.status(400).json({ message: error.message }); }
};

exports.updateFlashcard = async (req, res) => {
  try {
    const card = await Flashcard.findById(req.params.flashcardId);
    if (!card) return res.status(404).json({ message: "Flashcard not found" });
    const fields = cardFields(req.body);
    if (!fields.prompt || !fields.answer) return res.status(400).json({ message: "Front prompt and back answer are required." });
    const category = await findCategory(req.body.category);
    if (!category) return res.status(400).json({ message: "Choose a valid flashcard category." });
    Object.assign(card, { ...fields, category: category._id });
    await applyImage(card, req.file);
    await card.save();
    await card.populate("category", "name");
    return res.json(card);
  } catch (error) { return res.status(400).json({ message: error.message }); }
};

exports.getCategories = async (_req, res) => {
  try {
    const categories = await FlashcardCategory.aggregate([
      { $lookup: { from: "flashcards", localField: "_id", foreignField: "category", as: "cards" } },
      { $addFields: { cardCount: { $size: "$cards" } } },
      { $project: { cards: 0 } },
      { $sort: { name: 1 } },
    ]);
    return res.json(categories);
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

exports.createCategory = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "A category name is required." });
    const category = await FlashcardCategory.create({ name });
    return res.status(201).json({ ...category.toObject(), cardCount: 0 });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? "A category with that name already exists." : error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "A category name is required." });
    const category = await FlashcardCategory.findByIdAndUpdate(req.params.categoryId, { name }, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ message: "Flashcard category not found." });
    const cardCount = await Flashcard.countDocuments({ category: category._id });
    return res.json({ ...category.toObject(), cardCount });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? "A category with that name already exists." : error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await FlashcardCategory.findById(req.params.categoryId);
    if (!category) return res.status(404).json({ message: "Flashcard category not found." });
    if (await Flashcard.exists({ category: category._id })) return res.status(400).json({ message: "Move or delete this category's flashcards before deleting it." });
    await category.deleteOne();
    return res.json({ message: "Flashcard category deleted successfully" });
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

exports.deleteFlashcard = async (req, res) => {
  try {
    const card = await Flashcard.findByIdAndDelete(req.params.flashcardId);
    if (!card) return res.status(404).json({ message: "Flashcard not found" });
    return res.json({ message: "Flashcard deleted successfully" });
  } catch (error) { return res.status(500).json({ message: error.message }); }
};
