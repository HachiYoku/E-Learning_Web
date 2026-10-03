import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentCard from './PaymentCard'

vi.mock('../services/paymentService', () => ({
  fetchPaymentProofBlob: vi.fn(),
  formatPaymentAmount: (amount, currency) => `${currency} ${amount}`,
}))
vi.mock('./Avatar', () => ({ Avatar: () => <div aria-label="Learner avatar" /> }))

import { fetchPaymentProofBlob } from '../services/paymentService'

const payment = {
  id: 'payment-1', paymentReference: 'PAY-7KQ4M9DX', userName: 'Learner', userEmail: 'learner@example.test', userAvatar: '',
  courseName: 'Thai Foundations', paymentMethod: 'Bank transfer', paymentMethodType: 'bank_transfer', currency: 'THB',
  amount: '฿4,500', amountValue: 4500, originalAmountValue: 4500, discountAmount: 0, date: '1 Oct 2026', promoCode: '', hasPaymentProof: true,
}

beforeEach(() => vi.resetAllMocks())

describe('PaymentCard historical details', () => {
  it('keeps pending payments actionable in the existing review modal', () => {
    render(<PaymentCard payment={payment} status="review" onApprove={vi.fn()} onDeny={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Review payment' })
    expect(trigger.tagName).toBe('BUTTON')
    fireEvent.click(trigger)
    expect(screen.getByRole('heading', { name: 'Review payment' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Approve payment' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Deny payment' })).toBeTruthy()
  })

  it('opens approved Payments in read-only detail mode with their reference', () => {
    render(<PaymentCard payment={payment} status="approved" onApprove={vi.fn()} onDeny={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'View payment details' })
    expect(trigger.tagName).toBe('BUTTON')
    fireEvent.click(trigger)
    const modal = screen.getByRole('heading', { name: 'Payment details' }).closest('section')
    expect(modal).toBeTruthy()
    expect(within(modal).getByText('PAY-7KQ4M9DX')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve payment' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Deny payment' })).toBeNull()
  })

  it('opens denied Payments read-only and shows an available denial reason', async () => {
    fetchPaymentProofBlob.mockRejectedValue(new Error('Payment proof is temporarily unavailable.'))
    render(<PaymentCard payment={{ ...payment, denialReason: 'The receipt is incomplete.' }} status="denied" onApprove={vi.fn()} onDeny={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'View payment details' }))
    const modal = screen.getByRole('heading', { name: 'Payment details' }).closest('section')
    expect(modal).toBeTruthy()
    expect(within(modal).getByText('Reason from our team')).toBeTruthy()
    expect(within(modal).getByText('The receipt is incomplete.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve payment' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Deny payment' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /View secure payment receipt/ }))
    expect(await screen.findByText('Payment proof is temporarily unavailable.')).toBeTruthy()
  })

  it('omits an unavailable denial reason without rendering undefined', () => {
    render(<PaymentCard payment={{ ...payment, paymentReference: '', denialReason: '' }} status="denied" onApprove={vi.fn()} onDeny={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'View payment details' }))
    expect(screen.queryByText('Reason from our team')).toBeNull()
    expect(screen.queryByText('undefined')).toBeNull()
  })
})
