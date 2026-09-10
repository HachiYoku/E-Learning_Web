const PromoCode = require("../models/promoCodeModel");
const Course = require("../models/courseModel");
const PromoRedemption = require("../models/promoRedemptionModel");

const cleanCode = (code) => String(code || "").trim().toUpperCase();
const validateFields = (body) => {
  const code = cleanCode(body.code), discountType = body.discountType, discountValue = Number(body.discountValue);
  if (!/^[A-Z0-9-]{3,40}$/.test(code)) throw new Error("Use 3-40 letters, numbers, or hyphens for the code.");
  if (!['percent', 'fixed'].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100)) throw new Error("Enter a valid discount.");
  const startsAt = body.startsAt ? new Date(body.startsAt) : null, expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const usageLimit = body.usageLimit ? Number(body.usageLimit) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (expiresAt && Number.isNaN(expiresAt.getTime())) || (startsAt && expiresAt && expiresAt < startsAt)) throw new Error("Enter valid dates, with expiry after the start date.");
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) throw new Error("Usage limit must be a whole number of at least 1.");
  return { code, discountType, discountValue, applicableCourses: Array.isArray(body.applicableCourses) ? body.applicableCourses : [], startsAt, expiresAt, usageLimit, isActive: body.isActive !== false };
};
exports.validatePromo = async (req, res) => { try { const course = await Course.findById(req.body.courseId).select('price'); const promo = await PromoCode.findOne({ code: cleanCode(req.body.code) }); const now = new Date(); const alreadyUsed = promo ? await PromoRedemption.exists({ promoCode: promo._id, userId: req.user.id }) : false; if (!course || !promo || alreadyUsed || !promo.isActive || (promo.startsAt && promo.startsAt > now) || (promo.expiresAt && promo.expiresAt < now) || (promo.usageLimit && promo.usageCount >= promo.usageLimit) || (promo.applicableCourses.length && !promo.applicableCourses.some((id) => String(id) === String(course._id)))) return res.status(400).json({ message: "This promo code is not available for this course." }); const originalAmount = Number(course.price || 0); const discountAmount = Math.min(originalAmount, promo.discountType === 'percent' ? originalAmount * promo.discountValue / 100 : promo.discountValue); return res.json({ code: promo.code, originalAmount, discountAmount, finalAmount: originalAmount - discountAmount }); } catch (error) { return res.status(500).json({ message: error.message }); } };
exports.listPromos = async (_req, res) => { try { res.json(await PromoCode.find().populate('applicableCourses', 'title').sort({ createdAt: -1 })); } catch (error) { res.status(500).json({ message: error.message }); } };
exports.createPromo = async (req, res) => { try { res.status(201).json(await PromoCode.create(validateFields(req.body))); } catch (error) { res.status(400).json({ message: error.code === 11000 ? 'This promo code already exists.' : error.message }); } };
exports.updatePromo = async (req, res) => { try { const promo = await PromoCode.findByIdAndUpdate(req.params.id, validateFields(req.body), { new: true, runValidators: true }); if (!promo) return res.status(404).json({ message: 'Promo code not found' }); res.json(promo); } catch (error) { res.status(400).json({ message: error.message }); } };
exports.deletePromo = async (req, res) => { try { const promo = await PromoCode.findByIdAndDelete(req.params.id); if (!promo) return res.status(404).json({ message: 'Promo code not found' }); res.json({ message: 'Promo code deleted' }); } catch (error) { res.status(500).json({ message: error.message }); } };
