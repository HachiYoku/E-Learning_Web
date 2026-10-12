import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import { fetchGeneralPracticeResult } from "../services/generalPracticeService"
import { generalPracticeErrorMessage } from "../utils/generalPracticeErrors"

function GeneralPracticeComplete() {
  const { quizId, attemptId } = useParams()
  const location = useLocation()
  const confirmedSave = location.state?.confirmedQuizId === quizId
    && location.state?.confirmedAttemptId === attemptId
  const [retryKey, setRetryKey] = useState(0)
  const requestKey = `${quizId}:${attemptId}:${retryKey}`
  const [resultState, setResultState] = useState({ key: requestKey, status: "loading", error: "" })
  const currentState = resultState.key === requestKey
    ? resultState : { key: requestKey, status: "loading", error: "" }

  useEffect(() => {
    let active = true
    fetchGeneralPracticeResult(attemptId)
      .then((result) => {
        if (!active) return
        setResultState(result?.attemptId === attemptId && result?.quizId === quizId
          ? { key: requestKey, status: "verified", error: "" }
          : { key: requestKey, status: "error", error: "This saved attempt could not be verified." })
      })
      .catch((requestError) => {
        if (active) setResultState({ key: requestKey, status: "error", error: generalPracticeErrorMessage(requestError) })
      })
    return () => { active = false }
  }, [attemptId, quizId, requestKey])

  return <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
    <section className="rounded-3xl border border-[#E58C1A]/20 bg-white p-6 sm:p-10">
      {currentState.status === "verified" ? <><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A94F00]">General Practice</p><h1 className="mt-3 text-3xl font-bold">Submission saved</h1><p className="mt-4 text-sm leading-relaxed text-[#765F55]">Your attempt is securely saved. Detailed results and answer review will be available in a later update.</p><p className="mt-4 break-all text-xs text-[#765F55]">Attempt reference: {attemptId}</p></> : currentState.status === "loading" ? <LoadingSpinner message="Verifying your saved attempt..." /> : <><h1 className="text-2xl font-bold">{confirmedSave ? "Submission saved" : "Submission status unverified"}</h1><p role="alert" className="mt-4 text-sm text-[#A84646]">{confirmedSave ? "Your quiz submission was saved, but the result is temporarily unavailable." : "We could not verify whether this attempt was saved."} {currentState.error}</p><button type="button" onClick={() => setRetryKey((current) => current + 1)} className="mt-5 min-h-11 rounded-xl border border-[#2D2E30]/20 bg-white px-5 py-2.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Retry Loading Result</button></>}
      <Link to="/app/practice/general" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#A94F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Back to General Practice</Link>
    </section>
  </div>
}

export default GeneralPracticeComplete
