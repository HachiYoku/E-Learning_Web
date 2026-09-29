import assert from 'node:assert/strict'
import test from 'node:test'
import { appliedPromoDetails, hasDiscountedCoursePrice, promoErrorMessage, reconcilePromoForQuote } from './paymentPromo.js'

test('uses only the authoritative quote course-price discount flag', () => {
  assert.equal(hasDiscountedCoursePrice({ coursePrice: { hasDiscount: true } }), true)
  assert.equal(hasDiscountedCoursePrice({ coursePrice: { hasDiscount: false } }), false)
  assert.equal(hasDiscountedCoursePrice({ course: { hasDiscount: true } }), false)
  assert.equal(hasDiscountedCoursePrice({ originalAmount: 5000, amount: 3900 }), false)
})

test('maps known promo quote failures to student-friendly messages', () => {
  assert.equal(promoErrorMessage(new Error('Promo code not found')), "This promo code isn't valid.")
  assert.equal(promoErrorMessage(new Error('This promo code has expired.')), 'This promo code has expired.')
  assert.equal(promoErrorMessage(new Error('This promo code is not available yet.')), "This promo code isn't available yet.")
  assert.equal(promoErrorMessage(new Error('This promo code has reached its usage limit.')), 'This promo code has reached its usage limit.')
  assert.equal(promoErrorMessage(new Error('This fixed promo code is not available for the selected payment currency.'), 'MMK'), "This promo code isn't available for MMK payments.")
  assert.equal(promoErrorMessage(new Error('This promo code is not available for this course.')), "This promo code isn't available for this course.")
  assert.equal(promoErrorMessage(new Error('You have already used this promo code.')), "You've already used this promo code.")
  assert.equal(promoErrorMessage(new Error('database secret stack')), "We couldn't apply this promo code. Please try again.")
})

test('uses the applied promo and discount returned by the quote, and clears it after removal', () => {
  const appliedQuote = { currency: 'MMK', discountAmount: 10000, promo: { code: 'NEWYEAR' }, coursePrice: { hasDiscount: false } }
  assert.deepEqual(appliedPromoDetails(appliedQuote), { code: 'NEWYEAR', discountAmount: 10000, currency: 'MMK' })
  assert.deepEqual(
    reconcilePromoForQuote({ currency: 'MMK', discountAmount: 0, promo: null, coursePrice: { hasDiscount: false } }, ''),
    { showPromoInput: true, promoInput: '', promo: null },
  )
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
