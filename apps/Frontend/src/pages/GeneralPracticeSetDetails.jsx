import { useEffect, useState } from "react"
import { ArrowLeft, BookOpenText, Globe, LockKeyhole, LogIn, RefreshCw } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import { useAuth } from "../contexts/AuthContext"
import { fetchGeneralPracticeSet } from "../services/generalPracticeService"

function QuizAction({ quiz, setId, publicView }) {
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const context = `?setId=${encodeURIComponent(setId)}`
  const studentDestination = `/app/practice/general/${encodeURIComponent(quiz.id)}${context}`
  const publicDestination = `/practice/general/${encodeURIComponent(quiz.id)}${context}`
  const className = "mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#E58C1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] sm:w-auto"
  if (!publicView) return <Link className={className} to={studentDestination} aria-label={`View details for ${quiz.title}`}>View Quiz</Link>
  if (isBootstrapping) return <p role="status" className="mt-4 text-sm text-[#765F55]">Checking your account...</p>
  if (quiz.standaloneAccess === "students") {
    if (isAuthenticated && user?.role === "user") return <Link className={className} to={studentDestination} aria-label={`View details for ${quiz.title}`}>View Quiz</Link>
    if (isAuthenticated) return <p className="mt-4 text-sm text-[#765F55]">Use a student account to view this quiz.</p>
    return <Link className={className} to="/login" state={{ from: { pathname: studentDestination } }} aria-label={`Log in to view ${quiz.title}`}><LogIn className="h-4 w-4" aria-hidden="true" />Log in to view quiz</Link>
  }
  return <Link className={className} to={publicDestination} aria-label={`View details for ${quiz.title}`}>View Quiz</Link>
}

function GeneralPracticeSetDetails({ publicView = false }) {
  const { setId } = useParams()
  const catalog = publicView ? "/practice/general" : "/app/practice/general"
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [unavailable, setUnavailable] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (!active) return null
      setLoading(true)
      setData(null)
      setError("")
      setUnavailable(false)
      setImageFailed(false)
      return fetchGeneralPracticeSet(setId)
    })
      .then((response) => {
        if (!active) return
        if (!response?.set || !Array.isArray(response.quizzes)) throw new Error("Invalid Quiz Set response")
        setData(response)
      })
      .catch((requestError) => {
        if (!active) return
        setUnavailable(requestError.status === 404)
        setError(requestError.status === 404 ? "This Quiz Set is no longer available." : !publicView && requestError.status === 401
          ? "Your session has expired. Please sign in again." : "We couldn't load this Quiz Set. Please try again.")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [publicView, retryKey, setId])

  return <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
    <Link to={catalog} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#C97112] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to General Practice</Link>
    <div className="mt-3" aria-busy={loading}>
      {loading ? <LoadingSpinner message="Loading Quiz Set..." /> : error ? <section role="alert" className="rounded-2xl border border-[#2D2E30]/10 bg-white p-6 sm:p-8"><h1 className="text-xl font-bold">Quiz Set unavailable</h1><p className="mt-2 text-sm text-[#765F55]">{error}</p>{!unavailable ? <button type="button" onClick={() => { setLoading(true); setRetryKey((value) => value + 1) }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#2D2E30]/15 px-5 py-3 text-sm font-bold text-[#765F55] hover:bg-[#FFF9EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button> : null}</section> : data ? <>
        <header className="grid min-w-0 gap-5 rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-sm sm:p-7 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:items-center md:gap-7">
          {data.set.coverImage && !imageFailed ? <img src={data.set.coverImage} alt={`${data.set.name} cover image`} onError={() => setImageFailed(true)} className="aspect-[16/9] w-full rounded-xl object-cover md:aspect-[4/3]" /> : <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl bg-[#FFF1D0] text-[#A94F00] md:aspect-[4/3]" aria-hidden="true"><BookOpenText className="h-10 w-10" /><span className="text-xs font-bold uppercase tracking-wider">Thai Practice</span></div>}
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-accent">General Practice Quiz Set</p>
            <h1 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">{data.set.name}</h1>
            {data.set.description ? <p className="mt-3 break-words text-sm leading-relaxed text-[#765F55] sm:text-base">{data.set.description}</p> : null}
            {data.set.difficulty ? <p className="mt-4 text-sm font-semibold text-[#765F55]">Level: <span className="rounded-full bg-[#FFF1D0] px-3 py-1 text-[#8C4500]">{data.set.difficulty}</span></p> : null}</div>
        </header>
        <section className="mt-7" aria-labelledby="set-quizzes-heading">
          <h2 id="set-quizzes-heading" className="text-2xl font-bold">Quizzes</h2>
          {data.quizzes.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-[#D9CEBE] bg-white px-6 py-10 text-center"><h3 className="text-lg font-bold">Quizzes coming soon</h3><p className="mt-2 text-sm text-[#765F55]">Check back for new practice activities.</p></div> : <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.quizzes.map((quiz) => <article key={quiz.id} className="flex min-w-0 flex-col rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-sm">
            <div className="min-w-0 flex-1"><h3 className="break-words text-lg font-bold">{quiz.title}</h3>
              {quiz.description ? <p className="mt-2 break-words text-sm leading-relaxed text-[#765F55]">{quiz.description}</p> : null}</div>
            <div className="mt-4 flex flex-wrap items-center gap-2">{quiz.category ? <span className="inline-flex rounded-full border border-[#2D2E30]/10 bg-[#F6F3EE] px-2.5 py-1 text-sm font-semibold text-[#514A43]">{quiz.category}</span> : null}{quiz.difficulty ? <span className="inline-flex rounded-full border border-[#EFD9A7] bg-[#FFF6DE] px-2.5 py-1 text-sm font-semibold text-[#8C4500]">{quiz.difficulty}</span> : null}
            {quiz.standaloneAccess === "public" ? <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CDE8D3] bg-[#EDF8EE] px-2.5 py-1 text-sm font-semibold text-[#246B35]"><Globe className="h-3.5 w-3.5" aria-hidden="true" />Public</span> : quiz.standaloneAccess === "students" ? <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2D2E30]/15 bg-[#F6F3EE] px-2.5 py-1 text-sm font-semibold text-[#514A43]"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />Students Only</span> : <span className="text-sm text-[#765F55]">Access unavailable</span>}</div>
            {quiz.standaloneAccess === "public" || quiz.standaloneAccess === "students" ? <QuizAction quiz={quiz} setId={setId} publicView={publicView} /> : null}
          </article>)}</div>}
        </section>
      </> : null}
    </div>
  </div>
}

export default GeneralPracticeSetDetails
