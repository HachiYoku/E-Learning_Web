import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleCheck, ClipboardCheck, Play, X } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'
import { fetchCourseById } from '../services/courseService'
import { fetchLessonsByCourse } from '../services/lessonService'
import { fetchCourseQuizzes } from '../services/quizService'
import { fetchEnrollmentProgress, saveLastOpenedLesson, setLessonCompleted } from '../services/enrollmentService'

function getEmbedUrl(src) {
  if (!src) return ''
  try {
    const url = new URL(src)
    if (url.hostname.includes('youtu.be')) {
      const params = new URLSearchParams(url.search)
      params.set('autoplay', '1')
      return `https://www.youtube.com/embed/${url.pathname.replace('/', '')}?${params.toString()}`
    }
    if (url.hostname.includes('youtube.com')) {
      const videoId = url.searchParams.get('v')
      if (videoId) {
        const params = new URLSearchParams(url.search)
        params.delete('v')
        params.set('autoplay', '1')
        return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
      }
    }
    if (url.hostname.includes('drive.google.com')) {
      const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id')
      if (fileId) return `https://drive.google.com/file/d/${fileId}/preview?embedded=true`
    }
  } catch { return '' }
  return src
}

function CourseLessons() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [lessons, setLessons] = useState([])
  const [courseQuizzes, setCourseQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeLesson, setActiveLesson] = useState(null)
  const [progress, setProgress] = useState(null)
  const activeVideoUrl = useMemo(() => getEmbedUrl(activeLesson?.videoUrl), [activeLesson])

  useEffect(() => {
    async function loadCourseLessons() {
      try {
        setLoading(true); setError('')
        const [courseResponse, lessonsResponse, quizzesResponse, progressResponse] = await Promise.all([fetchCourseById(courseId), fetchLessonsByCourse(courseId), fetchCourseQuizzes(courseId), fetchEnrollmentProgress(courseId)])
        setCourse(courseResponse); setLessons(lessonsResponse); setCourseQuizzes(quizzesResponse); setProgress(progressResponse)
      } catch (loadError) { setError(loadError.message) } finally { setLoading(false) }
    }
    loadCourseLessons()
  }, [courseId])

  const handleOpenLesson = (lesson) => {
    if (!lesson.videoUrl) return
    setActiveLesson(lesson)
    saveLastOpenedLesson(courseId, lesson.id).then(setProgress).catch(() => {})
  }

  const handleCompletionToggle = async (lesson) => {
    const isCompleted = progress?.completedLessonIds?.includes(lesson.id)
    try { setProgress(await setLessonCompleted(courseId, lesson.id, !isCompleted)) } catch (progressError) { setError(progressError.message) }
  }

  if (loading) return <div className="min-h-screen bg-[#FFFDF8]"><Navbar /><div className="flex h-screen items-center justify-center bg-[#FFF9EA]"><LoadingSpinner message="Loading lessons..." /></div></div>
  if (!course) return <div className="min-h-screen bg-[#FFFDF8]"><Navbar /><div className="flex h-screen items-center justify-center bg-[#FFF9EA] px-4 text-center"><p className="text-lg text-[#765F55] sm:text-2xl">{error || 'Course not found'}</p></div></div>

  const courseFeatures = course.features?.length ? course.features : ['Clear, step-by-step lessons', 'Real examples and guided practice', 'Learn at your own pace']
  const completedLessons = progress?.completedLessons || 0
  const totalLessons = progress?.totalLessons || lessons.length
  const percentage = progress?.percentage || 0

  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF8]">
      <Navbar />
      <div className="bg-[#FFF9EA] px-4 pt-6 sm:px-6 sm:pt-8 md:px-10"><div className="mx-auto max-w-7xl"><button onClick={() => navigate('/my-courses')} className="inline-flex items-center gap-2 text-sm font-bold text-[#765F55] transition hover:text-[#C97112]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to my courses</button></div></div>

      <main className="flex-1 bg-[#FFF9EA] px-4 pb-14 pt-8 sm:px-6 sm:pb-16 md:px-10 md:pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10 md:mb-12"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Your classroom</p><h1 className="mt-3 text-[clamp(1.85rem,5vw,3rem)] font-bold leading-[1.1] tracking-tight text-[#2D2E30]">Keep learning, <span className="font-serif font-normal italic text-[#B96128]">one lesson at a time.</span></h1></div>
          {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="grid grid-cols-1 items-start gap-6 md:gap-8 lg:grid-cols-5">
            <aside className="lg:col-span-2">
              <div className="overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-4 shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] sm:p-6 lg:sticky lg:top-20">
              <div className="h-48 overflow-hidden rounded-[1.3rem] bg-[#E7DCCE] sm:h-56 md:h-64">{course.image ? <img src={course.image} alt={course.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-[#765F55]">No image</div>}</div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#C97112]">Your course</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30]">{course.title}</h2><p className="mt-3 text-sm leading-relaxed text-[#765F55]">{course.description}</p>
              <div className="mt-5 border-y border-[#2D2E30]/10 py-4">
                <div className="flex items-center justify-between text-xs font-bold text-[#765F55]">
                  <span className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF4D8] text-[#C97112]"><BookOpen className="h-4 w-4" aria-hidden="true" /></span>{completedLessons} of {totalLessons} lessons</span>
                  <span className="text-[#C97112]">{percentage}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F0E7DC]"><div className="h-full rounded-full bg-[#E58C1A] transition-all duration-300" style={{ width: `${percentage}%` }} /></div>
              </div>
              <div className="mt-5"><h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#765F55]">What you’ll learn</h3><ul className="mt-3 space-y-2">{courseFeatures.map((feature) => <li key={feature} className="flex gap-2 text-xs leading-relaxed text-[#765F55]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E58C1A]" aria-hidden="true" />{feature}</li>)}</ul></div>
              </div>
            </aside>

            <section className="rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-5 shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] sm:p-7 md:p-8 lg:col-span-3">
              <div className="flex flex-col justify-between gap-3 border-b border-[#2D2E30]/10 pb-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Course content</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl">Your lessons</h2></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#FFF4D8] px-3 py-2 text-xs font-bold text-[#9A5816]"><CircleCheck className="h-4 w-4" aria-hidden="true" />{completedLessons} complete</span></div>

              {lessons.length === 0 ? <div className="py-12 text-center text-sm text-[#765F55]">No lessons are available in this course yet.</div> : <div className="mt-6 space-y-3">{lessons.map((lesson) => {
                const isCompleted = progress?.completedLessonIds?.includes(lesson.id)
                return <article key={lesson.id} className={`rounded-2xl border p-3 transition sm:p-4 ${isCompleted ? 'border-[#7EAF85]/30 bg-[#F5FAF5]' : 'border-[#2D2E30]/10 bg-[#FFFDF8] hover:border-[#E58C1A]/40 hover:bg-[#FFF9EA]'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><button type="button" onClick={() => handleOpenLesson(lesson)} className="group flex min-w-0 flex-1 items-center gap-3 text-left"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${isCompleted ? 'bg-[#E9F4EA] text-[#4D7C57]' : 'bg-[#FFF4D8] text-[#C97112]'}`}>{isCompleted ? <Check className="h-5 w-5" aria-hidden="true" /> : lesson.order}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#2D2E30] sm:text-base">{lesson.title}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-[#765F55]"><Play className="h-3 w-3 fill-current text-[#E58C1A]" aria-hidden="true" />Watch lesson</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#9A8775] transition group-hover:translate-x-0.5 group-hover:text-[#C97112]" aria-hidden="true" /></button><div className="flex gap-2 sm:shrink-0"><button type="button" onClick={() => navigate(`/course-lessons/${courseId}/quiz/${lesson.id}`)} className="rounded-xl border border-[#E58C1A]/25 bg-white px-3 py-2 text-xs font-bold text-[#9A5816] transition hover:bg-[#FFF4D8]">Quiz</button><button type="button" onClick={() => handleCompletionToggle(lesson)} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${isCompleted ? 'bg-[#E9F4EA] text-[#4D7C57] hover:bg-[#DCEEDD]' : 'bg-[#2D2E30] text-white hover:bg-[#E58C1A]'}`}>{isCompleted ? 'Completed' : 'Mark complete'}</button></div></div></article>
              })}</div>}

              {courseQuizzes.length > 0 ? <div className="mt-8 border-t border-[#2D2E30]/10 pt-7"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[#C97112]" aria-hidden="true" /><h3 className="text-lg font-bold text-[#2D2E30]">Course quizzes</h3></div><div className="mt-4 space-y-3">{courseQuizzes.map((quiz) => { const quizId = quiz.id || quiz._id; const isClosed = Boolean(quiz.maxAttempts) && (quiz.attemptsUsed ?? 0) >= quiz.maxAttempts; return <div key={quizId} className="flex flex-col gap-3 rounded-2xl border border-[#2D2E30]/10 bg-[#FFF9EA] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-[#2D2E30]">{quiz.title}</p><p className="mt-1 text-xs text-[#765F55]">{quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} · Course quiz</p></div><button type="button" onClick={() => navigate(`/course-quiz/${courseId}/${quizId}`)} disabled={isClosed} className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${isClosed ? 'cursor-not-allowed bg-[#DED8CF] text-[#765F55]' : 'bg-[#F8C56A] text-[#2D2E30] hover:bg-[#E58C1A]'}`}>{isClosed ? 'Closed' : 'Take quiz'}</button></div> })}</div></div> : null}
            </section>
          </div>
        </div>
      </main>

      {activeLesson ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6" onClick={() => setActiveLesson(null)}><div className="relative w-full max-w-4xl overflow-hidden rounded-[1.75rem] bg-[#2D2E30] shadow-2xl" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setActiveLesson(null)} className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#2D2E30] transition hover:bg-[#FFF4D8]" aria-label="Close video"><X className="h-5 w-5" /></button><div className="aspect-video w-full"><iframe src={activeVideoUrl || activeLesson.videoUrl} title={activeLesson.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-bold text-white">{activeLesson.title}</p><button type="button" onClick={() => navigate(`/course-lessons/${courseId}/quiz/${activeLesson.id}`)} className="rounded-xl bg-[#F8C56A] px-4 py-2.5 text-xs font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]">Take lesson quiz</button></div></div></div> : null}
      <Footer />
    </div>
  )
}

export default CourseLessons
