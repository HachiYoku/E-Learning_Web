import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import MyCourseCard from '../components/MyCourseCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { fetchMyEnrollments } from '../services/enrollmentService'

function MyCourses() {
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadEnrollments() {
      try {
        setLoading(true)
        setError('')
        setEnrollments(await fetchMyEnrollments())
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadEnrollments()
  }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="px-4 md:px-10 py-12 text-center bg-blue-50">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
          My Courses
        </h1>
      </div>

      <div className="flex-1 px-4 md:px-10 py-16">
        <div className="max-w-7xl mx-auto">
          {error ? (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <LoadingSpinner message="Loading enrolled courses..." />
          ) : enrollments.length === 0 ? (
            <div className="rounded-lg bg-gray-50 px-4 py-10 text-center text-gray-500">
              You do not have any approved courses yet.
            </div>
          ) : (
            <div className="grid md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 gap-6">
              {enrollments.map((enrollment) => (
                <MyCourseCard
                  key={enrollment.id}
                  id={enrollment.course?.id}
                  image={enrollment.course?.image}
                  title={enrollment.course?.title}
                  description={enrollment.course?.description}
                  lessons="Access available"
                  buttonText="Learn Now"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default MyCourses
