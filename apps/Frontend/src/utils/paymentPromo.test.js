import assert from 'node:assert/strict'
import test from 'node:test'
import { hasDiscountedCoursePrice, reconcilePromoForQuote } from './paymentPromo.js'

test('uses only the authoritative quote course-price discount flag', () => {
  assert.equal(hasDiscountedCoursePrice({ coursePrice: { hasDiscount: true } }), true)
  assert.equal(hasDiscountedCoursePrice({ coursePrice: { hasDiscount: false } }), false)
  assert.equal(hasDiscountedCoursePrice({ course: { hasDiscount: true } }), false)
  assert.equal(hasDiscountedCoursePrice({ originalAmount: 5000, amount: 3900 }), false)
})

test('clears an old promo when the newly quoted currency is already discounted', () => {
  assert.deepEqual(
    reconcilePromoForQuote({ coursePrice: { hasDiscount: true }, promo: { code: 'OLD' } }, 'OLD'),
    { showPromoInput: false, promoInput: '', promo: null },
  )
  assert.deepEqual(
    reconcilePromoForQuote({ coursePrice: { hasDiscount: false }, promo: { code: 'VALID' } }, 'VALID'),
    { showPromoInput: true, promoInput: 'VALID', promo: { code: 'VALID' } },
  )
})
