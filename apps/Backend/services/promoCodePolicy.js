const PromoRedemption = require("../models/promoRedemptionModel");
const Payment = require("../models/paymentModel");

const availabilityMessages = {
  inactive: "This promo code is inactive.",
  scheduled: "This promo code is not available yet.",
  expired: "This promo code has expired.",
  exhausted: "This promo code has reached its usage limit.",
  "wrong-course": "This promo code is not available for this course.",
  "already-used": "You have already used this promo code.",
  unavailable: "This promo code is not available.",
};

function getPromoAvailability(promo, courseId, now = new Date()) {
  if (!promo || promo.archivedAt) return "unavailable";
  if (!promo.isActive) return "inactive";
  if (promo.startsAt && promo.startsAt > now) return "scheduled";
  if (promo.expiresAt && promo.expiresAt < now) return "expired";
  if (promo.usageLimit && promo.usageCount >= promo.usageLimit) return "exhausted";
  if (promo.applicableCourses.length && !promo.applicableCourses.some((id) => String(id) === String(courseId))) return "wrong-course";
  return null;
}

function calculatePromoDiscount(originalAmount, promo) {
  const amount = Math.max(0, Number(originalAmount) || 0);
  const rawDiscount = promo.discountType === "percent" ? amount * Number(promo.discountValue) / 100 : Number(promo.discountValue);
  const discountAmount = Math.min(amount, Math.max(0, rawDiscount || 0));
  return { originalAmount: amount, discountAmount, finalAmount: Math.max(0, amount - discountAmount) };
}

async function hasPromoHistory(promo) {
  const [redemption, payment] = await Promise.all([
    PromoRedemption.exists({ promoCode: promo._id }),
    Payment.exists({ promoCode: promo.code }),
  ]);
  return Boolean(redemption || payment);
}

module.exports = { availabilityMessages, getPromoAvailability, calculatePromoDiscount, hasPromoHistory };
