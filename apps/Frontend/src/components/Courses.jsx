import { ArrowRight } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import CourseCard from "./CourseCard"
import LoadingSpinner from "./LoadingSpinner"
import { fetchCourses } from "../services/courseService"

function Courses() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
  }, [])

  return (
    <section className="px-4 sm:px-6 md:px-10 py-8 sm:py-12 md:py-16 bg-[#FEF7F9] overflow-hidden">
      <div className="relative max-w-6xl mx-auto">
        <div className="absolute -left-10 -top-30 w-30 md:w-30 h-30 md:h-30 rounded-full pointer-events-none z-10" style={{ backgroundColor: "#B5E0F8" }}></div>
        <div className="absolute -left-55 -top-25 w-60 md:w-60 h-30 md:h-30 rounded-xl pointer-events-none z-10" style={{ backgroundColor: "#B5E0F8" }}></div>
        <div className="absolute -right-10 -bottom-30 w-30 md:w-30 h-30 md:h-30 rounded-full pointer-events-none z-10" style={{ backgroundColor: "#B5E0F8" }}></div>
        <div className="absolute -right-55 -bottom-25 w-60 md:w-60 h-30 md:h-30 rounded-xl pointer-events-none z-10" style={{ backgroundColor: "#B5E0F8" }}></div>
        
        <div className="flex justify-center mb-6 sm:mb-8 md:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 pb-2 sm:pb-3 border-b-9 border-black">
            Courses
          </h2>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
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
              />
            ))}
          </div>
        )}

        <div className="flex justify-center mt-8 sm:mt-10 md:mt-12">
          <button 
            onClick={() => navigate('/courses')}
            className="font-semibold px-5 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-xl hover:opacity-80 transition-opacity flex items-center gap-2 text-sm sm:text-base" 
            style={{backgroundColor: "#B5E0F8"}}
          >
            View All Courses
            <ArrowRight className="h-5 w-5 text-black" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}

export default Courses
