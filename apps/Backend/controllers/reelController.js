const Reel = require("../models/reelModel");
const { resolveReelUrl } = require("../services/reelUrl");

const publicFields = "_id url platform displayOrder";
const order = { displayOrder: 1, createdAt: 1, _id: 1 };

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

async function fields(body, { partial = false } = {}) {
  const next = {};
  if (!partial || Object.hasOwn(body || {}, "url")) Object.assign(next, await resolveReelUrl(body?.url));
  if (!partial || Object.hasOwn(body || {}, "displayOrder")) {
    const displayOrder = Number(body?.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 0) throw validationError("Display order must be a non-negative integer.");
    next.displayOrder = displayOrder;
  }
  if (!partial || Object.hasOwn(body || {}, "isActive")) {
    if (typeof body?.isActive !== "boolean") throw validationError("isActive must be a boolean.");
    next.isActive = body.isActive;
  }
  return next;
}

function respondError(res, error, fallback) {
  if (error?.code === 11000) return res.status(409).json({ message: "This Reel URL already exists." });
  return res.status(error?.status || 500).json({ message: error?.message || fallback });
}

exports.getPublicReels = async (_req, res) => {
  try {
    const reels = await Reel.find({ isActive: true }).select(publicFields).sort(order).lean();
    return res.json({ reels });
  } catch (error) {
    return respondError(res, error, "Unable to load Reels.");
  }
};

exports.getAdminReels = async (_req, res) => {
  try {
    return res.json(await Reel.find().sort(order).lean());
  } catch (error) {
    return respondError(res, error, "Unable to load Reels.");
  }
};

exports.createReel = async (req, res) => {
  try {
    const reel = await Reel.create(await fields(req.body));
    return res.status(201).json(reel);
  } catch (error) {
    return respondError(res, error, "Unable to create Reel.");
  }
};

exports.updateReel = async (req, res) => {
  try {
    const update = await fields(req.body, { partial: true });
    if (!Object.keys(update).length) throw validationError("Provide a Reel URL, display order, or active status.");
    const reel = await Reel.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: "after", runValidators: true });
    if (!reel) return res.status(404).json({ message: "Reel not found." });
    return res.json(reel);
  } catch (error) {
    return respondError(res, error, "Unable to update Reel.");
  }
};

exports.deleteReel = async (req, res) => {
  try {
    const reel = await Reel.findByIdAndDelete(req.params.id);
    if (!reel) return res.status(404).json({ message: "Reel not found." });
    return res.json({ message: "Reel deleted successfully." });
  } catch (error) {
    return respondError(res, error, "Unable to delete Reel.");
  }
};
