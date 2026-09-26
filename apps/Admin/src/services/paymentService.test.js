import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPaymentAmount, normalizePayment } from './paymentDisplay.js'

const payment = (overrides = {}) => ({
  _id: 'payment-1', amount: 3900, originalAmount: 4000,
  courseId: { title: 'Course', price: 9999 },
  paymentMethodSnapshot: { name: 'Saved KBZPay wallet', type: 'wallet', currency: 'MMK' },
  ...overrides,
})

test('payment normalization preserves saved THB currency and symbol', () => {
  const normalized = normalizePayment(payment({ currency: 'THB' }))
  assert.equal(normalized.currency, 'THB')
  assert.equal(normalized.amount, '฿3,900')
})

test('payment normalization preserves saved MMK currency and never labels it as THB', () => {
  const normalized = normalizePayment(payment({ currency: 'MMK', amount: 120000, originalAmount: 125000 }))
  assert.equal(normalized.currency, 'MMK')
  assert.equal(normalized.amount, 'Ks 120,000')
  assert.equal(formatPaymentAmount(normalized.originalAmountValue, normalized.currency), 'Ks 125,000')
  assert.doesNotMatch(normalized.amount, /฿|บาท/)
})

test('historical review prefers the saved payment-method snapshot', () => {
  const normalized = normalizePayment(payment({
    currency: 'MMK',
    paymentMethodSnapshot: { name: 'Saved Wave Money', type: 'wallet', currency: 'MMK' },
    paymentMethodId: { name: 'Later edited method' },
  }))
  assert.equal(normalized.paymentMethod, 'Saved Wave Money')
  assert.equal(normalized.paymentMethodType, 'wallet')
})

test('legacy payments without a saved currency retain THB-compatible formatting', () => {
  const normalized = normalizePayment(payment({ currency: undefined, paymentMethodSnapshot: undefined }))
  assert.equal(normalized.currency, 'THB')
  assert.equal(normalized.amount, '฿3,900')
  assert.equal(normalized.paymentMethod, 'Uploaded transfer slip')
})

test('historical review prefers saved course and financial snapshots', () => {
  const normalized = normalizePayment(payment({
    currency: 'MMK',
    amount: 120000,
    originalAmount: 130000,
    discountAmount: 10000,
    promoCode: 'SAVE10',
    courseSnapshot: { title: 'Thai Writing at purchase', price: 130000, originalPrice: 130000 },
    courseId: { title: 'Renamed course', price: 999 },
  }))
  assert.equal(normalized.courseName, 'Thai Writing at purchase')
  assert.equal(normalized.originalAmountValue, 130000)
  assert.equal(normalized.discountAmount, 10000)
  assert.equal(normalized.promoCode, 'SAVE10')
})
