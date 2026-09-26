import assert from "node:assert/strict";
import test from "node:test";
import { formatCourseCardCurrency, getCourseCardPrices } from "./courseCardPricing.js";

test("shows a configured THB price without inventing an MMK price", () => {
  const [thb, mmk] = getCourseCardPrices({
    prices: { THB: { price: 2500, originalPrice: 2500 } },
  });

  assert.deepEqual(thb, {
    currency: "THB", configured: true, price: 2500, originalPrice: 2500, hasDiscount: false,
  });
  assert.deepEqual(mmk, { currency: "MMK", configured: false });
});

test("supports an MMK-only course", () => {
  const [thb, mmk] = getCourseCardPrices({
    prices: { MMK: { price: 180000, originalPrice: 180000 } },
  });

  assert.deepEqual(thb, { currency: "THB", configured: false });
  assert.equal(mmk.price, 180000);
  assert.equal(mmk.hasDiscount, false);
});

test("shows both configured currencies without treating either as a fallback", () => {
  const [thb, mmk] = getCourseCardPrices({
    prices: {
      THB: { price: 2500 },
      MMK: { price: 180000 },
    },
  });

  assert.deepEqual([thb.configured, mmk.configured], [true, true]);
  assert.deepEqual([thb.hasDiscount, mmk.hasDiscount], [false, false]);
});

test("keeps THB and MMK discounts independent", () => {
  const [thb, mmk] = getCourseCardPrices({
    prices: {
      THB: { price: 2500, originalPrice: 3000 },
      MMK: { price: 180000, originalPrice: 220000 },
    },
  });

  assert.deepEqual([thb.hasDiscount, mmk.hasDiscount], [true, true]);
  assert.equal(formatCourseCardCurrency(thb.originalPrice, thb.currency), "฿3,000");
  assert.equal(formatCourseCardCurrency(thb.price, thb.currency), "฿2,500");
  assert.equal(formatCourseCardCurrency(mmk.originalPrice, mmk.currency), "Ks 220,000");
  assert.equal(formatCourseCardCurrency(mmk.price, mmk.currency), "Ks 180,000");
});

test("uses the legacy price only as a THB compatibility fallback", () => {
  const [thb, mmk] = getCourseCardPrices({
    legacyPriceValue: 3900,
    legacyOriginalPriceValue: 4500,
    prices: {},
  });

  assert.equal(thb.isLegacy, true);
  assert.equal(thb.hasDiscount, true);
  assert.deepEqual(mmk, { currency: "MMK", configured: false });
});

test("does not render zero for a course without configured or legacy prices", () => {
  assert.deepEqual(getCourseCardPrices({ prices: {} }), [
    { currency: "THB", configured: false },
    { currency: "MMK", configured: false },
  ]);
});
