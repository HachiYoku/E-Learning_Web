import assert from "node:assert/strict"
import test from "node:test"
import { CATALOGUE_CURRENCY_STORAGE_KEY, formatCatalogueAmount, getCataloguePrice, loadCatalogueCurrency, saveCatalogueCurrency } from "./catalogueCurrency.js"

const course = {
  legacyPriceValue: 3900,
  legacyOriginalPriceValue: 4500,
  prices: {
    THB: { price: 3900, originalPrice: 4500 },
    MMK: { price: 120000, originalPrice: 130000 },
  },
}

test("catalogue shows an explicit THB price and discount", () => {
  assert.deepEqual(getCataloguePrice(course, "THB"), { currency: "THB", available: true, priceValue: 3900, originalPriceValue: 4500, price: "฿3,900", originalPrice: "฿4,500", hasDiscount: true })
})

test("catalogue shows an explicit MMK price and discount", () => {
  const price = getCataloguePrice(course, "MMK")
  assert.equal(price.price, "Ks 120,000")
  assert.equal(price.originalPrice, "Ks 130,000")
  assert.equal(price.hasDiscount, true)
})

test("catalogue does not fall back across currencies when a price is unavailable", () => {
  assert.deepEqual(getCataloguePrice({ ...course, prices: { THB: course.prices.THB } }, "MMK"), { currency: "MMK", available: false })
})

test("legacy courses remain THB-compatible but never invent MMK", () => {
  const legacy = { legacyPriceValue: 3900, legacyOriginalPriceValue: 3900, prices: {} }
  assert.equal(getCataloguePrice(legacy, "THB").price, "฿3,900")
  assert.equal(getCataloguePrice(legacy, "MMK").available, false)
})

test("catalogue currency preference persists across navigation", () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  assert.equal(saveCatalogueCurrency("MMK", storage), "MMK")
  assert.equal(values.get(CATALOGUE_CURRENCY_STORAGE_KEY), "MMK")
  assert.equal(loadCatalogueCurrency(storage), "MMK")
})

test("catalogue formatting is display-only and contains no conversion", () => {
  assert.equal(formatCatalogueAmount(3900, "THB"), "฿3,900")
  assert.equal(formatCatalogueAmount(120000, "MMK"), "Ks 120,000")
})
