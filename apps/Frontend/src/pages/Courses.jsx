import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import CourseCard from '../components/CourseCard'
import TestimonialVideo from '../components/TestimonialVideo'
import ContactSection from '../components/ContactSection'
import Footer from '../components/Footer'
import { fetchCourses } from '../services/courseService'
import image1 from '../assets/courses/IELTS speaking.jpg'
import image2 from '../assets/courses/daily english.jpg'
import LoadingSpinner from '../components/LoadingSpinner'

const COURSES_PER_PAGE = 6

function Courses() {
  const [currentPage, setCurrentPage] = useState(1)
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
  }, [])

  const totalPages = Math.max(1, Math.ceil(courses.length / COURSES_PER_PAGE))
  const startIndex = (currentPage - 1) * COURSES_PER_PAGE
  const currentCourses = courses.slice(startIndex, startIndex + COURSES_PER_PAGE)

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <div className="px-4 sm:px-6 md:px-10 py-8 sm:py-12 md:py-16 text-center bg-gray-50">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6">
          ยกระดับภาษาอังกฤษด้วยคอร์สออนไลน์และหนังสือของเรา
        </h1>
        <p className="text-gray-600 text-xs sm:text-sm md:text-base max-w-2xl mx-auto">
          รวบรวมคอร์สเรียนวิดีโอและหนังสือภาษาอังกฤษที่คัดสรรมาเพื่อคุณโดยเฉพาะ ให้คุณเลือกเรียนรู้ได้ตามจังหวะของตัวเอง เน้นพัฒนาทั้งการพูด ไวยากรณ์ และทักษะการสื่อสารที่นำไปใช้ได้จริงในทุกสถานการณ์
        </p>
      </div>

      <div className="px-4 sm:px-6 md:px-10 py-8 sm:py-12 md:py-16">
        <div className="max-w-7xl mx-auto">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : loading ? (
              <LoadingSpinner message="Loading courses..." />
          ) : currentCourses.length === 0 ? (
            <div className="rounded-lg bg-gray-50 px-4 py-10 text-center text-gray-500">
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
                  />
                ))}
              </div>

              {courses.length > COURSES_PER_PAGE ? (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10 md:mt-12">
                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => handlePageChange(pageNumber)}
                      className={`h-10 w-10 rounded-full text-sm font-semibold transition sm:text-base ${
                        currentPage === pageNumber
                          ? 'bg-[#F8B2C0] text-gray-900'
                          : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={currentPage === pageNumber ? 'page' : undefined}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-10 py-10 sm:py-14 md:py-16 text-center bg-pink-100">
        <div className="flex justify-center">
          <div>
            <h2 className="text-base sm:text-lg md:text-xl lg:text-3xl font-bold text-gray-900 mb-2 sm:mb-3 leading-snug">
              Master English faster with expert-guided video courses designed for<br className="hidden sm:block" />practical speaking, grammar, and everyday communication.
            </h2>
            <div className="h-1 w-20 sm:w-28 md:w-32 bg-black mx-auto"></div>
          </div>
        </div>
        <p className="text-[#8B6F61] text-xs sm:text-sm md:text-base lg:text-lg mt-4 sm:mt-5 md:mt-6 max-w-3xl mx-auto">
          Learn smarter, progress faster, and speak with confidence.
        </p>
      </div>

      <div className="px-4 sm:px-6 md:px-10 py-10 sm:py-14 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-5 md:mb-6">
              Free Course Preview Videos
            </h2>
            <p className="text-gray-600 text-xs sm:text-sm md:text-base lg:text-lg max-w-2xl mx-auto">
              Explore sample lessons that show how our courses teach step by step.<br className="hidden sm:block" />
              Learn practical tips, clear explanations, and real examples
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7 md:gap-8">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">
                <span className="font-bold">Speak English with Confidence</span>
                <span className="text-gray-600 font-normal text-sm sm:text-base"> (Free to learn)</span>
              </h3>
              <TestimonialVideo 
                image={image1} src="https://youtu.be/PXO2x2GDCFY?si=0n7RxcjldQTaI2cx"
                backgroundColor="bg-green-500"
              />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">
                <span className="font-bold">English Basics – Free Starter Course</span>
                <span className="text-gray-600 font-normal text-sm sm:text-base"> (Free to learn)</span>
              </h3>
              <TestimonialVideo 
                image={image2} src="https://youtu.be/9n7s8Xo2l3c?si=0n7RxcjldQTaI2cx"
                backgroundColor="bg-yellow-400"
              />
            </div>
          </div>
        </div>
      </div>

      <ContactSection />
      <Footer />
    </div>
  )
}

export default Courses
