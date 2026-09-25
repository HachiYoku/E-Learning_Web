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
