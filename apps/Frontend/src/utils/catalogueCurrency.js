export const CATALOGUE_CURRENCY_STORAGE_KEY = "arunthai.catalogueCurrency"
export const CATALOGUE_CURRENCIES = ["THB", "MMK"]

export function normalizeCatalogueCurrency(currency) {
  return CATALOGUE_CURRENCIES.includes(currency) ? currency : "THB"
}

export function loadCatalogueCurrency(storage = globalThis?.localStorage) {
  try {
    return normalizeCatalogueCurrency(storage?.getItem(CATALOGUE_CURRENCY_STORAGE_KEY))
  } catch {
    return "THB"
  }
}

export function saveCatalogueCurrency(currency, storage = globalThis?.localStorage) {
  const selected = normalizeCatalogueCurrency(currency)
  try {
    storage?.setItem(CATALOGUE_CURRENCY_STORAGE_KEY, selected)
  } catch {
    // A blocked browser storage preference must never affect course data.
  }
  return selected
}

export function formatCatalogueAmount(amount, currency) {
  return currency === "MMK" ? `Ks ${Number(amount).toLocaleString()}` : `฿${Number(amount).toLocaleString()}`
}

// This is deliberately display-only. It never converts or falls back across
// currencies; checkout continues to obtain its amount from a payment-method quote.
export function getCataloguePrice(course, requestedCurrency) {
  const currency = normalizeCatalogueCurrency(requestedCurrency)
  const configured = course?.prices?.[currency]
  const legacyThb = currency === "THB" && course?.legacyPriceValue != null
  const priceValue = configured?.price ?? (legacyThb ? course.legacyPriceValue : null)
  const originalPriceValue = configured?.originalPrice ?? (legacyThb ? course.legacyOriginalPriceValue : null)

  if (priceValue == null || !Number.isFinite(Number(priceValue))) return { currency, available: false }
  const price = Number(priceValue)
  const originalPrice = originalPriceValue != null && Number.isFinite(Number(originalPriceValue)) ? Number(originalPriceValue) : price
  return {
    currency,
    available: true,
    priceValue: price,
    originalPriceValue: originalPrice,
    price: formatCatalogueAmount(price, currency),
    originalPrice: formatCatalogueAmount(originalPrice, currency),
    hasDiscount: originalPrice > price,
  }
}
