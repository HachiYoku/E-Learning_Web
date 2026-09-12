import { useEffect, useState } from "react"
import { BookOpen, RefreshCw } from "lucide-react"
import CourseCard from "../components/CourseCard"
import LoadingSpinner from "../components/LoadingSpinner"
import { fetchCourses } from "../services/courseService"
import { fetchMyEnrollments } from "../services/enrollmentService"

function StudentExplore() {
  const [courses, setCourses] = useState([])
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([fetchCourses(), fetchMyEnrollments()])
      .then(([courseList, enrollments]) => {
        if (!active) return
        setCourses(courseList)
        setEnrolledCourseIds(new Set(enrollments.map((item) => item.course?.id).filter(Boolean)))
      })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshKey])

  const retry = () => {
    setError("")
    setLoading(true)
    setRefreshKey((current) => current + 1)
  }
  const availableCourses = courses.filter((course) => !enrolledCourseIds.has(course.id))

  return (
    <div className="w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-3 border-b border-[#2D2E30]/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Course catalog</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Explore courses</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-[#765F55]">Choose your next practical Thai learning path.</p></div>
        {!loading && !error ? <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#FFF1D0] px-3 py-2 text-xs font-bold text-[#9A5816]"><BookOpen className="h-4 w-4" />{availableCourses.length} available</span> : null}
      </div>

      <section className="mt-8">
        {loading ? <LoadingSpinner message="Loading courses..." /> : error ? <div className="rounded-2xl border border-[#2D2E30]/10 bg-white px-6 py-12 text-center"><p className="text-sm text-[#765F55]">{error}</p><button type="button" onClick={retry} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A]"><RefreshCw className="h-4 w-4" />Try again</button></div> : availableCourses.length === 0 ? <div className="rounded-2xl border border-dashed border-[#D9CEBE] bg-white px-5 py-12 text-center text-sm text-[#765F55]">You have enrolled in every published course. Check your course library to continue learning.</div> : <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">{availableCourses.map((course) => <CourseCard key={course.id} {...course} />)}</div>}
      </section>
    </div>
  )
}

export default StudentExplore
