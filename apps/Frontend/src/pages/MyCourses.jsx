import { useEffect, useState } from 'react'
import { BookOpenCheck } from 'lucide-react'
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
    <div className="flex min-h-screen flex-col bg-[#FFFDF8]">
      <Navbar />

      <div className="hidden bg-[#FFF9EA] px-4 pb-12 pt-10 sm:px-6 sm:pb-14 sm:pt-12 md:block md:px-10 md:pb-16 md:pt-14">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Your learning space</p>
          <h1 className="mt-3 text-[clamp(2rem,6vw,3.3rem)] font-bold leading-[1.08] tracking-tight text-[#2D2E30]">
            Continue your <span className="font-serif font-normal italic text-[#B96128]">journey.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#765F55] sm:text-base">
            Everything you have unlocked, ready whenever you are.
          </p>
        </div>
      </div>

      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-12 md:px-10 md:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:mb-8 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">My library</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl">Your enrolled courses</h2>
            </div>
            {!loading && !error ? (
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#E58C1A]/20 bg-[#FFF4D8] px-3 py-2 text-xs font-bold text-[#9A5816]">
                <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                {enrollments.length} {enrollments.length === 1 ? 'course' : 'courses'} unlocked
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <LoadingSpinner message="Loading enrolled courses..." />
          ) : enrollments.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-[#D9CEBE] bg-[#FFF9EA] px-5 py-12 text-center sm:px-8 sm:py-16">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#C97112] shadow-sm"><BookOpenCheck className="h-6 w-6" aria-hidden="true" /></div>
              <h3 className="text-lg font-bold text-[#2D2E30]">Your library is waiting</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#765F55]">You do not have any approved courses yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
              {enrollments.map((enrollment) => (
                <MyCourseCard
                  key={enrollment.id}
                  id={enrollment.course?.id}
                  image={enrollment.course?.image}
                  title={enrollment.course?.title}
                  description={enrollment.course?.description}
                  progress={enrollment.progress}
                  buttonText={enrollment.progress?.lastOpenedLesson ? "Continue" : "Start learning"}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default MyCourses
