import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react"
import { Link } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import { fetchGeneralPracticeQuizzes } from "../services/generalPracticeService"

function detailsLinkLabel(quiz, index, quizzes) {
  const duplicateTitle = quizzes.some((item, itemIndex) => itemIndex !== index && item.title === quiz.title)
  return `View details for ${quiz.title}${duplicateTitle ? `, quiz ${index + 1}` : ""}`
}

function GeneralPracticeList({ publicView = false }) {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    fetchGeneralPracticeQuizzes()
      .then((items) => { if (active) setQuizzes(publicView ? items.filter((item) => item.standaloneAccess === "public") : items) })
      .catch((requestError) => {
        if (active) setError(!publicView && requestError.status === 401
          ? "Your session has expired. Please sign in again."
          : "We couldn't load General Practice quizzes. Please try again.")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [publicView, retryKey])

  const retry = () => {
    setError("")
    setLoading(true)
    setRetryKey((current) => current + 1)
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <Link to={publicView ? "/" : "/app/practice"} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#C97112] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{publicView ? "Back to Home" : "Back to Practice Overview"}</Link>
      <header className="mt-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">General Practice</h1>
        <p className="mt-1 text-sm text-[#765F55]">Choose a quiz and start practicing.</p>
      </header>

      <section className="mt-5" aria-label="Available quizzes">
        {loading ? <LoadingSpinner message="Loading General Practice quizzes..." /> : error ? (
          <div role="alert" className="rounded-2xl border border-[#2D2E30]/10 bg-white p-6 sm:p-8">
            <p className="text-sm text-[#765F55]">{error}</p>
            <button type="button" onClick={retry} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-5 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA] hover:text-[#A94F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D9CEBE] bg-white px-6 py-12 text-center"><h2 className="text-lg font-bold">No quizzes available yet</h2><p className="mt-2 text-sm text-[#765F55]">Check back soon for new General Practice activities.</p></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {quizzes.map((quiz, index) => (
              <article key={quiz.id} className="flex min-w-0 flex-col rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-sm transition hover:border-[#E58C1A]/35 hover:shadow-lg">
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#765F55]">
                  {quiz.category ? <span className="rounded-full bg-[#FFF1D0] px-3 py-1">{quiz.category}</span> : null}
                  {quiz.difficulty ? <span className="rounded-full bg-[#FFF9EA] px-3 py-1">{quiz.difficulty}</span> : null}
                  {quiz.standaloneAccess === "students" ? <span className="rounded-full bg-[#E9F4EA] px-3 py-1">Students Only</span> : null}
                </div>
                <h2 className="mt-3 break-words text-lg font-bold">{quiz.title}</h2>
                <p className="mt-2 flex-1 break-words text-sm leading-relaxed text-[#765F55]">{quiz.description || "A short Thai practice quiz."}</p>
                <Link to={`${publicView ? "/practice/general" : "/app/practice/general"}/${encodeURIComponent(quiz.id)}`} aria-label={detailsLinkLabel(quiz, index, quizzes)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 self-start rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A94F00] sm:w-auto">View quiz details <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default GeneralPracticeList
