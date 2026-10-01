export function reviewPaymentTab(status) {
  if (status === 'pending') return 'review'
  if (status === 'rejected') return 'denied'
  return 'approved'
}

export function resolveReviewPaymentDeepLink(payments, paymentId) {
  if (!paymentId) return { payment: null, tab: null, message: '' }

  const payment = payments.find((item) => item.id === paymentId)
  if (!payment) {
    return { payment: null, tab: null, message: 'The requested payment is unavailable.' }
  }

  return { payment, tab: reviewPaymentTab(payment.status), message: '' }
}
