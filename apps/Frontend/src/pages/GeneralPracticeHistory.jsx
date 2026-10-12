import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import { fetchGeneralPracticeHistory } from "../services/generalPracticeService"
import { generalPracticeErrorMessage } from "../utils/generalPracticeErrors"

function validPage(page) {
  return Array.isArray(page?.attempts)
    && (page.nextCursor === null || typeof page.nextCursor === "string")
}

function GeneralPracticeHistory() {
  const { quizId } = useParams()
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

  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
    <Link to={`/app/practice/general/${encodeURIComponent(quizId)}`} className="inline-flex min-h-11 items-center text-sm font-bold text-[#A94F00] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Back to quiz details</Link>
    <header className="mt-5 rounded-3xl border border-[#E58C1A]/20 bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A94F00]">General Practice</p>
      <h1 className="mt-2 text-3xl font-bold">Your attempt history</h1>
      <p className="mt-2 text-sm text-[#765F55]">Only your saved attempts appear here. Select an attempt to review its original answers and result.</p>
    </header>
    {currentState.status === "loading" ? <div className="mt-6"><LoadingSpinner message="Loading your attempt history..." /></div> : currentState.status === "error" ? <section className="mt-6 rounded-2xl bg-white p-6"><p role="alert" className="text-sm text-[#A84646]">{currentState.error}</p><button type="button" onClick={() => setRetryKey((current) => current + 1)} className="mt-4 min-h-11 rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Try again</button></section> : currentState.attempts.length === 0 ? <p role="status" className="mt-6 rounded-2xl bg-white p-6 text-sm text-[#765F55]">No saved attempts yet.</p> : <>
      <ol className="mt-6 space-y-4">{currentState.attempts.map((attempt) => <li key={attempt.attemptId} className="rounded-2xl border border-[#E58C1A]/20 bg-white p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A94F00]">Attempt {attempt.attemptNumber}</p>
        <h2 className="mt-2 break-words text-lg font-bold">{attempt.title || "Practice quiz"}</h2>
        <p className="mt-2 text-sm text-[#765F55]">Score: {attempt.score} of {attempt.total}{Number.isFinite(attempt.percentage) ? ` · ${Math.round(attempt.percentage)}%` : ""}</p>
        {attempt.completedAt && !Number.isNaN(Date.parse(attempt.completedAt)) ? <p className="mt-1 text-sm text-[#765F55]">Completed {new Date(attempt.completedAt).toLocaleString()}</p> : null}
        <Link to={`/app/practice/general/${encodeURIComponent(quizId)}/complete/${encodeURIComponent(attempt.attemptId)}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]" aria-label={`Review attempt ${attempt.attemptNumber}`}>Review result</Link>
      </li>)}</ol>
      {currentState.loadError ? <p role="alert" className="mt-5 text-sm text-[#A84646]">{currentState.loadError}</p> : null}
      {currentState.nextCursor ? <button type="button" onClick={loadMore} disabled={loadingMore} className="mt-6 min-h-11 rounded-xl border border-[#2D2E30]/20 bg-white px-5 py-2.5 text-sm font-bold disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">{loadingMore ? "Loading more..." : "Load More"}</button> : <p role="status" className="mt-6 text-sm text-[#765F55]">You have reached the end of your history.</p>}
    </>}
  </div>
}

export default GeneralPracticeHistory
