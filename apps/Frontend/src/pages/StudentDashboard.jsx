import { useEffect, useState } from "react"
import { ArrowRight, BookOpenCheck, ClipboardCheck } from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { fetchMyEnrollments } from "../services/enrollmentService"

function StudentDashboard() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMyEnrollments().then(setEnrollments).catch(() => setEnrollments([])).finally(() => setLoading(false))
  }, [])

  const activeEnrollment = enrollments.find((item) => item.progress?.lastOpenedLesson) || enrollments[0]
  const course = activeEnrollment?.course
  const progress = activeEnrollment?.progress

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Your learning space</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Good to see you, {user?.name?.split(" ")[0] || "student"}.</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#765F55] sm:text-base">Pick up where you left off, or make time for a little Thai practice.</p>

      <section className="mt-8 overflow-hidden rounded-[1.75rem] bg-[#2D2E30] p-6 text-white shadow-[0_24px_55px_-35px_rgba(45,46,48,0.7)] sm:p-8">
        {loading ? <p className="text-sm text-white/70">Preparing your learning space…</p> : course ? <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F8C56A]">Continue learning</p><h2 className="mt-3 text-2xl font-bold sm:text-3xl">{course.title}</h2><p className="mt-3 text-sm text-white/70">{progress?.percentage || 0}% complete · {progress?.completedLessons || 0} lessons finished</p></div><Link to={`/app/learn/${course.id}`} className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]">Resume course <ArrowRight className="h-4 w-4" /></Link></div> : <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F8C56A]">Start your journey</p><h2 className="mt-3 text-2xl font-bold">Your course library is ready when you are.</h2></div><Link to="/courses" className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30]">Browse courses <ArrowRight className="h-4 w-4" /></Link></div>}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link to="/app/courses" className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#E58C1A]/35 hover:shadow-lg"><BookOpenCheck className="h-6 w-6 text-[#C97112]" /><h2 className="mt-4 text-lg font-bold">My courses</h2><p className="mt-1 text-sm text-[#765F55]">{loading ? "Loading your library…" : `${enrollments.length} course${enrollments.length === 1 ? "" : "s"} available`}</p></Link>
        <Link to="/app/practice" className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#E58C1A]/35 hover:shadow-lg"><ClipboardCheck className="h-6 w-6 text-[#C97112]" /><h2 className="mt-4 text-lg font-bold">Quick practice</h2><p className="mt-1 text-sm text-[#765F55]">Review Thai sounds and vocabulary at your pace.</p></Link>
      </section>
    </div>
  )
}

export default StudentDashboard
