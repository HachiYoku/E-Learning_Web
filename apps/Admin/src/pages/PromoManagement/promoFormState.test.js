import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPromoPayload, explicitFixedAmounts } from './promoFormState.js'

const base = { code: 'SAVE', discountType: 'fixed', discountValue: '', fixedAmounts: { THB: '', MMK: '' } }

test('builds percentage promos without per-currency amounts', () => {
  const payload = buildPromoPayload({ ...base, discountType: 'percent', discountValue: '10', fixedAmounts: { THB: '300', MMK: '10000' } })
  assert.equal(payload.discountValue, 10)
  assert.deepEqual(payload.fixedAmounts, {})
})

test('builds explicit THB, MMK, and dual-currency fixed promo payloads', () => {
  assert.deepEqual(buildPromoPayload({ ...base, fixedAmounts: { THB: '300', MMK: '' } }).fixedAmounts, { THB: 300 })
  assert.deepEqual(buildPromoPayload({ ...base, fixedAmounts: { THB: '', MMK: '10000' } }).fixedAmounts, { MMK: 10000 })
  assert.deepEqual(buildPromoPayload({ ...base, fixedAmounts: { THB: '300', MMK: '10000' } }).fixedAmounts, { THB: 300, MMK: 10000 })
  assert.deepEqual(explicitFixedAmounts({ THB: '', MMK: '' }), {})
})

test('retains a legacy fixed promo compatibility value when no explicit amount exists', () => {
  const payload = buildPromoPayload({ ...base, discountValue: '500' })
  assert.equal(payload.discountValue, 500)
  assert.equal(payload.fixedAmounts, undefined)
})
