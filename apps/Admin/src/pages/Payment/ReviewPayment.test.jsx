import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReviewPayment from './ReviewPayment'

vi.mock('../../services/paymentService', () => ({
  approvePayment: vi.fn(),
  fetchAllPayments: vi.fn(),
  rejectPayment: vi.fn(),
}))
vi.mock('../../components/PaymentCard', () => ({
  default: ({ payment, status }) => <div data-testid="payment-card">{payment.paymentReference} · {status}</div>,
}))
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

import { fetchAllPayments } from '../../services/paymentService'

beforeEach(() => vi.resetAllMocks())

describe('ReviewPayment Payment Reference search', () => {
  it('normalizes an exact reference and switches to the result status tab', async () => {
    fetchAllPayments.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'approved-1', status: 'approved', paymentReference: 'PAY-7KQ4M9DX' }])
    render(<ReviewPayment />)
    await screen.findByText('No payments to display')

    fireEvent.change(screen.getByLabelText('Payment Reference'), { target: { value: '  pay-7kq4m9dx  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find payment' }))

    expect((await screen.findByTestId('payment-card')).textContent).toBe('PAY-7KQ4M9DX · approved')
    expect(fetchAllPayments).toHaveBeenLastCalledWith('PAY-7KQ4M9DX')
  })

  it('shows a clear no-result state and clears back to normal tab behavior', async () => {
    fetchAllPayments.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
    render(<ReviewPayment />)
    await screen.findByText('No payments to display')

    fireEvent.change(screen.getByLabelText('Payment Reference'), { target: { value: 'PAY-7KQ4M9DX' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find payment' }))
    expect(await screen.findByText('No payment matches that complete Payment Reference.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(fetchAllPayments).toHaveBeenLastCalledWith('')
  })
})
