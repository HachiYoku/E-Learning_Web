import { describe, expect, it } from 'vitest'
import { resolveReviewPaymentDeepLink } from './reviewPaymentDeepLink'

const payments = [
  { id: 'pending-payment', status: 'pending' },
  { id: 'approved-payment', status: 'approved' },
  { id: 'rejected-payment', status: 'rejected' },
]

describe('Review Payment deep-link resolution', () => {
  it.each([
    ['pending-payment', 'review'],
    ['approved-payment', 'approved'],
    ['rejected-payment', 'denied'],
  ])('locates a %s payment in the correct existing tab', (paymentId, tab) => {
    const result = resolveReviewPaymentDeepLink(payments, paymentId)
    expect(result.payment.id).toBe(paymentId)
    expect(result.tab).toBe(tab)
    expect(result.message).toBe('')
  })

  it('fails safely for an unavailable payment', () => {
    expect(resolveReviewPaymentDeepLink(payments, 'unknown')).toEqual({
      payment: null,
      tab: null,
      message: 'The requested payment is unavailable.',
    })
  })
})
