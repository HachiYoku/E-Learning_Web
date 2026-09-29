import { useCallback, useEffect, useState } from "react"
import { ArrowRight, BookOpenCheck, CheckCircle2, ClipboardCheck, RefreshCw } from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { fetchMyEnrollments } from "../services/enrollmentService"
import { fetchPersonalReviewSummary } from "../services/flashcardReviewService"
import { learningCoursePath } from "../utils/learningNavigation"

function StudentDashboard() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [enrollmentError, setEnrollmentError] = useState("")
  const [reviewStatus, setReviewStatus] = useState({ loading: true, dueCount: 0, error: "" })

  const loadEnrollments = useCallback(async () => {
    setLoading(true)
    setEnrollmentError("")
    try {
      setEnrollments(await fetchMyEnrollments())
    } catch (error) {
      setEnrollments([])
      setEnrollmentError(error.message || "Couldn't load your learning progress.")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(loadEnrollments, 0)
    return () => window.clearTimeout(timer)
  }, [loadEnrollments])

  const loadReviewStatus = useCallback(async () => {
    setReviewStatus((status) => ({ ...status, loading: true, error: "" }))
    try {
      const summary = await fetchPersonalReviewSummary()
      setReviewStatus({ loading: false, dueCount: Number(summary?.dueCount) || 0, error: "" })
    } catch (error) {
      setReviewStatus((status) => ({ ...status, loading: false, error: error.message || "Couldn't load your flashcard review status." }))
    }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(loadReviewStatus, 0)
    return () => window.clearTimeout(timer)
  }, [loadReviewStatus])

  // The API returns newest enrollments first, but the dashboard should resume
  // the course the learner actually studied most recently.
  const activeEnrollment = [...enrollments]
    .filter((item) => item.progress?.lastOpenedLesson && item.progress?.lastOpenedAt)
    .sort((first, second) => new Date(second.progress.lastOpenedAt) - new Date(first.progress.lastOpenedAt))[0]
    || enrollments.find((item) => item.progress?.lastOpenedLesson)
    || enrollments[0]
  const course = activeEnrollment?.course
  const progress = activeEnrollment?.progress
  const lastLesson = progress?.lastOpenedLesson
  const coursePath = course ? learningCoursePath(course.id, lastLesson?.id) : "/app/courses"
  const isCourseComplete = progress?.percentage === 100

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Your learning space</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Good to see you, {user?.name?.split(" ")[0] || "student"}.</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#765F55] sm:text-base">Pick up where you left off, or make time for a little Thai practice.</p>

      <section className="mt-8 overflow-hidden rounded-[1.75rem] bg-[#2D2E30] p-6 text-white shadow-[0_24px_55px_-35px_rgba(45,46,48,0.7)] sm:p-8">
        {loading ? <DashboardSkeleton /> : enrollmentError ? <EnrollmentError error={enrollmentError} retry={loadEnrollments} /> : course ? <ContinueLearning course={course} progress={progress} lastLesson={lastLesson} coursePath={coursePath} isCourseComplete={isCourseComplete} /> : <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F8C56A]">Start your journey</p><h2 className="mt-3 text-2xl font-bold">Your course library is ready when you are.</h2></div><Link to="/courses" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30]">Browse courses <ArrowRight className="h-4 w-4" /></Link></div>}
      </section>

      <ReviewStatus status={reviewStatus} retry={loadReviewStatus} />

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link to="/app/courses" className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#E58C1A]/35 hover:shadow-lg"><BookOpenCheck className="h-6 w-6 text-[#C97112]" /><h2 className="mt-4 text-lg font-bold">My courses</h2><p className="mt-1 text-sm text-[#765F55]">{loading ? "Loading your library…" : `${enrollments.length} course${enrollments.length === 1 ? "" : "s"} available`}</p></Link>
        <Link to="/app/practice" className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#E58C1A]/35 hover:shadow-lg"><ClipboardCheck className="h-6 w-6 text-[#C97112]" /><h2 className="mt-4 text-lg font-bold">Quick practice</h2><p className="mt-1 text-sm text-[#765F55]">Review Thai sounds and vocabulary at your pace.</p></Link>
      </section>
    </div>
  )
}

