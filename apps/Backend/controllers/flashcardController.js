const Flashcard = require("../models/flashcardModel");
const { uploadStream } = require("../services/uploadStream");

function cardFields(body) {
  return {
    prompt: String(body.prompt || "").trim(),
    answer: String(body.answer || "").trim(),
    translation: String(body.translation || "").trim(),
    isPublished: body.isPublished !== "false" && body.isPublished !== false,
  };
}

async function applyImage(card, file) {
  if (!file) return;
  const upload = await uploadStream(file.buffer, "english_kafe/flashcards");
  card.image = upload.secure_url;
  card.imagePublicId = upload.public_id;
}

exports.getPublicFlashcards = async (_req, res) => {
  try {
    const cards = await Flashcard.find({ isPublished: true }).select("prompt answer translation image").sort({ createdAt: -1 });
    return res.json(cards);
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

exports.getAdminFlashcards = async (_req, res) => {
  try { return res.json(await Flashcard.find().sort({ createdAt: -1 })); }
  catch (error) { return res.status(500).json({ message: error.message }); }
};

exports.createFlashcard = async (req, res) => {
  try {
    const fields = cardFields(req.body);
    if (!fields.prompt || !fields.answer) return res.status(400).json({ message: "Front prompt and back answer are required." });
    const card = new Flashcard(fields);
    await applyImage(card, req.file);
    await card.save();
    return res.status(201).json(card);
  } catch (error) { return res.status(400).json({ message: error.message }); }
};

exports.updateFlashcard = async (req, res) => {
  try {
    const card = await Flashcard.findById(req.params.flashcardId);
    if (!card) return res.status(404).json({ message: "Flashcard not found" });
    const fields = cardFields(req.body);
    if (!fields.prompt || !fields.answer) return res.status(400).json({ message: "Front prompt and back answer are required." });
    Object.assign(card, fields);
    await applyImage(card, req.file);
    await card.save();
    return res.json(card);
  } catch (error) { return res.status(400).json({ message: error.message }); }
};

exports.deleteFlashcard = async (req, res) => {
  try {
    const card = await Flashcard.findByIdAndDelete(req.params.flashcardId);
    if (!card) return res.status(404).json({ message: "Flashcard not found" });
    return res.json({ message: "Flashcard deleted successfully" });
  } catch (error) { return res.status(500).json({ message: error.message }); }
};
