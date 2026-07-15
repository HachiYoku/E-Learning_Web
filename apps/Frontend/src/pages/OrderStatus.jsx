import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'
import { fetchMyPayments } from '../services/paymentService'

const orderSteps = ['Payment', 'Receipt uploaded', 'Verification']

function OrderStatus() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPayment() {
      try {
        setLoading(true)
        setError('')
        const payments = await fetchMyPayments()
        const matchedPayment = payments.find((item) => item.id === orderId)
        if (!matchedPayment) throw new Error('Order not found')
        setPayment(matchedPayment)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }
    loadPayment()
  }, [orderId])

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner message="Loading order..." />
        </div>
      </div>
    )
  }

  if (!payment || !payment.course) {
    return (
      <div className="min-h-screen bg-blue-50">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <p className="text-lg sm:text-2xl text-gray-600">{error || 'Order not found'}</p>
        </div>
      </div>
    )
  }

  const course = payment.course

  const renderStars = (rating) => (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'}>★</span>
      ))}
    </div>
  )

  const renderStatusStepper = (steps) => (
    <div className="mb-6 sm:mb-8 flex justify-center rounded-2xl border border-[#F3D6DF] bg-[#FFF8FA] px-3 py-3 sm:px-6 sm:py-6 shadow-sm">
      <div className="inline-flex items-start justify-center gap-1 sm:gap-3">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center justify-center">
            <div className="flex w-16 sm:w-24 flex-col items-center text-center">
              <div className={`mb-2 sm:mb-3 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border-2 text-xs sm:text-sm font-bold transition-all ${step.circleClass}`}>
                {step.icon}
              </div>
              <p className={`text-[10px] sm:text-xs font-semibold leading-tight ${step.labelClass || 'text-gray-900'}`}>
                {step.label}
              </p>
              <p className="mt-0.5 text-[9px] sm:text-[11px] text-gray-400">
                Step {index + 1}
              </p>
            </div>

            {index < steps.length - 1 ? (
              <div className="mb-5 w-5 sm:w-10 mx-0.5 sm:mx-1">
                <div className="h-1 w-full rounded-full bg-gray-200">
                  <div className={`h-full w-full rounded-full ${step.lineClass}`} />
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )

  const renderApprovedStatus = () => (
    <div>
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="text-green-500 text-2xl sm:text-3xl">✓</div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Enrollment Confirmed</h2>
      </div>

      {renderStatusStepper([
        { label: orderSteps[0], icon: '✓', circleClass: 'border-[#F8B2C0] bg-[#F8B2C0] text-gray-900', lineClass: 'bg-[#F8B2C0]' },
        { label: orderSteps[1], icon: '✓', circleClass: 'border-[#F8B2C0] bg-[#F8B2C0] text-gray-900', lineClass: 'bg-green-500' },
        { label: orderSteps[2], icon: '✓', circleClass: 'border-green-500 bg-green-500 text-white' },
      ])}

      <p className="text-gray-700 text-sm sm:text-base mb-2">Your payment has been successfully verified.</p>
      <p className="text-gray-600 text-xs sm:text-sm mb-5 sm:mb-6">You now have full access to this course.</p>

      <button
        onClick={() => navigate(`/course-lessons/${course.id}`)}
        className="w-full bg-[#F8B2C0] hover:bg-[#F8C2C0] text-gray-900 font-bold py-2.5 sm:py-3 px-6 rounded-full transition-colors"
      >
        Go To Course
      </button>
    </div>
  )

  const renderRejectedStatus = () => (
    <div>
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="text-red-500 text-2xl sm:text-3xl">✕</div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Payment Not Verified</h2>
      </div>

      {renderStatusStepper([
        { label: orderSteps[0], icon: '✓', circleClass: 'border-[#F8B2C0] bg-[#F8B2C0] text-gray-900', lineClass: 'bg-[#F8B2C0]' },
        { label: orderSteps[1], icon: '✓', circleClass: 'border-[#F8B2C0] bg-[#F8B2C0] text-gray-900', lineClass: 'bg-red-500' },
        { label: orderSteps[2], icon: '✕', circleClass: 'border-red-500 bg-red-500 text-white' },
      ])}

      <p className="text-gray-700 text-sm sm:text-base mb-2">We couldn't verify your payment.</p>
      <p className="text-gray-600 text-xs sm:text-sm mb-4 leading-relaxed">
        Reject Reason:{" "}
        <span className="font-semibold">
          {payment.rejectReason || 'Please re-upload your receipt or contact support for assistance.'}
        </span>
      </p>

      <button
        onClick={() => navigate(`/payment/${course.id}`)}
        className="w-full bg-[#F8B2C0] hover:bg-[#F8C2C0] text-gray-900 font-bold py-2.5 sm:py-3 px-6 rounded-full transition-colors"
      >
        Resubmit Receipt
      </button>
    </div>
  )

  const renderPendingStatus = () => (
    <div>
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="text-yellow-500 text-2xl sm:text-3xl animate-pulse">⏳</div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Payment Under Review</h2>
      </div>

      {renderStatusStepper([
        { label: orderSteps[0], icon: '✓', circleClass: 'border-[#F8B2C0] bg-[#F8B2C0] text-gray-900', lineClass: 'bg-[#F8B2C0]' },
        { label: orderSteps[1], icon: '✓', circleClass: 'border-[#F8B2C0] bg-[#F8B2C0] text-gray-900', lineClass: 'bg-yellow-400' },
        { label: orderSteps[2], icon: '⏳', circleClass: 'border-yellow-400 bg-yellow-400 text-white animate-pulse' },
      ])}

      <p className="text-gray-700 text-sm sm:text-base mb-2">Your payment has been successfully submitted!</p>
      <p className="text-gray-600 text-xs sm:text-sm mb-5 sm:mb-6">Our admin team is reviewing your payment receipt.</p>

      <button
        onClick={() => navigate('/my-course-order')}
        className="w-full bg-[#F8B2C0] hover:bg-[#F8C2C0] text-gray-900 font-bold py-2.5 sm:py-3 px-6 rounded-full transition-colors"
      >
        Back to Orders
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-blue-50">
      <Navbar />

      {/* Back Button */}
      <div className="px-4 sm:px-6 md:px-10 pt-6 sm:pt-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate('/my-course-order')}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-semibold transition-colors text-sm sm:text-base"
          >
            <span className="text-xl sm:text-2xl">←</span>
            Back To My Orders
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-10 py-8 sm:py-10 md:py-12">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900">
              Complete Your Enrollment
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 md:gap-8">

            {/* Left — Course Info */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 md:p-8 shadow-lg">

              {/* Course Image */}
              <div className="mb-4 sm:mb-6">
                {course.image ? (
                  <img
                    src={course.image}
                    alt={course.title}
                    className="w-full h-44 sm:h-56 md:h-64 lg:h-72 object-cover rounded-2xl"
                  />
                ) : (
                  <div className="flex w-full h-44 sm:h-56 md:h-64 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
                    No image
                  </div>
                )}
              </div>

              {/* Badge */}
              <div className="mb-2">
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                  {course.title}
                </span>
              </div>

              {/* Info */}
              <div className="mb-3">
                <h1 className="text-base sm:text-lg font-semibold text-gray-900">
                  Ordering Course — {course.title}
                </h1>
                <h2 className="text-base sm:text-lg font-semibold text-gray-700">
                  Price — {course.price}
                </h2>
              </div>

              {/* Stars + Date */}
              <div className="flex items-center gap-3">
                {renderStars(4.5)}
                <span className="text-gray-600 text-xs sm:text-sm font-semibold">
                  ({new Date(payment.createdAt).toLocaleDateString()})
                </span>
              </div>
            </div>

            {/* Right — Order Status */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 md:p-8 shadow-lg">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5 sm:mb-6 md:mb-8">
                Order Status
              </h3>

              {payment.status === 'approved' ? renderApprovedStatus() : null}
              {payment.status === 'rejected' ? renderRejectedStatus() : null}
              {payment.status === 'pending' ? renderPendingStatus() : null}
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default OrderStatus