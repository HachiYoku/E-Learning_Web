const PromoRedemption = require("../models/promoRedemptionModel");
const Payment = require("../models/paymentModel");

const availabilityMessages = {
  inactive: "This promo code is inactive.",
  scheduled: "This promo code is not available yet.",
  expired: "This promo code has expired.",
  exhausted: "This promo code has reached its usage limit.",
  "wrong-course": "This promo code is not available for this course.",
  "already-used": "You have already used this promo code.",
  "unsupported-currency": "This fixed promo code is not available for the selected payment currency.",
  unavailable: "This promo code is not available.",
};

const currencyFractionDigits = Object.freeze({ THB: 2, MMK: 0 });

function roundCurrency(amount, currency) {
  const digits = currencyFractionDigits[currency];
  if (digits === undefined) throw new Error("Unsupported currency.");
  const factor = 10 ** digits;
  return Math.round((Number(amount) + Number.EPSILON) * factor) / factor;
}

function getPromoAvailability(promo, courseId, now = new Date()) {
  if (!promo || promo.archivedAt) return "unavailable";
  if (!promo.isActive) return "inactive";
  if (promo.startsAt && promo.startsAt > now) return "scheduled";
  if (promo.expiresAt && promo.expiresAt < now) return "expired";
  if (promo.usageLimit && promo.usageCount >= promo.usageLimit) return "exhausted";
  if (promo.applicableCourses.length && !promo.applicableCourses.some((id) => String(id) === String(courseId))) return "wrong-course";
  return null;
}

function getPromoCurrencyAvailability(promo, currency) {
  if (promo?.discountType === "fixed" && (!promo.fixedAmounts || promo.fixedAmounts[currency] === undefined || promo.fixedAmounts[currency] === null)) {
    return "unsupported-currency";
  }
  return null;
}

function calculatePromoDiscount(originalAmount, promo, currency = null) {
  const amount = currency ? roundCurrency(Math.max(0, Number(originalAmount) || 0), currency) : Math.max(0, Number(originalAmount) || 0);
  const fixedAmount = currency ? promo.fixedAmounts?.[currency] : promo.discountValue;
  const rawDiscount = promo.discountType === "percent" ? amount * Number(promo.discountValue) / 100 : Number(fixedAmount);
  const roundedDiscount = currency ? roundCurrency(rawDiscount, currency) : rawDiscount;
  const discountAmount = Math.min(amount, Math.max(0, roundedDiscount || 0));
  const finalAmount = Math.max(0, currency ? roundCurrency(amount - discountAmount, currency) : amount - discountAmount);
  return { originalAmount: amount, discountAmount, finalAmount };
}

async function hasPromoHistory(promo, session = null) {
  // Transaction operations must be sequential on a single session.
  const redemption = await PromoRedemption.exists({ promoCode: promo._id }).session(session);
  const payment = await Payment.exists({ promoCode: promo.code }).session(session);
  return Boolean(redemption || payment);
}

module.exports = { availabilityMessages, currencyFractionDigits, roundCurrency, getPromoAvailability, getPromoCurrencyAvailability, calculatePromoDiscount, hasPromoHistory };
