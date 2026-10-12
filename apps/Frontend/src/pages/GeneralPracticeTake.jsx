import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { startGeneralPracticeSession, submitGeneralPracticeQuiz } from "../services/generalPracticeService"
import { generalPracticeErrorMessage } from "../utils/generalPracticeErrors"

function validSession(value) {
  return typeof value?.sessionId === "string" && value.sessionId.length > 0
    && Number.isSafeInteger(value.revision) && value.revision > 0
    && Number.isFinite(Date.parse(value.expiresAt))
    && Array.isArray(value.questions) && value.questions.length > 0
    && value.questions.every((question) => Array.isArray(question.options) && question.options.length >= 2)
}

function GeneralPracticeTake() {
  const { quizId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const incoming = location.state?.quizId === quizId && validSession(location.state?.session)
    ? location.state.session : null
  const [session, setSession] = useState(incoming)
  const [answers, setAnswers] = useState(() => incoming?.questions.map(() => null) || [])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [invalidated, setInvalidated] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState("")
  const startInFlight = useRef(false)
  const submitInFlight = useRef(false)
  const pendingSubmission = useRef(null)
  const confirmHeading = useRef(null)

  useEffect(() => {
    if (!session) return undefined
    const remaining = Date.parse(session.expiresAt) - Date.now()
    if (remaining <= 0) return undefined
    const timer = setTimeout(() => setNow(Date.now()), remaining)
    return () => clearTimeout(timer)
  }, [session])

  useEffect(() => {
    if (confirming) confirmHeading.current?.focus()
  }, [confirming])

  useEffect(() => {
    if (!uncertain) return undefined
    const confirmLeaving = (event) => {
      const anchor = event.target.closest?.("a[href]")
      const button = event.target.closest?.("button")
      const isLogoNavigation = button?.getAttribute("aria-label") === "Go to Arun Thai website"
      const isLogoutConfirmation = button?.closest('[role="dialog"][aria-labelledby="logout-confirmation-title"]')
        && button.textContent.trim() === "Log out"
      if (!anchor && !isLogoNavigation && !isLogoutConfirmation) return
      if (anchor) {
        const destination = new URL(anchor.href, window.location.href)
        if (destination.origin !== window.location.origin) return
        if (destination.pathname === location.pathname && destination.search === location.search) return
      }
      if (!window.confirm("Your submission status is unknown. Leaving will lose the original submission needed for a safe retry. Stay on this page to retry it. Leave anyway?")) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener("click", confirmLeaving, true)
    return () => document.removeEventListener("click", confirmLeaving, true)
  }, [uncertain, location.pathname, location.search])

  const expired = Boolean(session && (Date.parse(session.expiresAt) <= now || Date.parse(session.expiresAt) <= Date.now()))
  const question = session?.questions[currentIndex]
  const answered = answers.filter((answer) => Number.isInteger(answer)).length
  const complete = session && answered === session.questions.length

  const begin = async () => {
    if (startInFlight.current) return
    startInFlight.current = true
    setStarting(true)
    setError("")
    try {
      const next = await startGeneralPracticeSession(quizId)
      if (!validSession(next) || Date.parse(next.expiresAt) <= Date.now()) throw new Error("Invalid session response")
      setSession(next)
      setAnswers(next.questions.map(() => null))
      setCurrentIndex(0)
      setNow(Date.now())
      setConfirming(false)
      setUncertain(false)
      setInvalidated(false)
      setUnavailable(false)
      pendingSubmission.current = null
    } catch (requestError) {
      setError(generalPracticeErrorMessage(requestError))
    } finally {
      startInFlight.current = false
      setStarting(false)
    }
  }

  const submit = async (retry = false) => {
    if (submitInFlight.current || !session || (!retry && expired)) return
    if (!retry && !complete) return
    const payload = retry ? pendingSubmission.current : {
      sessionId: session.sessionId, revision: session.revision, answers: [...answers],
    }
    if (!payload) return
    pendingSubmission.current = payload
    submitInFlight.current = true
    setSubmitting(true)
    setConfirming(false)
    setError("")
    try {
      const result = await submitGeneralPracticeQuiz(quizId, payload)
      if (typeof result?.attemptId !== "string" || !result.attemptId) throw new Error("Invalid submission response")
      navigate(`/app/practice/general/${encodeURIComponent(quizId)}/complete/${encodeURIComponent(result.attemptId)}`, {
        replace: true, state: { confirmedQuizId: quizId, confirmedAttemptId: result.attemptId },
      })
    } catch (requestError) {
      setError(generalPracticeErrorMessage(requestError))
      setUncertain((previous) => {
        if ([400, 404, 409].includes(requestError?.status)) return false
        return previous || !requestError?.status || requestError.status === 503
      })
      if (requestError?.status === 409) setInvalidated(true)
      if (requestError?.status === 404) setUnavailable(true)
    } finally {
      submitInFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <Link to="/app/practice/general" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-[#A94F00] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />General Practice</Link>
      <p className="mt-3 text-sm text-[#765F55]">Unsubmitted selections are not saved. Leaving or reloading this page clears them, even if you resume the same session.</p>

      {!session || unavailable || ((expired || invalidated) && !uncertain) ? (
        <section className="mt-6 rounded-3xl border border-[#E58C1A]/20 bg-white p-6 sm:p-10">
          <h1 className="text-2xl font-bold">{unavailable ? "Quiz unavailable" : expired || invalidated ? "Session unavailable" : "Ready to practice?"}</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#765F55]">{unavailable ? "This quiz is no longer available. Your answers were not submitted." : expired || invalidated ? "This session has expired or been invalidated. Your unsubmitted answers were not saved. You can start a new session when ready." : "Start or resume your unfinished session. Any answers selected before leaving this page will need to be entered again."}</p>
          {!unavailable ? <button type="button" onClick={begin} disabled={starting} className="mt-5 min-h-11 rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#A94F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] disabled:opacity-60">{starting ? "Opening quiz..." : expired || invalidated ? "Start a new session" : "Start / Resume Quiz"}</button> : null}
          {error ? <p role="alert" className="mt-4 text-sm font-semibold text-[#A84646]">{error}</p> : null}
        </section>
      ) : (
        <>
          <header className="mt-6 rounded-3xl border border-[#E58C1A]/20 bg-white p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A94F00]">General Practice</p>
            <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{session.title || "Practice quiz"}</h1>
            {session.created === false ? <p className="mt-2 text-sm font-semibold text-[#A94F00]">Unfinished session resumed. Previous unsubmitted selections were not saved.</p> : null}
            <p aria-live="polite" className="mt-3 text-sm text-[#765F55]">Question {currentIndex + 1} of {session.questions.length} · {answered} answered</p>
            <progress className="mt-3 h-2 w-full accent-[#A94F00]" value={answered} max={session.questions.length} aria-label="Questions answered" />
            <p className="mt-3 text-xs text-[#765F55]">Session expires {new Date(session.expiresAt).toLocaleString()}.</p>
          </header>

          {expired && uncertain ? <p role="status" className="mt-5 rounded-xl bg-[#FFF1D0] p-4 text-sm text-[#765F55]">The session has expired, but retrying this same submission may still retrieve a saved result.</p> : null}
          <nav aria-label="Quiz questions" className="mt-5 flex flex-wrap gap-2">
            {session.questions.map((item, index) => (
              <button key={item._id || index} type="button" onClick={() => setCurrentIndex(index)} aria-label={`Question ${index + 1}, ${Number.isInteger(answers[index]) ? "answered" : "unanswered"}`} aria-current={index === currentIndex ? "step" : undefined} className={`min-h-11 min-w-11 rounded-xl border px-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] ${index === currentIndex ? "border-[#2D2E30] bg-[#2D2E30] text-white" : Number.isInteger(answers[index]) ? "border-[#E58C1A] bg-[#FFF1D0] text-[#2D2E30]" : "border-[#2D2E30]/20 bg-white text-[#765F55]"}`}>{index + 1}</button>
            ))}
          </nav>

          <section className="mt-5 rounded-3xl border border-[#2D2E30]/10 bg-white p-5 sm:p-8" aria-label={`Question ${currentIndex + 1}`}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A94F00]">Question {currentIndex + 1}</p>
            <h2 className="mt-2 break-words text-xl font-bold">{question.prompt || "Look or listen, then choose an answer."}</h2>
            {question.image ? <img src={question.image} alt={question.imageDecorative ? "" : question.imageAlt || "Question illustration"} className="mt-5 max-h-72 w-full rounded-xl object-contain" /> : null}
            {question.audio ? <div className="mt-5"><p className="mb-2 text-sm font-semibold text-[#765F55]">{question.audioLabel || "Question audio"}</p><audio controls preload="none" src={question.audio} aria-label={question.audioLabel || "Question audio"} className="w-full">Your browser does not support audio.</audio></div> : null}
            <fieldset className="mt-6 space-y-3">
              <legend className="sr-only">Choose an answer for question {currentIndex + 1}</legend>
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-4 py-3 text-sm leading-relaxed has-[:checked]:border-[#A94F00] has-[:checked]:bg-[#FFF1D0] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#A94F00]">
                  <input type="radio" name={`question-${currentIndex}`} value={optionIndex} checked={answers[currentIndex] === optionIndex} onChange={() => setAnswers((current) => current.map((answer, index) => index === currentIndex ? optionIndex : answer))} disabled={uncertain || submitting} className="h-4 w-4 shrink-0 accent-[#A94F00]" />
                  <span className="break-words">{option}</span>
                </label>
              ))}
            </fieldset>
          </section>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => setCurrentIndex((index) => index - 1)} disabled={currentIndex === 0} className="min-h-11 rounded-xl border border-[#2D2E30]/20 bg-white px-5 py-2.5 text-sm font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Previous</button>
            <button type="button" onClick={() => setCurrentIndex((index) => index + 1)} disabled={currentIndex === session.questions.length - 1} className="min-h-11 rounded-xl border border-[#2D2E30]/20 bg-white px-5 py-2.5 text-sm font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Next</button>
            <button type="button" onClick={() => setConfirming(true)} disabled={!complete || submitting || uncertain || expired} className="min-h-11 rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Review and submit</button>
          </div>

          {confirming ? <section role="region" aria-labelledby="confirm-general-submission" className="mt-5 rounded-2xl border border-[#E58C1A]/30 bg-[#FFF9EA] p-5">
            <h2 id="confirm-general-submission" ref={confirmHeading} tabIndex={-1} className="text-lg font-bold focus:outline-none">Submit your answers?</h2>
            <p className="mt-2 text-sm text-[#765F55]">Your answers will be scored and saved. Please check them before continuing.</p>
            <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-[#2D2E30]/20 bg-white px-5 py-2.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Keep editing</button><button type="button" onClick={() => submit()} disabled={submitting} className="min-h-11 rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">{submitting ? "Submitting..." : "Submit quiz"}</button></div>
          </section> : null}

          {submitting ? <p role="status" className="mt-5 text-sm font-semibold text-[#765F55]">Submitting your answers...</p> : null}
          {error ? <p role="alert" className="mt-5 rounded-xl bg-[#FFF0EE] p-4 text-sm font-semibold text-[#A84646]">{error}</p> : null}
          {uncertain ? <section className="mt-4 rounded-2xl border border-[#E58C1A]/30 bg-[#FFF9EA] p-5" aria-labelledby="uncertain-submission"><h2 id="uncertain-submission" className="text-lg font-bold">Submission status unknown</h2><p className="mt-2 text-sm text-[#765F55]">Your attempt may already be saved. Do not start another quiz or reload this page yet. The Backend can safely replay this exact submission without creating a second attempt.</p><button type="button" onClick={() => submit(true)} disabled={submitting} className="mt-4 min-h-11 rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">{submitting ? "Checking submission..." : "Retry this same submission"}</button></section> : null}
        </>
      )}
    </div>
  )
}

export default GeneralPracticeTake
