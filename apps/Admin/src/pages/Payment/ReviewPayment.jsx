import { useEffect, useState } from 'react'
import PaymentCard from '../../components/PaymentCard'
import ConfirmationModal from '../../components/ConfirmationModal'
import { X } from 'lucide-react'
import { approvePayment, fetchAllPayments, rejectPayment } from '../../services/paymentService'

function ReviewPayment() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('review')
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState(null)
  const [denyReasonModalOpen, setDenyReasonModalOpen] = useState(false)
  const [denyReason, setDenyReason] = useState('')
  const [selectedDenyPaymentId, setSelectedDenyPaymentId] = useState(null)

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
    setConfirmModalOpen(true)
  }

  const handleDenyClick = (paymentId) => {
    setSelectedDenyPaymentId(paymentId)
    setDenyReason('')
    setDenyReasonModalOpen(true)
  }

  const handleConfirmDeny = async () => {
    try {
      await rejectPayment(selectedDenyPaymentId, denyReason)
      setPayments((currentPayments) =>
        currentPayments.map((payment) =>
          payment.id === selectedDenyPaymentId
            ? { ...payment, status: 'rejected', denialReason: denyReason }
            : payment
        )
      )
      setDenyReasonModalOpen(false)
      setSelectedDenyPaymentId(null)
      setDenyReason('')
    } catch (rejectError) {
      setError(rejectError.message)
    }
  }

  const handleConfirmAction = async () => {
    try {
      await approvePayment(selectedPaymentId)
      setPayments((currentPayments) =>
        currentPayments.map((payment) =>
          payment.id === selectedPaymentId
            ? { ...payment, status: 'approved' }
            : payment
        )
      )
      setConfirmModalOpen(false)
      setSelectedPaymentId(null)
    } catch (approveError) {
      setError(approveError.message)
    }
  }

  const getFilteredPayments = () => {
    return payments.filter((payment) => payment.status === mapTabToStatus(activeTab))
  }

  const getTabCount = (tab) => {
    return payments.filter((payment) => payment.status === mapTabToStatus(tab)).length
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">Review payment</h1>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-4 sm:gap-6 md:gap-8 border-b border-gray-200 pb-3 sm:pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('review')}
            className={`font-semibold text-sm sm:text-base md:text-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'review'
                ? 'text-pink-500 border-pink-500'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            Review <span className="text-gray-400 text-xs sm:text-sm">({getTabCount('review')})</span>
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`font-semibold text-sm sm:text-base md:text-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'approved'
                ? 'text-green-600 border-green-600'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            Approved <span className="text-gray-400 text-xs sm:text-sm">({getTabCount('approved')})</span>
          </button>
          <button
            onClick={() => setActiveTab('denied')}
            className={`font-semibold text-sm sm:text-base md:text-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'denied'
                ? 'text-red-600 border-red-600'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            Denied <span className="text-gray-400 text-xs sm:text-sm">({getTabCount('denied')})</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-sm">
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
            <div className="text-center py-8 md:py-12">
              <div className="text-gray-400 text-sm sm:text-base md:text-lg">No payments to display</div>
            </div>
          )}
        </>
      )}

      <ConfirmationModal
        isOpen={confirmModalOpen}
        title="Approve Payment"
        message="Are you sure you want to approve this payment? The course will be added to the user's account."
        confirmText="Approve"
        cancelText="Cancel"
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModalOpen(false)}
        isDangerous={false}
      />

      {denyReasonModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Deny message for {payments.find((payment) => payment.id === selectedDenyPaymentId)?.userName}!
              </h2>
              <button
                onClick={() => {
                  setDenyReasonModalOpen(false)
                  setSelectedDenyPaymentId(null)
                  setDenyReason('')
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Write your reason here ..."
                className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
                rows="4"
              />
            </div>

            <div className="flex gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setDenyReasonModalOpen(false)
                  setSelectedDenyPaymentId(null)
                  setDenyReason('')
                }}
                className="flex-1 px-3 sm:px-4 py-2 text-gray-700 font-medium text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeny}
                className="flex-1 px-3 sm:px-4 py-2 bg-pink-500 text-white font-medium text-sm rounded-lg hover:bg-pink-600 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReviewPayment
