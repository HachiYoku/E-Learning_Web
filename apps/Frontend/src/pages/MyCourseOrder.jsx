import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'
import { fetchMyPayments } from '../services/paymentService'

function MyCourseOrder() {
  const navigate = useNavigate()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true)
        setError('')
        setPayments(await fetchMyPayments())
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }
    loadPayments()
  }, [])

  const renderStars = (rating) => (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={i < Math.floor(rating) ? 'text-yellow-400 text-sm' : 'text-gray-300 text-sm'}>
          ★
        </span>
      ))}
    </div>
  )

  const getStatusLabel = (status) => {
    if (status === 'approved') return 'Approved'
    if (status === 'rejected') return 'Rejected'
    return 'Pending'
  }

  const getStatusClasses = (status) => {
    if (status === 'approved') return 'bg-green-100 text-green-700'
    if (status === 'rejected') return 'bg-red-100 text-red-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col">
      <Navbar />

      {/* Page Header */}
      <div className="px-4 sm:px-6 md:px-10 py-8 sm:py-10 md:py-12 text-center bg-white">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900">
          My Course Order
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 md:px-10 py-8 sm:py-10 md:py-16">
        <div className="max-w-7xl mx-auto">

          {error ? (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <LoadingSpinner message="Loading payments..." />
          ) : payments.length === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-sm">
              You have not submitted any course payments yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {payments.map((payment) => {
                const course = payment.course
                return (
                  <div
                    key={payment.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6"
                  >
                    {/* Course Image */}
                    <div className="w-full sm:w-40 md:w-48 h-44 sm:h-auto sm:min-h-36 bg-gray-200 overflow-hidden rounded-xl shrink-0">
                      {course?.image ? (
                        <img
                          src={course.image}
                          alt={course.title}
                          className="w-full h-56 object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm font-semibold text-gray-500">
                          No image
                        </div>
                      )}
                    </div>

                    {/* Course Info */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      {/* Status badge */}
                      <div className={`inline-block text-xs font-semibold px-3 py-1.5 rounded-full mb-2 text-center ${getStatusClasses(payment.status)}`}>
                        {getStatusLabel(payment.status)}
                      </div>

                      <p className="text-gray-900 font-semibold text-base sm:text-lg mb-1 truncate">
                        {course?.title}
                      </p>

                      <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-2 line-clamp-2">
                        {course?.description}
                      </p>

                      <div className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                        {course?.price}
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        {renderStars(4.5)}
                        <span className="text-gray-500 text-xs">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <button
                        onClick={() => navigate(`/order-status/${payment.id}`)}
                        className="w-full bg-[#F8B2C0] hover:bg-[#F8C2C0] text-gray-900 font-bold py-2 px-4 rounded-full transition-colors text-sm"
                      >
                        Check Status
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>

      <Footer />
    </div>
  )
}

export default MyCourseOrder
