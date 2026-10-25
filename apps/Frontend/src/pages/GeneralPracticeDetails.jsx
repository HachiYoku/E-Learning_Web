import { useEffect, useRef, useState } from "react"
import { ArrowLeft, BookOpenText, History, LockKeyhole, Play, RefreshCw, ShieldCheck, Signal } from "lucide-react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import { fetchGeneralPracticeQuiz, fetchGeneralPracticeSet, startGeneralPracticeSession } from "../services/generalPracticeService"
import { generalPracticeErrorMessage } from "../utils/generalPracticeErrors"

function GeneralPracticeDetails() {
  const { quizId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const proposedSetId = new URLSearchParams(location.search).get("setId")
  const validSetId = proposedSetId && /^[0-9a-f]{24}$/i.test(proposedSetId) ? proposedSetId : null
  const startInFlight = useRef(false)
  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retryKey, setRetryKey] = useState(0)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState("")
  const [confirmedParent, setConfirmedParent] = useState(null)
  const parentSetId = confirmedParent?.quizId === quizId && confirmedParent?.setId === validSetId ? validSetId : null

  useEffect(() => {
    let active = true
    if (validSetId) {
      fetchGeneralPracticeSet(validSetId)
        .then((response) => {
          if (active && response?.set?.id === validSetId && response?.quizzes?.some((item) => item.id === quizId)) setConfirmedParent({ quizId, setId: validSetId })
        })
        .catch(() => {}) // A missing or inaccessible parent must not hide direct quiz details.
    }
    return () => { active = false }
  }, [quizId, validSetId])

  useEffect(() => {
    let active = true
    fetchGeneralPracticeQuiz(quizId)
      .then((item) => {
        if (!active) return
        setQuiz(item)
      })
      .catch((requestError) => {
        if (!active) return
        if (requestError.status === 404) setError("This quiz is no longer available.")
        else if (requestError.status === 401) setError("Your session has expired. Please sign in again.")
        else setError("We couldn't load this quiz. Please try again.")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [quizId, retryKey])

  const retry = () => {
    setError("")
    setLoading(true)
    setRetryKey((current) => current + 1)
  }

  const start = async () => {
    if (startInFlight.current || !quiz) return
    startInFlight.current = true
    setStarting(true)
    setStartError("")
    try {
      const session = await startGeneralPracticeSession(quizId)
      navigate(`/app/practice/general/${encodeURIComponent(quizId)}/take`, { state: { quizId, session } })
    } catch (requestError) {
      setStartError(generalPracticeErrorMessage(requestError))
    } finally {
      startInFlight.current = false
      setStarting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <Link to={parentSetId ? `/app/practice/general/sets/${encodeURIComponent(parentSetId)}` : "/app/practice/general"} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#C97112] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{parentSetId ? "Back to Quiz Set" : "Back to General Practice"}</Link>
      <div className="mt-3">
        {loading ? <LoadingSpinner message="Loading quiz details..." /> : error ? (
          <section role="alert" className="rounded-2xl border border-[#2D2E30]/10 bg-white p-6 sm:p-8">
            <h1 className="text-xl font-bold">Quiz unavailable</h1>
            <p className="mt-2 text-sm text-[#765F55]">{error}</p>
            {error !== "This quiz is no longer available." ? <button type="button" onClick={retry} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-5 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA] hover:text-[#A94F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button> : null}
          </section>
        ) : quiz ? (
          <article className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-accent">General Practice</p>
            <h1 className="mt-3 break-words text-3xl font-bold tracking-tight sm:text-4xl">{quiz.title}</h1>
            <p className="mt-3 break-words text-sm leading-relaxed text-[#765F55] sm:text-base">{quiz.description || "A short Thai practice quiz."}</p>
            <dl className="mt-5 grid gap-3 border-t border-[#2D2E30]/10 pt-5 sm:grid-cols-3">
              {quiz.category ? <div><dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#765F55]"><BookOpenText className="h-4 w-4" aria-hidden="true" />Category</dt><dd className="mt-1 flex min-h-9 items-center text-sm font-semibold">{quiz.category}</dd></div> : null}
              {quiz.difficulty ? <div><dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#765F55]"><Signal className="h-4 w-4" aria-hidden="true" />Difficulty</dt><dd className="mt-1 flex min-h-9 items-center text-sm font-semibold">{quiz.difficulty}</dd></div> : null}
              <div><dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#765F55]"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Access</dt><dd className="mt-1 flex min-h-9 items-center"><span className="inline-flex items-center gap-1.5 rounded-full border border-[#2D2E30]/15 bg-[#F6F3EE] px-2.5 py-1 text-sm font-semibold text-[#514A43]"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />Signed-in students</span></dd></div>
            </dl>
            <div className="mt-6 border-t border-[#2D2E30]/10 pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button type="button" onClick={start} disabled={starting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] disabled:cursor-wait disabled:opacity-60 sm:w-auto"><Play className="h-4 w-4" aria-hidden="true" />{starting ? "Starting quiz..." : "Start / Resume Quiz"}</button><Link to={`/app/practice/general/${encodeURIComponent(quizId)}/history`} state={{ quizTitle: quiz.title }} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-5 py-3 text-sm font-bold text-[#765F55] hover:bg-[#FFF9EA] hover:text-[#A94F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] sm:w-auto"><History className="h-4 w-4" aria-hidden="true" />Attempt history</Link></div>
                <p className="mt-3 text-sm text-[#765F55]">Unsubmitted selections will not be restored if you leave or resume.</p>
                {startError ? <p role="alert" className="mt-3 text-sm font-semibold text-[#A84646]">{startError}</p> : null}
            </div>
          </article>
        ) : <p role="status" className="rounded-2xl bg-white p-6 text-sm text-[#765F55]">Quiz details are unavailable.</p>}
      </div>
    </div>
  )
}

export default GeneralPracticeDetails
