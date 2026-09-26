const PromoCode = require("../models/promoCodeModel");
const PromoRedemption = require("../models/promoRedemptionModel");
const Course = require("../models/courseModel");
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { paymentTransaction, paymentError } = require("../services/paymentTransaction");
const { writeAuditLog } = require("../services/auditLogger");
const { availabilityMessages, getPromoAvailability, calculatePromoDiscount, hasPromoHistory } = require("../services/promoCodePolicy");

const cleanCode = (code) => String(code || "").trim().toUpperCase();
const asDate = (value) => value ? new Date(value) : null;
const sameDate = (left, right) => (left?.getTime?.() || null) === (right?.getTime?.() || null);

const validateFields = (body) => {
  const code = cleanCode(body.code);
  const discountType = body.discountType;
  const discountValue = Number(body.discountValue);
  const fixedAmountsWasSupplied = body.fixedAmounts !== undefined;
  let fixedAmounts = body.fixedAmounts;
  if (typeof fixedAmounts === "string") { try { fixedAmounts = JSON.parse(fixedAmounts || "{}"); } catch (_error) { throw new Error("Fixed currency amounts must be valid."); } }
  fixedAmounts = fixedAmounts && typeof fixedAmounts === "object" ? fixedAmounts : {};
  const normalizedFixedAmounts = {};
  for (const currency of ["THB", "MMK"]) {
    if (fixedAmounts[currency] === undefined || fixedAmounts[currency] === null || fixedAmounts[currency] === "") continue;
    const amount = Number(fixedAmounts[currency]);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Enter a valid fixed ${currency} amount.`);
    normalizedFixedAmounts[currency] = amount;
  }
  if (!/^[A-Z0-9-]{3,40}$/.test(code)) throw new Error("Use 3-40 letters, numbers, or hyphens for the code.");
  if (!["percent", "fixed"].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "percent" && discountValue > 100)) throw new Error("Enter a valid discount.");
  // Compatibility only for existing API callers during the rollout. The new
  // admin form always supplies explicit values; old fixed promos remain THB.
  if (discountType === "fixed" && !Object.keys(normalizedFixedAmounts).length && !fixedAmountsWasSupplied) normalizedFixedAmounts.THB = discountValue;
  if (discountType === "fixed" && !Object.keys(normalizedFixedAmounts).length) throw new Error("Configure at least one fixed currency amount.");
  const startsAt = asDate(body.startsAt);
  const expiresAt = asDate(body.expiresAt);
  const usageLimit = body.usageLimit ? Number(body.usageLimit) : null;
  const applicableCourses = Array.isArray(body.applicableCourses) ? body.applicableCourses.map(String) : [];
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (expiresAt && Number.isNaN(expiresAt.getTime())) || (startsAt && expiresAt && expiresAt < startsAt)) throw new Error("Enter valid dates, with expiry after the start date.");
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) throw new Error("Usage limit must be a whole number of at least 1.");
  return { code, discountType, discountValue, fixedAmounts: discountType === "fixed" ? normalizedFixedAmounts : {}, applicableCourses, startsAt, expiresAt, usageLimit, isActive: body.isActive !== false };
};

const changedUsedFields = (promo, fields) => (
  promo.code !== fields.code
  || promo.discountType !== fields.discountType
  || Number(promo.discountValue) !== fields.discountValue
  || JSON.stringify(promo.fixedAmounts?.toObject?.() || promo.fixedAmounts || {}) !== JSON.stringify(fields.fixedAmounts || {})
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
    if (await PromoRedemption.exists({ promoCode: promo._id, userId: req.user.id, active: { $ne: false } })) return res.status(400).json({ message: availabilityMessages["already-used"] });
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
    const fields = validateFields(req.body);
    const saved = await paymentTransaction(async (session) => {
      // This write conflicts with the first reservation, even for no-op edits.
      const promo = await PromoCode.findOneAndUpdate({ _id: req.params.id },
        { $inc: { mutationVersion: 1 } }, { session, returnDocument: "after" });
      if (!promo) throw paymentError(404, "Promo code not found");
      if (promo.archivedAt) throw paymentError(400, "Archived promo codes cannot be changed.");
      const hasHistory = await hasPromoHistory(promo, session);
      if (hasHistory && changedUsedFields(promo, fields)) {
        throw paymentError(400, "A promo code with payment history can only be activated or deactivated; its offer details are preserved.");
      }
      Object.assign(promo, hasHistory ? { isActive: fields.isActive } : fields);
      await promo.save({ session });
      await promo.populate("applicableCourses", "title");
      return { ...promo.toObject(), hasHistory };
    });
    await writeAuditLog({ actorId: req.user.id, action: "promo.updated", targetType: "promo", targetId: saved._id, metadata: { code: saved.code, isActive: saved.isActive } });
    return res.json(saved);
  } catch (error) { return res.status(error.status || 400).json({ message: error.status ? error.message : "Unable to update promo code." }); }
};

exports.deletePromo = async (req, res) => {
  try {
    await verifyAdminPassword(req.user?.id, req.body?.adminPassword, "delete");
    const result = await paymentTransaction(async (session) => {
      const promo = await PromoCode.findOneAndUpdate({ _id: req.params.id },
        { $inc: { mutationVersion: 1 } }, { session, returnDocument: "after" });
      if (!promo) throw paymentError(404, "Promo code not found");
      const hasHistory = await hasPromoHistory(promo, session);
      if (hasHistory) {
        promo.isActive = false;
        promo.archivedAt = promo.archivedAt || new Date();
        await promo.save({ session });
      } else {
        await PromoCode.deleteOne({ _id: promo._id }, { session });
      }
      return { archived: hasHistory, promo: { ...promo.toObject(), hasHistory } };
    });
    await writeAuditLog({ actorId: req.user.id, action: result.archived ? "promo.archived" : "promo.deleted", targetType: "promo", targetId: result.promo._id, metadata: { code: result.promo.code } });
    return res.json(result.archived
      ? { ...result, message: "Promo code has payment history and was archived instead." }
      : { message: "Promo code deleted" });
  } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to delete promo code." }); }
};
