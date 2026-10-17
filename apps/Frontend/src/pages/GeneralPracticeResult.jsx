import { useRef, useState } from "react"
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { startGeneralPracticeSession } from "../services/generalPracticeService"
import { startGuestGeneralPracticeSession } from "../services/guestGeneralPracticeService"
import { generalPracticeErrorMessage, guestGeneralPracticeErrorMessage } from "../utils/generalPracticeErrors"

function ReviewQuestion({ question, index }) {
  const selectedIndex = Number.isInteger(question.selectedAnswer) ? question.selectedAnswer : null
  const status = selectedIndex == null ? "Unanswered" : question.isCorrect ? "Correct" : "Incorrect"

  return <li className="rounded-2xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-5 sm:p-6">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent">Question {index + 1}</p>
    <h3 className="mt-2 break-words text-lg font-bold">{question.prompt || "Look or listen, then review the answer."}</h3>
    {question.image ? <img src={question.image} alt={question.imageDecorative ? "" : question.imageAlt || "Question illustration"} className="mt-4 max-h-72 w-full rounded-xl object-contain" /> : null}
    {question.audio ? <div className="mt-4"><p className="mb-2 text-sm font-semibold text-[#765F55]">{question.audioLabel || "Question audio"}</p><audio controls preload="none" src={question.audio} aria-label={question.audioLabel || "Question audio"} className="w-full">Your browser does not support audio.</audio></div> : null}
    <p className="mt-4 font-bold" aria-label={`Question ${index + 1}: ${status}`}>Status: {status}</p>
    {selectedIndex == null ? <p className="mt-2 text-sm text-[#765F55]">No answer submitted.</p> : null}
    <ol className="mt-4 grid gap-3 sm:grid-cols-2" aria-label={`Saved answer options for question ${index + 1}`}>
      {(question.options || []).map((option, optionIndex) => {
        const isSelected = selectedIndex === optionIndex
        const isCorrect = question.correctAnswer === optionIndex
        const label = isSelected && isCorrect ? "Your answer · Correct" : isSelected ? "Your answer · Incorrect" : isCorrect ? "Correct answer" : ""
        return <li key={optionIndex} className={`flex min-h-14 items-start gap-3 rounded-xl border-2 px-4 py-4 text-sm font-semibold leading-relaxed shadow-sm ${isSelected && !isCorrect ? "border-[#B5443C] bg-[#FFF0EE]" : isCorrect ? "border-[#2F7A49] bg-[#E9F4EA]" : "border-[#2D2E30]/10 bg-white"}`}>
          <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${isSelected ? "bg-[#E58C1A] text-white" : "bg-[#F0E7DC] text-[#765F55]"}`}>{String.fromCharCode(65 + optionIndex)}</span>
          <span className="min-w-0 flex-1 break-words">{option}{label ? <span className="mt-1 flex items-center gap-1.5 text-xs font-bold">{isSelected && !isCorrect ? <XCircle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{label}</span> : null}</span>
        </li>
      })}
    </ol>
    {question.explanation ? <p className="mt-4 rounded-xl bg-[#FFF9EA] p-4 text-sm leading-relaxed"><span className="font-bold">Explanation: </span>{question.explanation}</p> : null}
  </li>
}

function GeneralPracticeResult({ result, quizId, guest = false }) {
  const navigate = useNavigate()
  const startInFlight = useRef(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState("")
  const review = Array.isArray(result.review) ? result.review : []

  const tryAgain = async () => {
    if (startInFlight.current) return
    startInFlight.current = true
    setStarting(true)
    setStartError("")
    try {
      const session = await (guest ? startGuestGeneralPracticeSession(quizId) : startGeneralPracticeSession(quizId))
      navigate(guest ? `/practice/general/${encodeURIComponent(quizId)}/guest/sessions/${encodeURIComponent(session.sessionId)}` : `/app/practice/general/${encodeURIComponent(quizId)}/take`, { state: { quizId, session } })
    } catch (requestError) {
      setStartError(guest ? guestGeneralPracticeErrorMessage(requestError) : generalPracticeErrorMessage(requestError))
    } finally {
      startInFlight.current = false
      setStarting(false)
    }
  }

  return <>
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Result</p>
    <h1 className="mt-3 break-words text-3xl font-bold">{result.title || "Practice quiz"}</h1>
    {result.attemptNumber ? <p className="mt-2 text-sm text-[#765F55]">Attempt {result.attemptNumber}</p> : null}
    <p role="status" className="mt-5 text-3xl font-bold text-[#A94F00]" aria-label={`Score: ${result.score} out of ${result.total}`}>{result.score} / {result.total}</p>
    {Number.isFinite(result.percentage) ? <p className="mt-1 text-sm text-[#765F55]">{Math.round(result.percentage)}% correct</p> : null}
    {Number.isInteger(result.correctCount) ? <p className="mt-2 text-sm text-[#765F55]">{result.correctCount} correct out of {result.total} questions</p> : null}
    {result.completedAt && !Number.isNaN(Date.parse(result.completedAt)) ? <p className="mt-2 text-sm text-[#765F55]">Completed {new Date(result.completedAt).toLocaleString()}</p> : null}
    {guest ? <p className="mt-3 text-sm text-[#765F55]">This temporary result is available for 24 hours after submission in this browser. It is not saved to a Student account.</p> : null}
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <button type="button" onClick={tryAgain} disabled={starting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><RotateCcw className="h-4 w-4" aria-hidden="true" />{starting ? "Opening quiz..." : "Try Again"}</button>
    </div>
    {startError ? <p role="alert" className="mt-4 text-sm font-semibold text-[#A84646]">{startError}</p> : null}
    {review.length > 0 ? <section id="answer-review" className="mt-8 scroll-mt-6 border-t border-[#2D2E30]/10 pt-7" aria-labelledby="answer-review-title">
      <h2 id="answer-review-title" className="text-2xl font-bold">Review your answers</h2>
      <ol className="mt-4 space-y-4">{review.map((question, index) => <ReviewQuestion key={question.questionId || index} question={question} index={index} />)}</ol>
    </section> : null}
  </>
}

export default GeneralPracticeResult
