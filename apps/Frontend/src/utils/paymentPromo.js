// This deliberately reads only the checkout quote returned by the server.
// Course catalogue prices cannot determine whether a selected currency is
// already discounted.
export const hasDiscountedCoursePrice = (quote) => quote?.coursePrice?.hasDiscount === true;

export function reconcilePromoForQuote(quote, previousPromoInput) {
  if (hasDiscountedCoursePrice(quote)) {
    return { showPromoInput: false, promoInput: "", promo: null };
  }
  return { showPromoInput: true, promoInput: previousPromoInput, promo: quote?.promo || null };
}

export function appliedPromoDetails(quote) {
  if (!quote?.promo || hasDiscountedCoursePrice(quote) || Number(quote.discountAmount) <= 0) return null;
  return { code: quote.promo.code, discountAmount: Number(quote.discountAmount), currency: quote.currency };
}

// The quote endpoint remains authoritative. This only turns its known public
// failures into language that is useful to a student and never renders a raw
// server error in the checkout.
export function promoErrorMessage(error, currency = "THB") {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("expired")) return "This promo code has expired.";
  if (message.includes("not available yet") || message.includes("scheduled")) return "This promo code isn't available yet.";
  if (message.includes("usage limit") || message.includes("exhausted")) return "This promo code has reached its usage limit.";
  if (message.includes("selected payment currency") || message.includes("unsupported-currency") || message.includes("wrong currency")) return `This promo code isn't available for ${currency} payments.`;
  if (message.includes("this course") || message.includes("wrong-course")) return "This promo code isn't available for this course.";
  if (message.includes("already used") || message.includes("already redeemed")) return "You've already used this promo code.";
  if (message.includes("not found") || message.includes("invalid")) return "This promo code isn't valid.";
  if (message.includes("inactive") || message.includes("not available.")) return "This promo code isn't valid.";

  return "We couldn't apply this promo code. Please try again.";
}
