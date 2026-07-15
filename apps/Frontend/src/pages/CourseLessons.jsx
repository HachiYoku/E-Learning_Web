import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'
import { fetchCourseById } from '../services/courseService'
import { fetchLessonsByCourse } from '../services/lessonService'

function CourseLessons() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadCourseLessons() {
      try {
        setLoading(true)
        setError('')

        const [courseResponse, lessonsResponse] = await Promise.all([
          fetchCourseById(courseId),
          fetchLessonsByCourse(courseId),
        ])

        setCourse(courseResponse)
        setLessons(lessonsResponse)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadCourseLessons()
  }, [courseId])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner message="Loading lessons..." />
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <p className="text-2xl text-gray-600">{error || 'Course not found'}</p>
        </div>
      </div>
    )
  }

  const courseFeatures = course.features.length > 0
    ? course.features
    : [
        'Clear, step-by-step lessons',
        'Real examples and guided practice',
        'A simple structure you can follow at your own pace',
      ]

  return (
    <div className="min-h-screen bg-blue-50">
      <Navbar />

      <div className="px-4 md:px-10 pt-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate('/my-courses')}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-semibold transition-colors"
          >
            <span className="text-2xl">←</span>
            Back To My Course
          </button>
        </div>
      </div>

      <div className="px-4 md:px-10 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              Course's Lessons
            </h1>
          </div>

          {error ? (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-white rounded-2xl overflow-hidden shadow-lg p-6 sticky top-20">
                <div className="mb-6">
                  {course.image ? (
                    <img
                      src={course.image}
                      alt={course.title}
                      className="w-full h-48 object-cover rounded-xl"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                      No image
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  {course.title}
                </h2>

                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                  {course.description}
                </p>

                <div>
                  <h3 className="font-bold text-gray-900 mb-3">What you'll learn:</h3>
                  <ul className="space-y-2">
                    {courseFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-gray-600 text-xs">
                        <span className="text-pink-400 mt-1">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                {lessons.length === 0 ? (
                  <div className="text-center text-gray-500">
                    No lessons are available in this course yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lessons.map((lesson) => (
                      <a
                        key={lesson.id}
                        href={lesson.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-pink-300 transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-4 text-left flex-1">
                          <span className="text-gray-500 font-semibold text-sm w-8">
                            {lesson.order}.
                          </span>
                          <span className="text-gray-900 font-semibold group-hover:text-pink-400 transition-colors">
                            {lesson.title}
                          </span>
                        </div>
                        <span className="text-gray-400 group-hover:text-pink-400 transition-colors text-xl">
                          →
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default CourseLessons
