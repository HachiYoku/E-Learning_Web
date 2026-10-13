import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Link, useLocation, useParams } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import { fetchGeneralPracticeHistory, fetchGeneralPracticeQuiz } from "../services/generalPracticeService"
import { generalPracticeErrorMessage } from "../utils/generalPracticeErrors"

function validPage(page) {
  return Array.isArray(page?.attempts)
    && (page.nextCursor === null || typeof page.nextCursor === "string")
}

function GeneralPracticeHistory() {
  const { quizId } = useParams()
  const location = useLocation()
  const [titleState, setTitleState] = useState({
    quizId, title: typeof location.state?.quizTitle === "string" ? location.state.quizTitle : "",
  })
  const quizTitle = titleState.quizId === quizId ? titleState.title : ""
  const [detailsState, setDetailsState] = useState({ quizId, missing: false })
  const detailsMissing = detailsState.quizId === quizId && detailsState.missing
  const [retryKey, setRetryKey] = useState(0)
  const requestKey = `${quizId}:${retryKey}`
  const [pageState, setPageState] = useState({ key: requestKey, status: "loading", attempts: [], nextCursor: null, error: "", loadError: "" })
  const currentState = pageState.key === requestKey ? pageState
    : { key: requestKey, status: "loading", attempts: [], nextCursor: null, error: "", loadError: "" }
  const loadInFlight = useRef(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let active = true
    fetchGeneralPracticeHistory(quizId)
      .then((page) => {
        if (!active) return
        if (!validPage(page)) throw new Error("Invalid history response")
        setPageState({ key: requestKey, status: "ready", attempts: page.attempts,
          nextCursor: page.nextCursor, error: "", loadError: "" })
      })
      .catch((requestError) => {
        if (active) setPageState({ key: requestKey, status: "error", attempts: [],
          nextCursor: null, error: generalPracticeErrorMessage(requestError), loadError: "" })
      })
    return () => { active = false }
  }, [quizId, requestKey])

  useEffect(() => {
    let active = true
    fetchGeneralPracticeQuiz(quizId).then((quiz) => {
      if (active && typeof quiz?.title === "string") setTitleState({ quizId, title: quiz.title })
      if (active) setDetailsState({ quizId, missing: false })
    }).catch((requestError) => {
      if (active && requestError?.status === 404) setDetailsState({ quizId, missing: true })
    })
    return () => { active = false }
  }, [quizId])

  const loadMore = async () => {
    if (loadInFlight.current || currentState.status !== "ready" || !currentState.nextCursor) return
    loadInFlight.current = true
    setLoadingMore(true)
    setPageState((current) => ({ ...current, loadError: "" }))
    try {
      const page = await fetchGeneralPracticeHistory(quizId, currentState.nextCursor)
      if (!validPage(page)) throw new Error("Invalid history response")
      setPageState((current) => {
        if (current.key !== requestKey) return current
        const seen = new Set(current.attempts.map((attempt) => attempt.attemptId))
        const additions = page.attempts.filter((attempt) => {
          if (!attempt?.attemptId || seen.has(attempt.attemptId)) return false
          seen.add(attempt.attemptId)
          return true
        })
        return { ...current, attempts: [...current.attempts, ...additions], nextCursor: page.nextCursor }
      })
    } catch (requestError) {
      setPageState((current) => current.key === requestKey
        ? { ...current, loadError: generalPracticeErrorMessage(requestError) } : current)
    } finally {
      loadInFlight.current = false
      setLoadingMore(false)
    }
  }

  const displayedTitle = quizTitle || currentState.attempts.find((attempt) => attempt.title)?.title || "Practice quiz"

  return <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
    <Link to={detailsMissing ? "/app/practice/general" : `/app/practice/general/${encodeURIComponent(quizId)}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#C97112] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{detailsMissing ? "Back to General Practice" : "Back to quiz details"}</Link>
    <header className="mt-3 rounded-2xl border border-[#2D2E30]/10 bg-white p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Attempt history</p>
      <h1 className="mt-2 break-words text-3xl font-bold">{displayedTitle}</h1>
      <p className="mt-2 text-sm text-[#765F55]">Only your saved attempts appear here. Select an attempt to review its original answers and result.</p>
    </header>
    {currentState.status === "loading" ? <div className="mt-6"><LoadingSpinner message="Loading your attempt history..." /></div> : currentState.status === "error" ? <section className="mt-6 rounded-2xl border border-[#2D2E30]/10 bg-white p-6"><p role="alert" className="text-sm text-[#A84646]">{currentState.error}</p><button type="button" onClick={() => setRetryKey((current) => current + 1)} className="mt-4 min-h-11 rounded-xl border border-[#2D2E30]/15 bg-white px-5 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA] hover:text-[#A94F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Try again</button></section> : currentState.attempts.length === 0 ? <p role="status" className="mt-6 rounded-2xl bg-white p-6 text-sm text-[#765F55]">No saved attempts yet.</p> : <>
      <ol className="mt-6 space-y-3">{currentState.attempts.map((attempt) => <li key={attempt.attemptId} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#2D2E30]/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent">Attempt {attempt.attemptNumber}</p>
          <p className="mt-2 text-sm text-[#765F55]">Score: {attempt.score} of {attempt.total}{Number.isFinite(attempt.percentage) ? ` · ${Math.round(attempt.percentage)}%` : ""}</p>
          {attempt.completedAt && !Number.isNaN(Date.parse(attempt.completedAt)) ? <p className="mt-1 text-sm text-[#765F55]">Completed {new Date(attempt.completedAt).toLocaleString()}</p> : null}</div>
        <Link to={`/app/practice/general/${encodeURIComponent(quizId)}/complete/${encodeURIComponent(attempt.attemptId)}`} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] sm:w-auto sm:self-center" aria-label={`Review result for attempt ${attempt.attemptNumber}`}>Review result <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </li>)}</ol>
      {currentState.loadError ? <p role="alert" className="mt-5 text-sm text-[#A84646]">{currentState.loadError}</p> : null}
      {currentState.nextCursor ? <button type="button" onClick={loadMore} disabled={loadingMore} className="mt-6 min-h-11 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-5 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA] hover:text-[#A94F00] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] sm:w-auto">{loadingMore ? "Loading more..." : "Load More"}</button> : <p role="status" className="mt-6 text-sm text-[#765F55]">You have reached the end of your history.</p>}
    </>}
  </div>
}

export default GeneralPracticeHistory
