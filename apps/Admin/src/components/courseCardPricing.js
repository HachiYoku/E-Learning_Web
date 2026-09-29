const CURRENCIES = ["THB", "MMK"];

export function formatCourseCardCurrency(amount, currency) {
  const formatted = Number(amount).toLocaleString();
  return currency === "MMK" ? `Ks ${formatted}` : `฿${formatted}`;
}

function validAmount(amount) {
  return amount !== null && amount !== undefined && Number.isFinite(Number(amount));
}

export function getCourseCardPrices(course) {
  return CURRENCIES.map((currency) => {
    const configuredPrice = course.prices?.[currency];

    if (validAmount(configuredPrice?.price)) {
      const price = Number(configuredPrice.price);
      const originalPrice = validAmount(configuredPrice.originalPrice)
        ? Number(configuredPrice.originalPrice)
        : price;

      return {
        currency,
        configured: true,
        price,
        originalPrice,
        hasDiscount: originalPrice > price,
      };
    }

    if (currency === "THB" && validAmount(course.legacyPriceValue)) {
      const price = Number(course.legacyPriceValue);
      const originalPrice = validAmount(course.legacyOriginalPriceValue)
        ? Number(course.legacyOriginalPriceValue)
        : price;

      return {
        currency,
        configured: true,
        price,
        originalPrice,
        hasDiscount: originalPrice > price,
        isLegacy: true,
      };
    }

    return { currency, configured: false };
  });
}
