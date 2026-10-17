import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import { fetchGeneralPracticeResult } from "../services/generalPracticeService"
import { fetchGuestGeneralPracticeResult } from "../services/guestGeneralPracticeService"
import { generalPracticeErrorMessage, guestGeneralPracticeErrorMessage } from "../utils/generalPracticeErrors"
import GeneralPracticeResult from "./GeneralPracticeResult"

function GeneralPracticeComplete({ guest = false }) {
  const { quizId, attemptId } = useParams()
  const location = useLocation()
  const confirmedSave = location.state?.confirmedQuizId === quizId
    && location.state?.confirmedAttemptId === attemptId
  const [retryKey, setRetryKey] = useState(0)
  const requestKey = `${quizId}:${attemptId}:${retryKey}`
  const [resultState, setResultState] = useState({ key: requestKey, status: "loading", error: "", result: null })
  const currentState = resultState.key === requestKey
    ? resultState : { key: requestKey, status: "loading", error: "", result: null }

  useEffect(() => {
    let active = true;
    (guest ? fetchGuestGeneralPracticeResult(attemptId) : fetchGeneralPracticeResult(attemptId))
      .then((result) => {
        if (!active) return
        setResultState(result?.attemptId === attemptId && result?.quizId === quizId
          ? { key: requestKey, status: "verified", error: "", result }
          : { key: requestKey, status: "error", error: "This saved attempt could not be verified.", result: null })
      })
      .catch((requestError) => {
        if (active) setResultState({ key: requestKey, status: "error", error: guest ? guestGeneralPracticeErrorMessage(requestError) : generalPracticeErrorMessage(requestError), result: null })
      })
    return () => { active = false }
  }, [attemptId, guest, quizId, requestKey])

  return <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
    <section className="rounded-2xl border border-[#2D2E30]/10 bg-white p-6 sm:p-10">
      {currentState.status === "verified" ? <GeneralPracticeResult result={currentState.result} quizId={quizId} guest={guest} /> : currentState.status === "loading" ? <LoadingSpinner message="Verifying your saved attempt..." /> : <><h1 className="text-2xl font-bold">{guest && !confirmedSave ? "Guest result unavailable" : confirmedSave ? "Submission saved" : "Submission status unverified"}</h1><p role="alert" className="mt-4 text-sm text-[#A84646]">{guest && !confirmedSave ? "Guest results are available for 24 hours after submission in the browser that holds the guest cookie." : confirmedSave ? "Your quiz submission was saved, but the result is temporarily unavailable." : "We could not verify whether this attempt was saved."} {currentState.error}</p><button type="button" onClick={() => setRetryKey((current) => current + 1)} className="mt-5 min-h-11 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-5 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA] hover:text-[#A94F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] sm:w-auto">Retry Loading Result</button></>}
      <Link to={guest ? "/practice/general" : "/app/practice/general"} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#2D2E30]/15 bg-white px-5 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA] hover:text-[#A94F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] sm:w-auto">Back to General Practice</Link>
    </section>
  </div>
}

export default GeneralPracticeComplete
