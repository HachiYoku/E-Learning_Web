import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleCheck, ClipboardCheck, Play, Plus, X } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'
import { fetchCourseById } from '../services/courseService'
import { fetchLessonsByCourse } from '../services/lessonService'
import { fetchCourseQuizzes } from '../services/quizService'
import { fetchEnrollmentProgress, saveLastOpenedLesson, setLessonCompleted } from '../services/enrollmentService'
import SaveFlashcardModal from '../components/SaveFlashcardModal'
import LessonKeyVocabulary from '../components/LessonKeyVocabulary'
import { deletePersonalFlashcard } from '../services/personalFlashcardService'

const VOCABULARY_UNDO_WINDOW_MS = 5000

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
  } catch { return '' }
  return src
}

function isGoogleDriveUrl(src) {
  try { return new URL(src).hostname === 'drive.google.com' } catch { return false }
}

function CourseLessons() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [course, setCourse] = useState(null)
  const [lessons, setLessons] = useState([])
  const [courseQuizzes, setCourseQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeLesson, setActiveLesson] = useState(null)
  const [isSaveFlashcardOpen, setIsSaveFlashcardOpen] = useState(false)
  const [flashcardInitialValues, setFlashcardInitialValues] = useState(null)
  const [activeVocabularyForSave, setActiveVocabularyForSave] = useState(null)
  const [savedVocabulary, setSavedVocabulary] = useState({})
  const [savedFlashcardMessage, setSavedFlashcardMessage] = useState('')
  const [progress, setProgress] = useState(null)
  const [completionPendingLessonId, setCompletionPendingLessonId] = useState(null)
  const consumedResumeIntent = useRef(null)
  const isMounted = useRef(true)
  const activeVideoUrl = useMemo(() => getEmbedUrl(activeLesson?.videoUrl), [activeLesson])
  const activeVideoIsGoogleDrive = useMemo(() => isGoogleDriveUrl(activeLesson?.videoUrl), [activeLesson])
  const requestedLessonId = useMemo(() => new URLSearchParams(location.search).get('lesson'), [location.search])

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    const timers = Object.entries(savedVocabulary)
      .filter(([, state]) => state.undoExpiresAt)
      .map(([vocabularyId, state]) => window.setTimeout(() => {
        setSavedVocabulary((current) => {
          if (current[vocabularyId]?.undoExpiresAt !== state.undoExpiresAt) return current
          return { ...current, [vocabularyId]: { ...current[vocabularyId], undoExpiresAt: null } }
        })
      }, Math.max(0, state.undoExpiresAt - Date.now())))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [savedVocabulary])

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

  const handleOpenLesson = useCallback((lesson) => {
    if (!lesson.videoUrl) return
    setActiveLesson(lesson)
    setSavedFlashcardMessage('')
    setSavedVocabulary({})
    saveLastOpenedLesson(courseId, lesson.id).then(setProgress).catch(() => {})
  }, [courseId])

  useEffect(() => {
    if (loading || !requestedLessonId) return

    const intentKey = `${location.key}:${requestedLessonId}`
    if (consumedResumeIntent.current === intentKey) return
    consumedResumeIntent.current = intentKey

    const nextSearchParams = new URLSearchParams(location.search)
    nextSearchParams.delete('lesson')
    const nextSearch = nextSearchParams.toString()
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '', hash: location.hash }, { replace: true })

    const requestedLesson = lessons.find((lesson) => String(lesson.id) === requestedLessonId)
    if (requestedLesson) {
      window.setTimeout(() => {
        if (isMounted.current) handleOpenLesson(requestedLesson)
      }, 0)
    }
  }, [handleOpenLesson, lessons, loading, location.hash, location.key, location.pathname, location.search, navigate, requestedLessonId])

  const handleCompletionToggle = async (lesson) => {
    if (completionPendingLessonId) return
    const isCompleted = progress?.completedLessonIds?.includes(lesson.id)
    setCompletionPendingLessonId(lesson.id)
    try { setProgress(await setLessonCompleted(courseId, lesson.id, !isCompleted)) } catch (progressError) { setError(progressError.message) } finally { setCompletionPendingLessonId(null) }
  }

  const openManualFlashcardComposer = () => {
    setFlashcardInitialValues(null)
    setActiveVocabularyForSave(null)
    setIsSaveFlashcardOpen(true)
  }

  const openVocabularyFlashcardComposer = (vocabulary, vocabularyId) => {
    setFlashcardInitialValues({
      front: vocabulary.thai || '',
      back: vocabulary.translation || '',
    })
    setActiveVocabularyForSave({ vocabularyId: vocabularyId || vocabulary._id })
    setIsSaveFlashcardOpen(true)
  }

  const handleVocabularyCardSaved = (deck, card) => {
    if (!activeVocabularyForSave?.vocabularyId || !deck?._id || !card?._id) return
    const vocabularyId = activeVocabularyForSave.vocabularyId
    setSavedVocabulary((current) => ({
      ...current,
      [vocabularyId]: { deckId: deck._id, cardId: card._id, undoExpiresAt: Date.now() + VOCABULARY_UNDO_WINDOW_MS, isUndoing: false, undoError: '' },
    }))
  }

  const handleUndoVocabularySave = async (vocabularyId) => {
    const saveState = savedVocabulary[vocabularyId]
    if (!saveState || saveState.isUndoing) return
    setSavedVocabulary((current) => ({ ...current, [vocabularyId]: { ...current[vocabularyId], isUndoing: true, undoError: '' } }))
    try {
      await deletePersonalFlashcard(saveState.deckId, saveState.cardId)
      setSavedFlashcardMessage('')
      setSavedVocabulary((current) => {
        const next = { ...current }
        delete next[vocabularyId]
        return next
      })
    } catch {
      setSavedVocabulary((current) => ({ ...current, [vocabularyId]: { ...current[vocabularyId], isUndoing: false, undoError: 'Could not undo this saved flashcard. Please try again.' } }))
    }
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
      <div className="bg-[#FFF9EA] px-4 pt-6 sm:px-6 sm:pt-8 md:px-10"><div className="mx-auto max-w-7xl"><button onClick={() => navigate('/app/courses')} className="inline-flex items-center gap-2 text-sm font-bold text-[#765F55] transition hover:text-[#C97112]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to my courses</button></div></div>

      <main className="flex-1 bg-[#FFF9EA] px-4 pb-14 pt-8 sm:px-6 sm:pb-16 md:px-10 md:pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10 md:mb-12"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Your classroom</p><h1 className="mt-3 text-[clamp(1.85rem,5vw,3rem)] font-bold leading-[1.1] tracking-tight text-[#2D2E30]">Keep learning, <span className="text-[#B96128]">one lesson at a time.</span></h1></div>
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
                return <article key={lesson.id} className={`rounded-2xl border p-3 transition sm:p-4 ${isCompleted ? 'border-[#7EAF85]/30 bg-[#F5FAF5]' : 'border-[#2D2E30]/10 bg-[#FFFDF8] hover:border-[#E58C1A]/40 hover:bg-[#FFF9EA]'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><button type="button" onClick={() => handleOpenLesson(lesson)} className="group flex min-w-0 flex-1 items-center gap-3 text-left"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${isCompleted ? 'bg-[#E9F4EA] text-[#4D7C57]' : 'bg-[#FFF4D8] text-[#C97112]'}`}>{isCompleted ? <Check className="h-5 w-5" aria-hidden="true" /> : lesson.order}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#2D2E30] sm:text-base">{lesson.title}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-[#765F55]"><Play className="h-3 w-3 fill-current text-[#E58C1A]" aria-hidden="true" />Watch lesson</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#9A8775] transition group-hover:translate-x-0.5 group-hover:text-[#C97112]" aria-hidden="true" /></button><div className="flex gap-2 sm:shrink-0"><button type="button" onClick={() => navigate(`/app/learn/${courseId}/quiz/${lesson.id}`)} className="rounded-xl border border-[#E58C1A]/25 bg-white px-3 py-2 text-xs font-bold text-[#9A5816] transition hover:bg-[#FFF4D8]">Quiz</button><button type="button" disabled={completionPendingLessonId === lesson.id} onClick={() => handleCompletionToggle(lesson)} className={`rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${isCompleted ? 'bg-[#E9F4EA] text-[#4D7C57] hover:bg-[#DCEEDD]' : 'bg-[#2D2E30] text-white hover:bg-[#E58C1A]'}`}>{completionPendingLessonId === lesson.id ? 'Saving...' : isCompleted ? 'Completed' : 'Mark complete'}</button></div></div></article>
              })}</div>}

              {courseQuizzes.length > 0 ? <div className="mt-8 border-t border-[#2D2E30]/10 pt-7"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[#C97112]" aria-hidden="true" /><h3 className="text-lg font-bold text-[#2D2E30]">Course quizzes</h3></div><div className="mt-4 space-y-3">{courseQuizzes.map((quiz) => { const quizId = quiz.id || quiz._id; const isClosed = Boolean(quiz.maxAttempts) && (quiz.attemptsUsed ?? 0) >= quiz.maxAttempts; return <div key={quizId} className="flex flex-col gap-3 rounded-2xl border border-[#2D2E30]/10 bg-[#FFF9EA] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-[#2D2E30]">{quiz.title}</p><p className="mt-1 text-xs text-[#765F55]">{quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} · Course quiz</p></div><button type="button" onClick={() => navigate(`/course-quiz/${courseId}/${quizId}`)} className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${isClosed ? 'bg-[#2D2E30] text-white hover:bg-[#E58C1A]' : 'bg-[#F8C56A] text-[#2D2E30] hover:bg-[#E58C1A]'}`}>{isClosed ? 'View last answer' : 'Take quiz'}</button></div> })}</div></div> : null}
            </section>
          </div>
        </div>
      </main>

      {activeLesson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6" onClick={() => setActiveLesson(null)}>
          <div className={`relative w-full max-w-4xl rounded-[1.75rem] bg-[#2D2E30] shadow-2xl ${Array.isArray(activeLesson.keyVocabulary) && activeLesson.keyVocabulary.length > 0 ? 'flex h-[calc(100dvh-3rem)] flex-col overflow-hidden' : 'overflow-hidden'}`} onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setActiveLesson(null)} className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#2D2E30] transition hover:bg-[#FFF4D8]" aria-label="Close video"><X className="h-5 w-5" /></button>
            {activeVideoIsGoogleDrive ? (
              <div className={`flex aspect-video flex-col items-center justify-center bg-[#FFF9EA] px-6 text-center ${activeLesson.keyVocabulary?.length ? 'h-[min(48vw,38vh)] shrink-0 overflow-y-auto' : ''}`}>
                <p className="text-lg font-bold text-[#2D2E30]">Open this Google Drive lesson</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#765F55]">Google blocks sign-in pages from being embedded. Open the lesson directly in Google Drive to watch it securely.</p>
                <a href={activeLesson.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-6 rounded-xl bg-[#E58C1A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#C97112]">Open in Google Drive</a>
              </div>
            ) : (
              <div className={`aspect-video w-full shrink-0 ${activeLesson.keyVocabulary?.length ? 'h-[min(48vw,38vh)]' : ''}`}><iframe src={activeVideoUrl || activeLesson.videoUrl} title={activeLesson.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
            )}
            <LessonKeyVocabulary vocabulary={activeLesson.keyVocabulary} onSave={openVocabularyFlashcardComposer} savedVocabulary={savedVocabulary} onUndo={handleUndoVocabularySave} />
            <div className="shrink-0 border-t border-white/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-bold text-white">{activeLesson.title}</p>{savedFlashcardMessage ? <p role="status" className="mt-1 text-xs font-bold text-[#BDE8C1]">{savedFlashcardMessage}</p> : null}</div>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={openManualFlashcardComposer} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"><Plus size={16} />Add to My Flashcards</button><button type="button" onClick={() => navigate(`/app/learn/${courseId}/quiz/${activeLesson.id}`)} className="min-h-11 rounded-xl bg-[#F8C56A] px-4 py-2.5 text-xs font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]">Take lesson quiz</button>{progress?.completedLessonIds?.includes(activeLesson.id) ? <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#BDE8C1]/30 bg-[#246B35] px-4 py-2.5 text-xs font-bold text-white"><Check size={16} aria-hidden="true" />Completed</span> : <button type="button" disabled={completionPendingLessonId === activeLesson.id} onClick={() => handleCompletionToggle(activeLesson)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#246B35] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#397A69] disabled:cursor-not-allowed disabled:opacity-60">{completionPendingLessonId === activeLesson.id ? 'Saving...' : <><Check size={16} aria-hidden="true" />Mark Complete</>}</button>}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <SaveFlashcardModal isOpen={isSaveFlashcardOpen} initialFront={flashcardInitialValues?.front} initialBack={flashcardInitialValues?.back} onClose={() => setIsSaveFlashcardOpen(false)} onSaved={(deck) => { setSavedFlashcardMessage(`✓ Saved to ${deck.name}`); setIsSaveFlashcardOpen(false) }} onCardSaved={handleVocabularyCardSaved} />
      <Footer />
    </div>
  )
}

export default CourseLessons
