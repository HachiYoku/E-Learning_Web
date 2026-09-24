const PromoCode = require("../models/promoCodeModel");
const PromoRedemption = require("../models/promoRedemptionModel");
const Course = require("../models/courseModel");
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { writeAuditLog } = require("../services/auditLogger");
const { availabilityMessages, getPromoAvailability, calculatePromoDiscount, hasPromoHistory } = require("../services/promoCodePolicy");

const cleanCode = (code) => String(code || "").trim().toUpperCase();
const asDate = (value) => value ? new Date(value) : null;
const sameDate = (left, right) => (left?.getTime?.() || null) === (right?.getTime?.() || null);

const validateFields = (body) => {
  const code = cleanCode(body.code);
  const discountType = body.discountType;
  const discountValue = Number(body.discountValue);
  if (!/^[A-Z0-9-]{3,40}$/.test(code)) throw new Error("Use 3-40 letters, numbers, or hyphens for the code.");
  if (!["percent", "fixed"].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "percent" && discountValue > 100)) throw new Error("Enter a valid discount.");
  const startsAt = asDate(body.startsAt);
  const expiresAt = asDate(body.expiresAt);
  const usageLimit = body.usageLimit ? Number(body.usageLimit) : null;
  const applicableCourses = Array.isArray(body.applicableCourses) ? body.applicableCourses.map(String) : [];
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (expiresAt && Number.isNaN(expiresAt.getTime())) || (startsAt && expiresAt && expiresAt < startsAt)) throw new Error("Enter valid dates, with expiry after the start date.");
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) throw new Error("Usage limit must be a whole number of at least 1.");
  return { code, discountType, discountValue, applicableCourses, startsAt, expiresAt, usageLimit, isActive: body.isActive !== false };
};

const changedUsedFields = (promo, fields) => (
  promo.code !== fields.code
  || promo.discountType !== fields.discountType
  || Number(promo.discountValue) !== fields.discountValue
  || Number(promo.usageLimit || 0) !== Number(fields.usageLimit || 0)
  || !sameDate(promo.startsAt, fields.startsAt)
  || !sameDate(promo.expiresAt, fields.expiresAt)
  || promo.applicableCourses.map(String).sort().join(",") !== fields.applicableCourses.slice().sort().join(",")
);

async function verifyAdminPassword(userId, password, action) {
  if (typeof password !== "string" || !password.trim()) throw Object.assign(new Error(`Admin password is required to ${action} a promo code.`), { status: 400 });
  const admin = await User.findById(userId).select("+password");
  if (!admin || !bcrypt.compareSync(password, admin.password)) throw Object.assign(new Error("Invalid admin password"), { status: 403 });
}

exports.validatePromo = async (req, res) => {
  try {
    const course = await Course.findById(req.body.courseId).select("price originalPrice");
    if (!course) return res.status(400).json({ message: availabilityMessages["wrong-course"] });
    if (Number(course.originalPrice ?? course.price) > Number(course.price)) return res.status(400).json({ message: "This course is already discounted, so a promo code cannot be applied." });
    const promo = await PromoCode.findOne({ code: cleanCode(req.body.code) });
    const reason = getPromoAvailability(promo, course._id);
    if (reason) return res.status(400).json({ message: availabilityMessages[reason] });
    if (await PromoRedemption.exists({ promoCode: promo._id, userId: req.user.id })) return res.status(400).json({ message: availabilityMessages["already-used"] });
    return res.json({ code: promo.code, ...calculatePromoDiscount(course.price, promo) });
  } catch (error) { return res.status(500).json({ message: error.message }); }
};

exports.listPromos = async (_req, res) => {
  try {
    const promos = await PromoCode.find().populate("applicableCourses", "title").sort({ createdAt: -1 }).lean();
    const withHistory = await Promise.all(promos.map(async (promo) => ({ ...promo, hasHistory: await hasPromoHistory(promo) })));
    res.json(withHistory);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.createPromo = async (req, res) => {
  try {
    await verifyAdminPassword(req.user?.id, req.body?.adminPassword, "create");
    const promo = await PromoCode.create(validateFields(req.body));
    await writeAuditLog({ actorId: req.user.id, action: "promo.created", targetType: "promo", targetId: promo._id, metadata: { code: promo.code } });
    return res.status(201).json(promo);
  } catch (error) { return res.status(error.status || 400).json({ message: error.code === 11000 ? "This promo code already exists." : error.message }); }
};

exports.updatePromo = async (req, res) => {
  try {
    await verifyAdminPassword(req.user?.id, req.body?.adminPassword, "update");
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ message: "Promo code not found" });
    const fields = validateFields(req.body);
    if (promo.archivedAt) return res.status(400).json({ message: "Archived promo codes cannot be changed." });
    if (await hasPromoHistory(promo)) {
      if (changedUsedFields(promo, fields)) return res.status(400).json({ message: "A promo code with payment history can only be activated or deactivated; its offer details are preserved." });
      promo.isActive = fields.isActive;
    } else {
      Object.assign(promo, fields);
    }
    await promo.save();
    await writeAuditLog({ actorId: req.user.id, action: "promo.updated", targetType: "promo", targetId: promo._id, metadata: { code: promo.code, isActive: promo.isActive } });
    const saved = await PromoCode.findById(promo._id).populate("applicableCourses", "title").lean();
    return res.json({ ...saved, hasHistory: await hasPromoHistory(promo) });
  } catch (error) { return res.status(error.status || 400).json({ message: error.message }); }
};

exports.deletePromo = async (req, res) => {
  try {
    await verifyAdminPassword(req.user?.id, req.body?.adminPassword, "delete");
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ message: "Promo code not found" });
    if (await hasPromoHistory(promo)) {
      promo.isActive = false;
      promo.archivedAt = new Date();
      await promo.save();
      await writeAuditLog({ actorId: req.user.id, action: "promo.archived", targetType: "promo", targetId: promo._id, metadata: { code: promo.code } });
      return res.json({ message: "Promo code has payment history and was archived instead.", archived: true, promo: { ...promo.toObject(), hasHistory: true } });
    }
    await promo.deleteOne();
    await writeAuditLog({ actorId: req.user.id, action: "promo.deleted", targetType: "promo", targetId: promo._id, metadata: { code: promo.code } });
    return res.json({ message: "Promo code deleted" });
  } catch (error) { return res.status(error.status || 500).json({ message: error.message }); }
};
