import { useEffect, useState } from 'react'
import PaymentCard from '../../components/PaymentCard'
import { X } from 'lucide-react'
import { approvePayment, fetchAllPayments, rejectPayment } from '../../services/paymentService'

function ReviewPayment() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('review')
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState(null)
  const [adminPassword, setAdminPassword] = useState('')
  const [approvalError, setApprovalError] = useState('')
  const [approving, setApproving] = useState(false)
  const [denyReasonModalOpen, setDenyReasonModalOpen] = useState(false)
  const [denyReason, setDenyReason] = useState('')
  const [selectedDenyPaymentId, setSelectedDenyPaymentId] = useState(null)
  const [denyAdminPassword, setDenyAdminPassword] = useState('')
  const [denyError, setDenyError] = useState('')
  const [denying, setDenying] = useState(false)

  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true)
        setError('')
        setPayments(await fetchAllPayments())
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadPayments()
  }, [])

  const mapTabToStatus = (tab) => {
    if (tab === 'review') return 'pending'
    if (tab === 'denied') return 'rejected'
    return 'approved'
  }

  const handleApproveClick = (paymentId) => {
    setSelectedPaymentId(paymentId)
    setAdminPassword('')
    setApprovalError('')
    setConfirmModalOpen(true)
  }

  const handleDenyClick = (paymentId) => {
    setSelectedDenyPaymentId(paymentId)
    setDenyReason('')
    setDenyAdminPassword('')
    setDenyError('')
    setDenyReasonModalOpen(true)
  }

  const handleConfirmDeny = async () => {
    if (!denyReason.trim()) {
      setDenyError('Please enter a reason for denying this payment.')
      return
    }

    if (!denyAdminPassword.trim()) {
      setDenyError('Please enter your admin password to deny this payment.')
      return
    }

    try {
      setDenying(true)
      setDenyError('')
      await rejectPayment(selectedDenyPaymentId, denyReason, denyAdminPassword)
      setPayments((currentPayments) =>
        currentPayments.map((payment) =>
          payment.id === selectedDenyPaymentId
            ? { ...payment, status: 'rejected', denialReason: denyReason }
            : payment
        )
      )
      window.dispatchEvent(new Event('admin-badges-refresh'))
      setDenyReasonModalOpen(false)
      setSelectedDenyPaymentId(null)
      setDenyReason('')
      setDenyAdminPassword('')
    } catch (rejectError) {
      setDenyError(
        rejectError?.status === 403
          ? 'Incorrect admin password. Please try again.'
          : rejectError?.message || 'Unable to deny this payment. Please try again.'
      )
    } finally {
      setDenying(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!adminPassword.trim()) {
      setApprovalError('Please enter your admin password to approve this payment.')
      return
    }

    try {
      setApproving(true)
      setApprovalError('')
      await approvePayment(selectedPaymentId, adminPassword)
      setPayments((currentPayments) =>
        currentPayments.map((payment) =>
          payment.id === selectedPaymentId
            ? { ...payment, status: 'approved' }
            : payment
        )
      )
      window.dispatchEvent(new Event('admin-badges-refresh'))
      setConfirmModalOpen(false)
      setSelectedPaymentId(null)
      setAdminPassword('')
    } catch (approveError) {
      setApprovalError(
        approveError?.status === 403
          ? 'Incorrect admin password. Please try again.'
          : approveError?.message || 'Unable to approve this payment. Please try again.'
      )
    } finally {
      setApproving(false)
    }
  }

  const getFilteredPayments = () => {
    return payments.filter((payment) => payment.status === mapTabToStatus(activeTab))
  }

  const getTabCount = (tab) => {
    return payments.filter((payment) => payment.status === mapTabToStatus(tab)).length
  }

  return (
    <div className="min-h-full bg-[#FFFDF8] p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112] sm:text-xs">Finance operations</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl md:text-4xl">Review payments</h1><p className="mt-2 text-sm text-[#765F55]">Verify transfer receipts and manage learner course access.</p>

        <div className="mt-5 inline-flex w-full rounded-xl border border-[#2D2E30]/10 bg-white p-1 shadow-sm sm:w-auto">
          <button
            onClick={() => setActiveTab('review')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition sm:flex-none ${
              activeTab === 'review'
                ? 'bg-[#FFF1CE] text-[#A86710] shadow-sm'
                : 'text-[#765F55] hover:bg-[#FFF9EA] hover:text-[#2D2E30]'
            }`}
          >
            Review <span className="text-gray-400 text-xs sm:text-sm">({getTabCount('review')})</span>
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition sm:flex-none ${
              activeTab === 'approved'
                ? 'bg-[#EDF8EE] text-[#246B35] shadow-sm'
                : 'text-[#765F55] hover:bg-[#FFF9EA] hover:text-[#2D2E30]'
            }`}
          >
            Approved <span className="text-gray-400 text-xs sm:text-sm">({getTabCount('approved')})</span>
          </button>
          <button
            onClick={() => setActiveTab('denied')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition sm:flex-none ${
              activeTab === 'denied'
                ? 'bg-[#FFF0EE] text-[#A34D45] shadow-sm'
                : 'text-[#765F55] hover:bg-[#FFF9EA] hover:text-[#2D2E30]'
            }`}
          >
            Denied <span className="text-gray-400 text-xs sm:text-sm">({getTabCount('denied')})</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[#2D2E30]/10 bg-white p-10 text-center text-[#765F55] shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)]">
          Loading payments...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {getFilteredPayments().map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                status={activeTab}
                onApprove={handleApproveClick}
                onDeny={handleDenyClick}
              />
            ))}
          </div>

          {getFilteredPayments().length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#E58C1A]/30 bg-[#FFF9EA] px-6 py-12 text-center">
              <div className="text-sm font-semibold text-[#765F55] sm:text-base">No payments to display</div>
            </div>
          )}
        </>
      )}

      {confirmModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-2xl shadow-[#2D2E30]/25">
            <div className="flex items-center justify-between border-b border-[#E58C1A]/15 bg-[#FFF9EA] p-4 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C97112]">Protected action</p>
              <h2 className="mt-1 text-base font-bold text-[#2D2E30] sm:text-lg">Approve payment</h2></div>
              <button
                type="button"
                onClick={() => { setConfirmModalOpen(false); setSelectedPaymentId(null); setAdminPassword(''); setApprovalError('') }}
                className="shrink-0 rounded-lg p-1 text-[#765F55] transition-colors hover:bg-white hover:text-[#2D2E30]"
                aria-label="Close"
                disabled={approving}
              >
                <X size={20} className="sm:h-6 sm:w-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <p className="mb-4 text-sm leading-6 text-[#765F55]">Enter your admin password to approve this payment and grant the course to the learner.</p>
              {approvalError ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{approvalError}</div> : null}
              <label className="mb-2 block text-xs font-bold text-[#2D2E30] sm:text-sm">Confirm admin password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleConfirmAction() }}
                placeholder="Enter your admin password to confirm"
                className="w-full rounded-xl border border-[#2D2E30]/15 px-3 py-3 text-sm outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10"
                autoFocus
                disabled={approving}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:flex-row sm:gap-3 sm:p-6">
              <button
                type="button"
                onClick={() => { setConfirmModalOpen(false); setSelectedPaymentId(null); setAdminPassword(''); setApprovalError('') }}
                className="flex-1 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D2E30] transition hover:bg-[#FFF4D8]"
                disabled={approving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="flex-1 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={approving}
              >
                {approving ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {denyReasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#A34D45]/15 bg-white shadow-2xl shadow-[#2D2E30]/25">
            <div className="flex items-center justify-between border-b border-[#A34D45]/15 bg-[#FFF0EE] p-4 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A34D45]">Payment review</p>
              <h2 className="mt-1 text-base font-bold text-[#2D2E30] sm:text-lg">Deny payment for {payments.find((payment) => payment.id === selectedDenyPaymentId)?.userName}</h2></div>
              <button
                onClick={() => {
                  setDenyReasonModalOpen(false)
                  setSelectedDenyPaymentId(null)
                  setDenyReason('')
                  setDenyAdminPassword('')
                  setDenyError('')
                }}
                className="shrink-0 rounded-lg p-1 text-[#765F55] transition hover:bg-white hover:text-[#2D2E30]"
                disabled={denying}
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <p className="mb-4 text-sm leading-6 text-[#765F55]">Explain what needs to be corrected. The learner will receive this message with their payment update.</p>
              {denyError ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{denyError}</div> : null}
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Write your reason here ..."
                className="w-full resize-none rounded-xl border border-[#2D2E30]/15 px-3 py-3 text-sm outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10"
                rows="4"
                disabled={denying}
              />
              <label className="mt-4 mb-2 block text-xs font-bold text-[#2D2E30] sm:text-sm">Confirm admin password</label>
              <input
                type="password"
                value={denyAdminPassword}
                onChange={(e) => setDenyAdminPassword(e.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleConfirmDeny() }}
                placeholder="Enter your admin password to confirm"
                className="w-full rounded-xl border border-[#2D2E30]/15 px-3 py-3 text-sm outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10"
                disabled={denying}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:flex-row sm:gap-3 sm:p-6">
              <button
                onClick={() => {
                  setDenyReasonModalOpen(false)
                  setSelectedDenyPaymentId(null)
                  setDenyReason('')
                  setDenyAdminPassword('')
                  setDenyError('')
                }}
                className="flex-1 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D2E30] transition hover:bg-[#FFF4D8]"
                disabled={denying}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeny}
                className="flex-1 rounded-xl bg-[#A34D45] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#8D4039] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={denying}
              >
                {denying ? 'Denying...' : 'Deny payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReviewPayment
