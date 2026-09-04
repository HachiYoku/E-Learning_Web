import { ArrowRight, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import CourseCard from "./CourseCard"
import LoadingSpinner from "./LoadingSpinner"
import { fetchCourses } from "../services/courseService"
import { fetchMyEnrollments } from "../services/enrollmentService"
import { useAuth } from "../contexts/AuthContext"

function Courses() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(() => new Set())
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    async function loadFeaturedCourses() {
      try {
        setLoading(true)
        setError('')
        const response = await fetchCourses()
        setCourses(response.slice(0, 4))
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadFeaturedCourses()
  }, [loadVersion])

  useEffect(() => {
    if (!isAuthenticated) {
      setEnrolledCourseIds(new Set())
      return
    }

    let isMounted = true

    async function loadEnrollments() {
      try {
        const enrollments = await fetchMyEnrollments()
        if (isMounted) {
          setEnrolledCourseIds(new Set(
            enrollments
              .map((enrollment) => enrollment.course?.id)
              .filter(Boolean)
          ))
        }
      } catch {
        if (isMounted) {
          setEnrolledCourseIds(new Set())
        }
      }
    }

    loadEnrollments()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated])

  const retryLoadingCourses = () => {
    setError('')
    setLoading(true)
    setLoadVersion((current) => current + 1)
  }

  return (
    <section className="relative isolate overflow-hidden bg-[#FFF9EA] px-4 py-12 sm:px-6 sm:py-16 md:px-10 md:py-24 lg:px-16">
      <div className="absolute -left-32 top-16 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/20 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-24 bottom-0 -z-10 h-96 w-96 rounded-full bg-[#E9A9A0]/18 blur-3xl" aria-hidden="true" />
      <div className="absolute inset-0 -z-10 opacity-[0.035] [background-image:linear-gradient(rgba(45,46,48,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(45,46,48,.9)_1px,transparent_1px)] [background-size:44px_44px]" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1500px]">
        
        <div className="flex justify-center mb-6 sm:mb-8 md:mb-10">
          <h2 className="border-b-4 border-[#E58C1A] pb-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:pb-3 sm:text-3xl md:text-4xl lg:text-5xl">
            Courses
          </h2>
        </div>

        {error ? (
          <div className="mx-auto flex max-w-xl flex-col items-center rounded-[1.75rem] border border-[#2D2E30]/10 bg-white px-6 py-10 text-center shadow-[0_18px_45px_-34px_rgba(80,48,19,0.35)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1CE] text-[#C97112]"><RefreshCw className="h-5 w-5" aria-hidden="true" /></div>
            <h3 className="mt-5 text-xl font-bold text-[#2D2E30]">Courses are taking a moment to load</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#765F55]">Please check your connection and try again.</p>
            <button type="button" onClick={retryLoadingCourses} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A]"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button>
          </div>
        ) : loading ? (
          <LoadingSpinner message="Loading courses..." />
        ) : courses.length === 0 ? (
          <div className="rounded-lg bg-white px-4 py-10 text-center text-gray-500 shadow-sm">
            No courses available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                id={course.id}
                image={course.image}
                title={course.title}
                description={course.description}
                price={course.price}
                rating={course.rating}
                reviews={course.reviews}
                isEnrolled={enrolledCourseIds.has(course.id)}
              />
            ))}
          </div>
        )}

        <div className="flex justify-center mt-8 sm:mt-10 md:mt-12">
          <button 
            onClick={() => navigate('/courses')}
            className="flex items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-2 font-semibold text-sm text-white shadow-lg shadow-[#2D2E30]/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#E58C1A] hover:shadow-xl sm:px-6 sm:py-2.5 sm:text-base md:px-8 md:py-3"
          >
            View All Courses
            <ArrowRight className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}

export default Courses
