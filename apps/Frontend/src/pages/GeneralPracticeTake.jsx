import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { startGeneralPracticeSession, submitGeneralPracticeQuiz } from "../services/generalPracticeService"
import { fetchGuestGeneralPracticeSession, startGuestGeneralPracticeSession, submitGuestGeneralPracticeQuiz } from "../services/guestGeneralPracticeService"
import { generalPracticeErrorMessage, guestGeneralPracticeErrorMessage, isStandaloneTransactionConflict } from "../utils/generalPracticeErrors"

function validSession(value) {
  return typeof value?.sessionId === "string" && value.sessionId.length > 0
    && Number.isSafeInteger(value.revision) && value.revision > 0
    && Number.isFinite(Date.parse(value.expiresAt))
    && Array.isArray(value.questions) && value.questions.length > 0
    && value.questions.every((question) => Array.isArray(question.options) && question.options.length >= 2)
}

function GeneralPracticeTake({ guest = false }) {
  const { quizId, sessionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const incoming = location.state?.quizId === quizId && validSession(location.state?.session)
    && (!guest || !sessionId || location.state.session.sessionId === sessionId)
    ? location.state.session : null
  const [session, setSession] = useState(incoming)
  const [answers, setAnswers] = useState(() => incoming?.questions.map(() => null) || [])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [conflicted, setConflicted] = useState(false)
  const [invalidated, setInvalidated] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState("")
  const startInFlight = useRef(false)
  const submitInFlight = useRef(false)
  const pendingSubmission = useRef(null)
  const confirmHeading = useRef(null)
  const confirmDialog = useRef(null)
  const submitTrigger = useRef(null)
  const messageFor = guest ? guestGeneralPracticeErrorMessage : generalPracticeErrorMessage

  useEffect(() => {
    if (!guest || !sessionId || incoming) return undefined
    let active = true
    setStarting(true)
    fetchGuestGeneralPracticeSession(quizId, sessionId)
      .then((restored) => {
        if (!active) return
        if (!validSession(restored) || restored.sessionId !== sessionId || Date.parse(restored.expiresAt) <= Date.now()) {
          setInvalidated(true)
          return
        }
        setSession(restored)
        setAnswers(restored.questions.map(() => null))
        setNow(Date.now())
      })
      .catch((requestError) => {
        if (!active) return
        setInvalidated([401, 409].includes(requestError.status))
        setUnavailable(requestError.status === 404)
        setError(guestGeneralPracticeErrorMessage(requestError))
      })
      .finally(() => { if (active) setStarting(false) })
    return () => { active = false }
  }, [guest, quizId, sessionId, incoming])

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

  const closeConfirmation = () => {
    setConfirming(false)
    requestAnimationFrame(() => submitTrigger.current?.focus())
  }

  const handleConfirmationKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault()
      closeConfirmation()
    }
    if (event.key !== "Tab") return
    const buttons = [...(confirmDialog.current?.querySelectorAll("button:not(:disabled)") || [])]
    if (!buttons.length) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmHeading.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  useEffect(() => {
    if (!uncertain && !conflicted) return undefined
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
      const warning = uncertain
        ? "Your submission status is unknown. Leaving will lose the original submission needed for a safe retry. Stay on this page to retry it. Leave anyway?"
        : "Your answers and retry submission will be lost if you leave. Stay on this page to try again. Leave anyway?"
      if (!window.confirm(warning)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener("click", confirmLeaving, true)
    return () => document.removeEventListener("click", confirmLeaving, true)
  }, [uncertain, conflicted, location.pathname, location.search])

  const expired = Boolean(session && (Date.parse(session.expiresAt) <= now || Date.parse(session.expiresAt) <= Date.now()))
  const question = session?.questions[currentIndex]
  const answered = answers.filter((answer) => Number.isInteger(answer)).length
  const complete = session && answered === session.questions.length

  const chooseAnswer = (optionIndex) => {
    setAnswers((current) => current.map((answer, index) => index === currentIndex ? optionIndex : answer))
    setError("")
  }

  const requestSubmission = () => {
    if (!session || submitting || uncertain || conflicted || expired) return
    const firstUnanswered = answers.findIndex((answer) => !Number.isInteger(answer))
    if (firstUnanswered !== -1) {
      const remaining = answers.filter((answer) => !Number.isInteger(answer)).length
      setCurrentIndex(firstUnanswered)
      setError(`${remaining} question${remaining === 1 ? " is" : "s are"} still unanswered. Please choose an answer before finishing.`)
      return
    }
    setError("")
    setConfirming(true)
  }

  const begin = async () => {
    if (startInFlight.current) return
    startInFlight.current = true
    setStarting(true)
    setError("")
    try {
      const next = await (guest ? startGuestGeneralPracticeSession(quizId) : startGeneralPracticeSession(quizId))
      if (!validSession(next) || Date.parse(next.expiresAt) <= Date.now()) throw new Error("Invalid session response")
      setSession(next)
      setAnswers(next.questions.map(() => null))
      setCurrentIndex(0)
      setNow(Date.now())
      setConfirming(false)
      setUncertain(false)
      setConflicted(false)
      setInvalidated(false)
      setUnavailable(false)
      pendingSubmission.current = null
      if (guest) navigate(`/practice/general/${encodeURIComponent(quizId)}/guest/sessions/${encodeURIComponent(next.sessionId)}`, { replace: true, state: { quizId, session: next } })
    } catch (requestError) {
      setError(messageFor(requestError))
      if (guest && requestError?.status === 404) setUnavailable(true)
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
    const retryingConflict = retry && conflicted
    pendingSubmission.current = payload
    submitInFlight.current = true
    setSubmitting(true)
    setConflicted(false)
    setConfirming(false)
    setError("")
    try {
      const result = await (guest ? submitGuestGeneralPracticeQuiz(quizId, payload) : submitGeneralPracticeQuiz(quizId, payload))
      if (typeof result?.attemptId !== "string" || !result.attemptId) throw new Error("Invalid submission response")
      navigate(`${guest ? "/practice/general" : "/app/practice/general"}/${encodeURIComponent(quizId)}${guest ? "/guest" : ""}/complete/${encodeURIComponent(result.attemptId)}`, {
        replace: true, state: { confirmedQuizId: quizId, confirmedAttemptId: result.attemptId },
      })
    } catch (requestError) {
      const transactionConflict = !guest && isStandaloneTransactionConflict(requestError)
      setError(messageFor(requestError))
      setConflicted(transactionConflict || (retryingConflict && requestError?.status === 429))
      setUncertain((previous) => {
        if (transactionConflict) return false
        if ([400, 401, 404, 409].includes(requestError?.status)) return false
        return previous || !requestError?.status || requestError.status === 503
      })
      if ((requestError?.status === 409 && !transactionConflict) || (guest && requestError?.status === 401)) setInvalidated(true)
      if (requestError?.status === 404) setUnavailable(true)
    } finally {
      submitInFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <Link to={`${guest ? "/practice/general" : "/app/practice/general"}/${encodeURIComponent(quizId)}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#C97112] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to quiz details</Link>
      <p className="mt-3 text-sm text-[#765F55]">Unsubmitted selections are not saved. Leaving or reloading this page clears them, even if you resume the same session.</p>

      {!session || unavailable || ((expired || invalidated) && !uncertain) ? (
        <section className="mt-6 rounded-2xl border border-[#2D2E30]/10 bg-white p-6 sm:p-10">
          <h1 className="text-2xl font-bold">{unavailable ? "Quiz unavailable" : expired || invalidated ? "Session unavailable" : "Ready to practice?"}</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#765F55]">{unavailable ? "This quiz is no longer available. Your answers were not submitted." : expired || invalidated ? "This session has expired or been invalidated. Your unsubmitted answers were not saved. You can start a new session when ready." : "Start or resume your unfinished session. Any answers selected before leaving this page will need to be entered again."}</p>
          {!unavailable ? <button type="button" onClick={begin} disabled={starting} className="mt-5 min-h-11 w-full rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] disabled:cursor-wait disabled:opacity-60 sm:w-auto">{starting ? "Opening quiz..." : expired || invalidated ? "Start a new session" : "Start / Resume Quiz"}</button> : null}
          {error ? <p role="alert" className="mt-4 text-sm font-semibold text-[#A84646]">{error}</p> : null}
        </section>
      ) : (
        <>
          <header className="mt-6 rounded-2xl border border-[#2D2E30]/10 bg-white p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">General Practice</p>
            <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{session.title || "Practice quiz"}</h1>
            {session.created === false ? <p className="mt-2 text-sm font-semibold text-[#A94F00]">Unfinished session resumed. Previous unsubmitted selections were not saved.</p> : null}
            <div className="mt-5 flex items-center gap-4"><p aria-live="polite" className="shrink-0 text-sm font-bold text-[#C97112]">Question {currentIndex + 1} of {session.questions.length}</p><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0E7DC]" role="progressbar" aria-label="Question progress" aria-valuenow={currentIndex + 1} aria-valuemin={0} aria-valuemax={session.questions.length}><div className="h-full rounded-full bg-[#E58C1A] transition-all" style={{ width: `${(currentIndex + 1) / session.questions.length * 100}%` }} /></div></div>
            <p className="mt-3 text-xs text-[#765F55]">Session expires {new Date(session.expiresAt).toLocaleString()}.</p>
          </header>

          {expired && uncertain ? <p role="status" className="mt-5 rounded-xl bg-[#FFF1D0] p-4 text-sm text-[#765F55]">The session has expired, but retrying this same submission may still retrieve a saved result.</p> : null}
          <nav aria-label="Quiz questions" className="mt-5 rounded-2xl border border-[#2D2E30]/10 bg-[#FFF9EA] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#765F55]">Questions</p><p className="text-xs font-semibold text-[#C97112]">{answered} of {session.questions.length} answered</p></div>
            <div className="mt-3 flex flex-wrap gap-2">
            {session.questions.map((item, index) => (
              <button key={item._id || index} type="button" onClick={() => { setCurrentIndex(index); setError("") }} aria-label={`Question ${index + 1}, ${Number.isInteger(answers[index]) ? "answered" : "unanswered"}`} aria-current={index === currentIndex ? "step" : undefined} className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] ${index === currentIndex ? "bg-[#2D2E30] text-white shadow-sm" : Number.isInteger(answers[index]) ? "bg-[#FFF1CE] text-[#9A5816] hover:bg-[#F8C56A]" : "bg-white text-[#765F55] hover:bg-[#FFF4D8] hover:text-[#C97112]"}`}>{index + 1}</button>
            ))}
            </div>
          </nav>

          <section className="mt-5 rounded-2xl border border-[#2D2E30]/10 bg-white p-5 sm:p-8" aria-label={`Question ${currentIndex + 1}`}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-accent">Question {currentIndex + 1}</p>
            <h2 className="mt-5 break-words text-center text-xl font-bold leading-relaxed sm:text-2xl">{question.prompt || "Look or listen, then choose an answer."}</h2>
            {question.image ? <img src={question.image} alt={question.imageDecorative ? "" : question.imageAlt || "Question illustration"} className="mt-5 max-h-72 w-full rounded-xl object-contain" /> : null}
            {question.audio ? <div className="mt-5"><p className="mb-2 text-sm font-semibold text-[#765F55]">{question.audioLabel || "Question audio"}</p><audio controls preload="none" src={question.audio} aria-label={question.audioLabel || "Question audio"} className="w-full">Your browser does not support audio.</audio></div> : null}
            <fieldset className="mx-auto mt-7 grid max-w-lg gap-4 sm:grid-cols-2">
              <legend className="mb-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#765F55]">Choose the best answer<span className="sr-only"> for question {currentIndex + 1}</span></legend>
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-[#2D2E30]/10 bg-white px-4 py-4 text-left text-sm font-semibold leading-relaxed shadow-sm transition hover:border-[#E58C1A]/45 hover:bg-[#FFF9EA] hover:shadow-md has-[:checked]:border-[#E58C1A] has-[:checked]:bg-[#FFF4D8] has-[:checked]:shadow-[#E58C1A]/10 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#A94F00] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                  <input type="radio" name={`question-${currentIndex}`} value={optionIndex} checked={answers[currentIndex] === optionIndex} onChange={() => chooseAnswer(optionIndex)} disabled={uncertain || conflicted || submitting} className="sr-only" />
                  <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${answers[currentIndex] === optionIndex ? "bg-[#E58C1A] text-white" : "bg-[#F0E7DC] text-[#765F55]"}`}>{String.fromCharCode(65 + optionIndex)}</span>
                  <span className="break-words">{option}</span>
                </label>
              ))}
            </fieldset>
            {error && !uncertain && !conflicted ? <p role="alert" className="mx-auto mt-4 max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
          </section>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#2D2E30]/10 pt-6">
            <button type="button" onClick={() => { setCurrentIndex((index) => index - 1); setError("") }} disabled={currentIndex === 0} className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF4D8] hover:text-[#C97112] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Previous</button>
            {currentIndex < session.questions.length - 1 ? <button type="button" onClick={() => { setCurrentIndex((index) => index + 1); setError("") }} className="min-h-11 rounded-xl bg-[#F8C56A] px-6 py-3 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Next</button> : <button ref={submitTrigger} type="button" onClick={requestSubmission} disabled={submitting || uncertain || conflicted || expired} className="min-h-11 rounded-xl bg-[#F8C56A] px-6 py-3 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Submit Quiz</button>}
          </div>

          {confirming ? <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2D2E30]/55 p-4"><section ref={confirmDialog} role="dialog" aria-modal="true" aria-labelledby="confirm-general-submission" aria-describedby="confirm-general-description" onKeyDown={handleConfirmationKeyDown} className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E58C1A]/20 bg-white shadow-2xl">
            <div className="bg-[#FFF9EA] px-6 py-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Ready to submit?</p><h2 id="confirm-general-submission" ref={confirmHeading} tabIndex={-1} className="mt-2 text-xl font-bold focus:outline-none">Submit your quiz?</h2></div>
            <p id="confirm-general-description" className="px-6 py-5 text-sm leading-6 text-[#765F55]">You have answered all {session.questions.length} questions. Once submitted, your result will be recorded.</p>
            <div className="flex flex-wrap justify-end gap-3 border-t border-[#2D2E30]/10 p-5"><button type="button" onClick={closeConfirmation} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-5 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF4D8] hover:text-[#C97112] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Continue Quiz</button><button type="button" onClick={() => submit()} disabled={!complete || submitting} className="min-h-11 rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">{submitting ? "Submitting..." : "Confirm Submit"}</button></div>
          </section></div> : null}

          {submitting ? <p role="status" className="mt-5 text-sm font-semibold text-[#765F55]">Submitting your answers...</p> : null}
          {conflicted ? <section className="mt-4 rounded-2xl border border-[#E58C1A]/30 bg-[#FFF9EA] p-5" aria-labelledby="conflicted-submission"><h2 id="conflicted-submission" className="text-lg font-bold">Please try your submission again</h2><p role="alert" className="mt-2 text-sm text-[#765F55]">{error} Your answers are still here.</p><button type="button" onClick={() => submit(true)} disabled={submitting} className="mt-4 min-h-11 w-full rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md disabled:cursor-wait disabled:opacity-50 sm:w-auto">{submitting ? "Submitting..." : "Retry this same submission"}</button></section> : null}
          {error && uncertain ? <p role="alert" className="mt-5 rounded-xl bg-[#FFF0EE] p-4 text-sm font-semibold text-[#A84646]">{error}</p> : null}
          {uncertain ? <section className="mt-4 rounded-2xl border border-[#E58C1A]/30 bg-[#FFF9EA] p-5" aria-labelledby="uncertain-submission"><h2 id="uncertain-submission" className="text-lg font-bold">Submission status unknown</h2><p className="mt-2 text-sm text-[#765F55]">Your attempt may already be saved. Do not start another quiz or reload this page yet. The Backend can safely replay this exact submission without creating a second attempt.</p><button type="button" onClick={() => submit(true)} disabled={submitting} className="mt-4 min-h-11 w-full rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md disabled:cursor-wait disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] sm:w-auto">{submitting ? "Checking submission..." : "Retry this same submission"}</button></section> : null}
        </>
      )}
    </div>
  )
}

export default GeneralPracticeTake
