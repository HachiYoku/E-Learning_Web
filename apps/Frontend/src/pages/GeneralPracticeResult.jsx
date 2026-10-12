import { useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { startGeneralPracticeSession } from "../services/generalPracticeService"
import { generalPracticeErrorMessage } from "../utils/generalPracticeErrors"

function ReviewQuestion({ question, index }) {
  const selected = Number.isInteger(question.selectedAnswer) ? question.options?.[question.selectedAnswer] : null
  const correct = Number.isInteger(question.correctAnswer) ? question.options?.[question.correctAnswer] : null
  const status = selected == null ? "Unanswered" : question.isCorrect ? "Correct" : "Incorrect"

  return <li className="rounded-2xl border border-[#E58C1A]/20 bg-[#FFFDF8] p-5 sm:p-6">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A94F00]">Question {index + 1}</p>
    <h3 className="mt-2 break-words text-lg font-bold">{question.prompt || "Look or listen, then review the answer."}</h3>
    {question.image ? <img src={question.image} alt={question.imageDecorative ? "" : question.imageAlt || "Question illustration"} className="mt-4 max-h-72 w-full rounded-xl object-contain" /> : null}
    {question.audio ? <div className="mt-4"><p className="mb-2 text-sm font-semibold text-[#765F55]">{question.audioLabel || "Question audio"}</p><audio controls preload="none" src={question.audio} aria-label={question.audioLabel || "Question audio"} className="w-full">Your browser does not support audio.</audio></div> : null}
    <p className="mt-4 font-bold" aria-label={`Question ${index + 1}: ${status}`}>Status: {status}</p>
    <dl className="mt-3 space-y-2 text-sm leading-relaxed">
      <div><dt className="font-semibold text-[#765F55]">Your answer</dt><dd className="break-words">{selected ?? "No answer submitted"}</dd></div>
      <div><dt className="font-semibold text-[#765F55]">Correct answer</dt><dd className="break-words">{correct ?? "Unavailable"}</dd></div>
    </dl>
    {question.explanation ? <p className="mt-4 rounded-xl bg-[#FFF9EA] p-4 text-sm leading-relaxed"><span className="font-bold">Explanation: </span>{question.explanation}</p> : null}
  </li>
}

function GeneralPracticeResult({ result, quizId }) {
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
      const session = await startGeneralPracticeSession(quizId)
      navigate(`/app/practice/general/${encodeURIComponent(quizId)}/take`, { state: { quizId, session } })
    } catch (requestError) {
      setStartError(generalPracticeErrorMessage(requestError))
    } finally {
      startInFlight.current = false
      setStarting(false)
    }
  }

  return <>
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A94F00]">General Practice result</p>
    <h1 className="mt-3 text-3xl font-bold">Submission saved</h1>
    <h2 className="mt-3 break-words text-xl font-semibold">{result.title || "Practice quiz"}</h2>
    {result.attemptNumber ? <p className="mt-2 text-sm text-[#765F55]">Attempt {result.attemptNumber}</p> : null}
    <p role="status" className="mt-5 text-3xl font-bold text-[#A94F00]" aria-label={`Score: ${result.score} out of ${result.total}`}>{result.score} / {result.total}</p>
    {Number.isFinite(result.percentage) ? <p className="mt-1 text-sm text-[#765F55]">{Math.round(result.percentage)}% correct</p> : null}
    {Number.isInteger(result.correctCount) ? <p className="mt-2 text-sm text-[#765F55]">{result.correctCount} correct out of {result.total} questions</p> : null}
    {result.completedAt && !Number.isNaN(Date.parse(result.completedAt)) ? <p className="mt-2 text-sm text-[#765F55]">Completed {new Date(result.completedAt).toLocaleString()}</p> : null}
    <p className="mt-3 break-all text-xs text-[#765F55]">Attempt reference: {result.attemptId}</p>
    <div className="mt-6 flex flex-wrap gap-3">
      {review.length > 0 ? <a href="#answer-review" className="inline-flex min-h-11 items-center rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Review answers</a> : null}
      <button type="button" onClick={tryAgain} disabled={starting} className="min-h-11 rounded-xl border border-[#E58C1A] bg-[#FFF9EA] px-5 py-2.5 text-sm font-bold disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">{starting ? "Opening quiz..." : "Try Again"}</button>
      <Link to={`/app/practice/general/${encodeURIComponent(quizId)}/history`} className="inline-flex min-h-11 items-center rounded-xl border border-[#2D2E30]/20 px-5 py-2.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">Attempt history</Link>
    </div>
    {startError ? <p role="alert" className="mt-4 text-sm font-semibold text-[#A84646]">{startError}</p> : null}
    {review.length > 0 ? <section id="answer-review" className="mt-8 scroll-mt-6 border-t border-[#2D2E30]/10 pt-7" aria-labelledby="answer-review-title">
      <h2 id="answer-review-title" className="text-2xl font-bold">Review your answers</h2>
      <ol className="mt-4 space-y-4">{review.map((question, index) => <ReviewQuestion key={question.questionId || index} question={question} index={index} />)}</ol>
    </section> : null}
  </>
}

export default GeneralPracticeResult
