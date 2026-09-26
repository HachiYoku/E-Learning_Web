import assert from 'node:assert/strict'
import test from 'node:test'
import { formatSavedPaymentAmount } from './paymentDisplay.js'

test('formats saved payment amounts with the saved currency', () => {
  assert.equal(formatSavedPaymentAmount(3900, 'THB'), '฿3,900')
  assert.equal(formatSavedPaymentAmount(120000, 'MMK'), 'Ks 120,000')
})