function DashboardSkeleton() { return <div aria-busy="true" aria-label="Loading learning progress" className="min-h-36 animate-pulse"><div className="h-3 w-32 rounded bg-white/15" /><div className="mt-4 h-8 w-2/3 rounded bg-white/15" /><div className="mt-4 h-4 w-48 rounded bg-white/10" /><div className="mt-5 h-2 w-full rounded bg-white/10" /></div> }
function EnrollmentError({ error, retry }) { return <div className="min-h-36"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F8C56A]">Learning progress</p><p role="alert" className="mt-3 text-sm text-white/80">{error}</p><button type="button" onClick={retry} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20"><RefreshCw className="h-4 w-4" />Retry</button></div> }
function ContinueLearning({ course, progress, lastLesson, coursePath, isCourseComplete }) { const percentage = progress?.percentage || 0; const completedLessons = progress?.completedLessons || 0; const totalLessons = progress?.totalLessons || 0; return <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F8C56A]">{isCourseComplete ? "Course completed" : "Continue learning"}</p><h2 className="mt-3 break-words text-2xl font-bold sm:text-3xl">{course.title}</h2>{lastLesson ? <p className="mt-3 text-sm font-bold text-[#F8C56A]">Lesson {lastLesson.order} · {lastLesson.title}</p> : <p className="mt-3 text-sm text-white/70">Start with your first lesson.</p>}<div className="mt-4 max-w-xl"><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"><span className="font-bold text-white">{percentage}% complete</span><span className="text-white/70">{completedLessons} of {totalLessons} lessons</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><div className="h-full rounded-full bg-[#F8C56A] transition-all motion-reduce:transition-none" style={{ width: `${percentage}%` }} /></div></div></div><Link to={coursePath} className="inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]">{isCourseComplete ? "Review Course" : lastLesson ? "Continue Learning" : "Start learning"} <ArrowRight className="h-4 w-4" /></Link></div> }
function ReviewStatus({ status, retry }) { if (status.loading) return <section aria-busy="true" aria-label="Loading flashcard review status" className="mt-5 min-h-32 animate-pulse rounded-2xl border border-[#2D2E30]/10 bg-white p-5"><div className="h-3 w-28 rounded bg-[#F2EFEB]" /><div className="mt-4 h-6 w-48 rounded bg-[#F2EFEB]" /><div className="mt-4 h-11 w-32 rounded-xl bg-[#F2EFEB]" /></section>; if (status.error) return <section className="mt-5 min-h-32 rounded-2xl border border-red-100 bg-white p-5"><p className="text-sm font-bold text-[#2D2E30]">Flashcard Review</p><p role="alert" className="mt-1 text-sm text-[#765F55]">{status.error}</p><button type="button" onClick={retry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#2D2E30]/15 px-4 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA]"><RefreshCw className="h-4 w-4" />Retry</button></section>; if (!status.dueCount) return <section className="mt-5 min-h-32 rounded-2xl border border-[#4D927F]/20 bg-[#EDF8F3] p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#397A69]"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-sm font-bold text-[#2D2E30]">Flashcards</p><h2 className="mt-1 text-lg font-bold text-[#2D2E30]">You&apos;re all caught up</h2><p className="mt-1 text-sm leading-6 text-[#765F55]">No flashcards are ready for review right now.</p></div></div></section>; return <section className="mt-5 rounded-2xl border border-[#E58C1A]/25 bg-[#FFF9EA] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-[#2D2E30]">Flashcard Review</p><p className="mt-1 text-sm text-[#765F55]">{status.dueCount} {status.dueCount === 1 ? "flashcard ready" : "flashcards ready"} to review</p></div><Link to="/app/practice/flashcards/review" className="inline-flex min-h-11 w-fit shrink-0 items-center justify-center rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm font-bold text-[#2D2E30] transition hover:border-[#E58C1A]/40 hover:bg-[#FFF4D8]">Start Review</Link></div></section> }

export default StudentDashboard
