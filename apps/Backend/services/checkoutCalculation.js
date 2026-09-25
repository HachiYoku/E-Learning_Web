const mongoose = require("mongoose");
const Course = require("../models/courseModel");
const PaymentMethod = require("../models/paymentMethodModel");
const PromoCode = require("../models/promoCodeModel");
const PromoRedemption = require("../models/promoRedemptionModel");
const { paymentError } = require("./paymentTransaction");
const { availabilityMessages, getPromoAvailability, getPromoCurrencyAvailability, calculatePromoDiscount, roundCurrency } = require("./promoCodePolicy");

const cleanCode = (code) => String(code || "").trim().toUpperCase();
const validId = (value) => mongoose.isObjectIdOrHexString(value);

function checkoutMethod(method) {
  return {
    id: String(method._id), name: method.name, currency: method.currency,
    type: method.type, provider: method.provider, instructions: method.instructions || "",
    recipient: method.recipient?.toObject?.() || method.recipient || {},
    qrImage: method.qrImage?.toObject?.() || method.qrImage || {},
    mutationVersion: Number(method.mutationVersion || 0),
  };
}

function selectedCoursePrice(course, currency) {
  const price = course.prices?.[currency];
  if (!price) throw paymentError(400, "This course is unavailable for the selected payment currency.");
  const sellingPrice = roundCurrency(price.price, currency);
  const originalPrice = roundCurrency(price.originalPrice, currency);
  if (!Number.isFinite(sellingPrice) || !Number.isFinite(originalPrice) || sellingPrice < 0 || originalPrice < sellingPrice) {
    throw paymentError(409, "This course has an invalid price for the selected payment currency.");
  }
  return { price: sellingPrice, originalPrice, hasDiscount: originalPrice > sellingPrice };
}

async function calculateCheckout({ userId, courseId, paymentMethodId, promoCode, session = null }) {
  if (!validId(userId) || !validId(courseId) || !validId(paymentMethodId)) throw paymentError(400, "A valid course and payment method are required.");
  // mutationVersion represents configuration only. Quotes and future student
  // submissions must never increment it. A future submission transaction will
  // reread current state under its transaction snapshot, then persist those
  // exact method/course snapshots with the payment. If an admin edit races the
  // transaction, MongoDB serializes the two operations in one order; a quote
  // remains informational and never promises that old configuration.
  const [course, method] = await Promise.all([
    Course.findById(courseId).session(session),
    PaymentMethod.findOne({ _id: paymentMethodId, isActive: true }).session(session),
  ]);
  if (!course) throw paymentError(404, "Course not found");
  if (!method) throw paymentError(400, "The selected payment method is unavailable.");
  const currency = method.currency;
  const coursePrice = selectedCoursePrice(course, currency);
  let promo = null;
  let discountAmount = 0;
  const code = cleanCode(promoCode);
  if (code) {
    if (coursePrice.hasDiscount) throw paymentError(400, "This course is already discounted, so a promo code cannot be applied.");
    promo = await PromoCode.findOne({ code }).session(session);
    const availability = getPromoAvailability(promo, course._id);
    if (availability) throw paymentError(400, availabilityMessages[availability]);
    const currencyAvailability = getPromoCurrencyAvailability(promo, currency);
    if (currencyAvailability) throw paymentError(400, availabilityMessages[currencyAvailability]);
    if (await PromoRedemption.exists({ promoCode: promo._id, userId, active: true }).session(session)) {
      throw paymentError(400, availabilityMessages["already-used"]);
    }
    discountAmount = calculatePromoDiscount(coursePrice.price, promo, currency).discountAmount;
  }
  const amount = roundCurrency(coursePrice.price - discountAmount, currency);
  return {
    currency,
    originalAmount: coursePrice.price,
    discountAmount,
    amount,
    paymentMethod: checkoutMethod(method),
    coursePrice: { ...coursePrice, mutationVersion: Number(course.mutationVersion || 0) },
    promo: promo ? {
      code: promo.code, discountType: promo.discountType,
      ...(promo.discountType === "percent" ? { discountValue: Number(promo.discountValue) } : { fixedAmount: Number(promo.fixedAmounts[currency]) }),
    } : null,
  };
}

async function listAvailablePaymentMethods({ courseId, isAdmin = false }) {
  if (!validId(courseId)) throw paymentError(400, "A valid course is required.");
  const course = await Course.findById(courseId).select("isPublished prices mutationVersion");
  if (!course) throw paymentError(404, "Course not found");
  if (!isAdmin && !course.isPublished) throw paymentError(403, "You cannot access this course");
  const methods = await PaymentMethod.find({ isActive: true, currency: { $in: Object.keys(course.prices || {}) } }).sort({ currency: 1, name: 1 });
  return methods.filter((method) => {
    try { selectedCoursePrice(course, method.currency); return true; } catch (_error) { return false; }
  }).map(checkoutMethod);
}

module.exports = { calculateCheckout, listAvailablePaymentMethods, selectedCoursePrice, checkoutMethod };
