import { Check, X, Maximize2 } from 'lucide-react'
import { useState } from 'react'

function PaymentCard({ payment, onApprove, onDeny, status = 'review' }) {
  const [showSlipModal, setShowSlipModal] = useState(false)
 

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
        <div className="relative p-4 sm:p-5">
          {/* Left Side - Payment Slip */}
          <button
            onClick={() => setShowSlipModal(true)}
            className="group relative mb-4 block w-full transition-opacity hover:opacity-90"
            title="Click to view slip"
          >
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 md:p-4 group-hover:border-pink-300">
              {payment.paymentImage ? (
                <img
                  src={payment.paymentImage}
                  alt="Payment slip"
                  className="h-52 w-full rounded-xl object-cover"
                />
              ) : (
                <>
                  <div className="flex items-center justify-center gap-1 mb-3">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-gray-600 text-center">Transaction<br/>successful</span>
                  </div>

                  <div className="text-center mb-4 pb-4 border-b border-gray-300">
                    <div className="text-xs text-gray-500 mb-1">From</div>
                    <div className="font-bold text-gray-900 text-sm md:text-base">{payment.amount}</div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></div>
                      <span className="text-gray-700">{payment.paymentMethod}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></div>
                      <span className="text-gray-700">{payment.cardInfo}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Expand Icon */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-pink-500 text-white p-1.5 rounded-lg">
                  <Maximize2 size={12} />
                </div>
              </div>
            </div>
          </button>

          {/*  User & Course Info */}
          <div className="flex flex-col">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-gray-200 pb-4 md:mb-5 md:gap-4">
              <div className="flex min-w-0 items-start gap-3 md:gap-4">
                <img
                  src={payment.userAvatar}
                  alt={payment.userName}
                  className="h-12 w-12 shrink-0 rounded-full object-cover md:h-14 md:w-14 lg:h-16 lg:w-16"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900 md:text-base lg:text-lg">{payment.userName}</div>
                  <div className="truncate text-xs text-gray-500 md:text-sm">{payment.userDate}</div>
                </div>
              </div>

              <span
                className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  status === 'approved'
                    ? 'bg-emerald-100 text-emerald-700'
                    : status === 'denied'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {status === 'approved' ? 'Approved' : status === 'denied' ? 'Denied' : 'Pending'}
              </span>
            </div>

            <div className="mb-4 space-y-3 md:mb-5">
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Course</div>
                <div className="text-sm font-semibold text-gray-900">{payment.courseName}</div>
              </div>

              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Amount</div>
                <div className="text-lg font-bold text-gray-900">{payment.coursePrice}</div>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              {payment.paymentMethod ? (
                <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-sky-700">{payment.paymentMethod}</span>
              ) : null}
              {payment.date ? (
                <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">{payment.date}</span>
              ) : null}
            </div>

            {/* Denial Reason - Show for Denied Status */}
            {status === 'denied' && payment.denialReason && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 md:mb-5">
                <div className="mb-1 text-xs font-semibold text-red-700">Reason for denial</div>
                <div className="text-sm text-gray-700">{payment.denialReason}</div>
              </div>
            )}

            {/* Action Buttons */}
            {status === 'review' && (
              <div className="mt-auto flex gap-2 md:gap-3">
                <button
                  onClick={() => onDeny(payment.id)}
                  className="flex-1 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
                >
                  Deny
                </button>
                <button
                  onClick={() => onApprove(payment.id)}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slip Viewing Modal */}
      {showSlipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Payment Slip</h2>
              <button
                onClick={() => setShowSlipModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body - Enlarged Slip */}
            <div className="p-6">
              {payment.paymentImage ? (
                <img
                  src={payment.paymentImage}
                  alt="Payment slip"
                  className="max-h-[70vh] w-full rounded-lg object-contain"
                />
              ) : (
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-600 font-semibold">Transaction successful</span>
                  </div>

                  <div className="text-center mb-8 pb-6 border-b border-gray-300">
                    <div className="text-sm text-gray-500 mb-2">From</div>
                    <div className="text-3xl font-bold text-gray-900">{payment.amount}</div>
                  </div>

                  <div className="mb-8 pb-6 border-b border-gray-300">
                    <div className="text-sm font-semibold text-gray-900 mb-4">Payment Method</div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                        <span className="text-gray-700">{payment.paymentMethod}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                        <span className="text-gray-700">{payment.cardInfo}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center text-sm text-gray-500">
                    {payment.date}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowSlipModal(false)}
                className="w-full px-4 py-2 bg-pink-500 text-white font-semibold rounded-lg hover:bg-pink-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PaymentCard
