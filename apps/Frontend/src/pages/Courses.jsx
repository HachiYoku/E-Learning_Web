import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, PlayCircle, RefreshCw } from 'lucide-react'
import Navbar from '../components/Navbar'
import CourseCard from '../components/CourseCard'
import TestimonialVideo from '../components/TestimonialVideo'
import ContactSection from '../components/ContactSection'
import Footer from '../components/Footer'
import { fetchCourses } from '../services/courseService'
import { fetchMyEnrollments } from '../services/enrollmentService'
import { useAuth } from '../contexts/AuthContext'
import image1 from '../assets/courses/IELTS speaking.jpg'
import image2 from '../assets/courses/daily english.jpg'
import LoadingSpinner from '../components/LoadingSpinner'

const COURSES_PER_PAGE = 6

function Courses() {
  const [currentPage, setCurrentPage] = useState(1)
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(() => new Set())
  const coursesSectionRef = useRef(null)
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    async function loadCourses() {
      try {
        setLoading(true)
        setError('')
        const response = await fetchCourses()
        setCourses(response)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadCourses()
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

  const totalPages = Math.max(1, Math.ceil(courses.length / COURSES_PER_PAGE))
  const activePage = Math.min(currentPage, totalPages)
  const startIndex = (activePage - 1) * COURSES_PER_PAGE
  const currentCourses = courses.slice(startIndex, startIndex + COURSES_PER_PAGE)

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    coursesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const retryLoadingCourses = () => {
    setError('')
    setLoading(true)
    setLoadVersion((current) => current + 1)
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <section className="relative isolate overflow-hidden bg-[#FFF9EA] px-4 py-12 sm:px-6 sm:py-16 md:px-10 md:py-18">
        <div className="absolute -left-24 top-0 -z-10 h-72 w-72 rounded-full bg-[#F8C56A]/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-36 right-0 -z-10 h-96 w-96 rounded-full bg-[#E9A9A0]/25 blur-3xl" aria-hidden="true" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#E58C1A]/25 bg-white/75 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#C97112] shadow-sm">
            Learn Thai your way
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-[#2D2E30] sm:text-5xl md:text-6xl">
            Courses made for <span className="text-[#E58C1A]">real Thai.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base md:text-lg">
            Choose a self-paced video course that makes speaking, grammar, and everyday communication feel clear, practical, and enjoyable.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-semibold text-[#765F55]">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm"><BookOpen className="h-4 w-4 text-[#E58C1A]" aria-hidden="true" /> Learn at your pace</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm"><PlayCircle className="h-4 w-4 text-[#E58C1A]" aria-hidden="true" /> Watch anywhere</span>
          </div>
        </div>
      </section>

      <section ref={coursesSectionRef} className="scroll-mt-20 bg-[#FFFDF8] px-4 py-14 sm:px-6 sm:py-16 md:px-10 md:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex flex-col gap-3 border-b border-[#2D2E30]/10 pb-6 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Find your next lesson</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">Explore all courses</h2>
            </div>
            {!loading && courses.length > 0 ? <p className="text-sm font-medium text-[#765F55]">{courses.length} {courses.length === 1 ? 'course' : 'courses'} available</p> : null}
          </div>
          {error ? (
            <div className="mx-auto flex max-w-xl flex-col items-center rounded-[2rem] border border-[#2D2E30]/10 bg-white px-6 py-12 text-center shadow-[0_20px_50px_-36px_rgba(80,48,19,0.4)] sm:px-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1CE] text-[#C97112] shadow-sm"><RefreshCw className="h-6 w-6" aria-hidden="true" /></div>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[#C97112]">Course library</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30]">We couldn’t load the courses</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#765F55]">Please check your connection and try again. Your next Thai lesson is waiting.</p>
              <button type="button" onClick={retryLoadingCourses} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A]"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button>
            </div>
          ) : loading ? (
              <LoadingSpinner message="Loading courses..." />
          ) : currentCourses.length === 0 ? (
            <div className="rounded-2xl border border-[#2D2E30]/10 bg-white px-4 py-12 text-center text-[#765F55] shadow-sm">
              No published courses are available yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                {currentCourses.map((course) => (
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

              {courses.length > COURSES_PER_PAGE ? (
                <nav className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:mt-12 sm:gap-3" aria-label="Course pages">
                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.max(activePage - 1, 1))}
                    disabled={activePage === 1}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:border-[#E58C1A] hover:text-[#C97112] disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => handlePageChange(pageNumber)}
                      className={`h-10 w-10 rounded-full text-sm font-semibold transition sm:text-base ${
                        activePage === pageNumber
                          ? 'bg-[#E58C1A] text-white shadow-md shadow-[#E58C1A]/25'
                          : 'border border-[#2D2E30]/15 bg-white text-[#765F55] hover:border-[#E58C1A] hover:text-[#C97112]'
                      }`}
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={activePage === pageNumber ? 'page' : undefined}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.min(activePage + 1, totalPages))}
                    disabled={activePage === totalPages}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#2D2E30]/15 transition hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </nav>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#2D2E30] px-4 py-14 text-center sm:px-6 sm:py-16 md:px-10 md:py-20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E58C1A] to-transparent" aria-hidden="true" />
        <div className="flex justify-center">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#F8C56A]">Built for real progress</p>
            <h2 className="text-2xl font-bold leading-snug text-white sm:text-3xl lg:text-4xl">
              Master Thai faster with expert-guided video courses designed for<br className="hidden sm:block" />practical speaking, grammar, and everyday communication.
            </h2>
            <div className="mx-auto mt-6 h-1 w-20 rounded-full bg-[#E58C1A] sm:w-28" />
          </div>
        </div>
        <p className="mx-auto mt-5 max-w-3xl text-sm leading-relaxed text-white/70 sm:text-base lg:text-lg">
          Learn smarter, progress faster, and speak with confidence.
        </p>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 sm:py-16 md:px-10 md:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 text-center sm:mb-10 md:mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Try before you begin</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">
              Free course previews
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base lg:text-lg">
              Explore sample lessons that show how our courses teach step by step.<br className="hidden sm:block" />
              Learn practical tips, clear explanations, and real examples
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7 md:gap-8">
            <div>
              <h3 className="mb-3 text-lg font-bold text-[#2D2E30] sm:text-xl">
                <span className="font-bold">Speak Thai with Confidence</span>
                <span className="text-gray-600 font-normal text-sm sm:text-base"> (Free to learn)</span>
              </h3>
              <TestimonialVideo 
                image={image1} src="https://youtu.be/PXO2x2GDCFY?si=0n7RxcjldQTaI2cx"
                backgroundColor="bg-green-500"
              />
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-[#2D2E30] sm:text-xl">
                <span className="font-bold">Thai Basic – Free Starter Course</span>
                <span className="text-gray-600 font-normal text-sm sm:text-base"> (Free to learn)</span>
              </h3>
              <TestimonialVideo 
                image={image2} src="https://youtu.be/9n7s8Xo2l3c?si=0n7RxcjldQTaI2cx"
                backgroundColor="bg-yellow-400"
              />
            </div>
          </div>
        </div>
      </section>

      <ContactSection />
      <Footer />
    </div>
  )
}

export default Courses
