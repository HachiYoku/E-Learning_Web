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
  assert.equal(normalized.amount, '3,900 ฿')
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
  assert.equal(normalized.currency, null)
  assert.equal(normalized.amount, '3,900 ฿')
  assert.equal(normalized.paymentMethod, 'Uploaded transfer slip')
})
