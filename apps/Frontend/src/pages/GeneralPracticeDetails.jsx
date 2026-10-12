import { useEffect, useRef, useState } from "react"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import { fetchGeneralPracticeQuiz, startGeneralPracticeSession } from "../services/generalPracticeService"
import { generalPracticeErrorMessage } from "../utils/generalPracticeErrors"

function GeneralPracticeDetails() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  const startInFlight = useRef(false)
  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retryKey, setRetryKey] = useState(0)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState("")

  useEffect(() => {
    let active = true
    fetchGeneralPracticeQuiz(quizId)
      .then((item) => { if (active) setQuiz(item) })
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
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <Link to="/app/practice/general" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-[#A94F00] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />General Practice quizzes</Link>
      <div className="mt-5">
        {loading ? <LoadingSpinner message="Loading quiz details..." /> : error ? (
          <section role="alert" className="rounded-2xl border border-[#E58C1A]/20 bg-white p-6 sm:p-8">
            <h1 className="text-xl font-bold">Quiz unavailable</h1>
            <p className="mt-2 text-sm text-[#765F55]">{error}</p>
            {error !== "This quiz is no longer available." ? <button type="button" onClick={retry} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#A94F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button> : null}
          </section>
        ) : quiz ? (
          <article className="rounded-3xl border border-[#E58C1A]/20 bg-white p-6 shadow-sm sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A94F00]">General Practice</p>
            <h1 className="mt-3 break-words text-3xl font-bold tracking-tight sm:text-4xl">{quiz.title}</h1>
            <p className="mt-4 break-words text-sm leading-relaxed text-[#765F55] sm:text-base">{quiz.description || "A short Thai practice quiz."}</p>
            <dl className="mt-7 grid gap-3 border-t border-[#2D2E30]/10 pt-6 sm:grid-cols-3">
              {quiz.category ? <div><dt className="text-xs font-bold uppercase tracking-wider text-[#765F55]">Category</dt><dd className="mt-1 text-sm font-semibold">{quiz.category}</dd></div> : null}
              {quiz.difficulty ? <div><dt className="text-xs font-bold uppercase tracking-wider text-[#765F55]">Difficulty</dt><dd className="mt-1 text-sm font-semibold">{quiz.difficulty}</dd></div> : null}
              <div><dt className="text-xs font-bold uppercase tracking-wider text-[#765F55]">Access</dt><dd className="mt-1 text-sm font-semibold">{quiz.standaloneAccess === "students" ? "Students Only" : "Public quiz"}</dd></div>
            </dl>
            <div className="mt-8 rounded-2xl bg-[#FFF9EA] p-5">
              <button type="button" onClick={start} disabled={starting} className="min-h-11 rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#A94F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] disabled:cursor-wait disabled:opacity-60">{starting ? "Starting quiz..." : "Start / Resume Quiz"}</button>
              <p className="mt-3 text-sm text-[#765F55]">If you resume an unfinished quiz, your previous unsubmitted selections will not be restored.</p>
              {startError ? <p role="alert" className="mt-3 text-sm font-semibold text-[#A84646]">{startError}</p> : null}
              <Link to={`/app/practice/general/${encodeURIComponent(quizId)}/history`} className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-[#A94F00] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">View your attempt history</Link>
            </div>
          </article>
        ) : <p role="status" className="rounded-2xl bg-white p-6 text-sm text-[#765F55]">Quiz details are unavailable.</p>}
      </div>
    </div>
  )
}

export default GeneralPracticeDetails
