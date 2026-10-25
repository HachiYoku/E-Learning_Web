import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react'
import { fetchGeneralPracticeQuizzes } from '../../services/generalPracticeAdminService'

const statusStyles = {
  draft: 'bg-[#FFF9EA] text-[#9A5816]',
  published: 'bg-[#EDF8EE] text-[#246B35]',
  disabled: 'bg-[#FFF0EE] text-[#A34D45]',
  archived: 'bg-slate-100 text-slate-600',
}

function titleOf(quiz) {
  return quiz.published?.title || quiz.draft?.title || 'Untitled quiz'
}

function GeneralPracticeList() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchGeneralPracticeQuizzes()
      .then((items) => { if (active) setQuizzes(items) })
      .catch((failure) => { if (active) setError(failure.status === 401 || failure.status === 403 ? 'Admin access is required to view General Practice quizzes.' : failure.message || 'Unable to load General Practice quizzes.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return <main className="min-h-full bg-[#FFFDF8] px-4 pb-10 pt-6 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-7xl">
      <Link to="/general-practice" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:text-[#C97112] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]"><ArrowLeft size={18} aria-hidden="true" /> Back to Quiz Sets</Link>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Assessment library</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">General Practice</h1>
          <p className="mt-2 text-[#765F55]">Review standalone quiz drafts and published revisions.</p></div>
      </header>

      <p className="mb-5 rounded-xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-4 text-sm text-[#765F55]">New quizzes must be created within a Quiz Set. Set-scoped creation is not available in Admin yet.</p>

      {loading ? <p role="status" className="rounded-2xl border border-[#2D2E30]/10 bg-white p-8 text-[#765F55]">Loading General Practice quizzes...</p>
        : error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
          : quizzes.length === 0 ? <section className="rounded-2xl border border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] p-8 text-center"><BookOpen size={32} aria-hidden="true" className="mx-auto text-[#C97112]" /><h2 className="mt-3 text-xl font-bold text-[#2D2E30]">No General Practice quizzes yet</h2><p className="mt-2 text-[#765F55]">Quizzes created within a Set will appear here.</p></section>
            : <section aria-label="General Practice quizzes" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {quizzes.map((quiz) => {
                const content = quiz.published || quiz.draft || {}
                return <article key={quiz.id} className="flex min-w-0 flex-col rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[quiz.status] || 'bg-slate-100 text-slate-600'}`}>{quiz.status || 'Unknown'}</span>
                    <span className="rounded-full bg-[#FFF1CE] px-2.5 py-1 text-xs font-semibold text-[#9A5816]">Signed-in students{!quiz.published && quiz.draft ? ' (draft)' : ''}</span>
                  </div>
                  <h2 className="mt-4 break-words text-lg font-bold text-[#2D2E30]">{titleOf(quiz)}</h2>
                  {quiz.draft && quiz.published && quiz.draft.title !== quiz.published.title ? <p className="mt-1 text-sm text-[#765F55]">Unpublished draft: {quiz.draft.title}</p> : null}
                  <p className="mt-2 text-sm text-[#765F55]">{content.category || 'No category'} · {content.difficulty || 'No difficulty'}</p>
                  <p className="mt-2 text-xs text-[#765F55]">Published revision: {quiz.published?.revision ?? 'None'} · Draft version: {quiz.draft?.version ?? 'None'}</p>
                  <div className="mt-5 flex flex-wrap gap-2"><Link to={`/general-practice/${encodeURIComponent(quiz.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] transition hover:bg-[#FFF4D8] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]" aria-label={`View details for ${titleOf(quiz)}`}>View details <ChevronRight size={17} aria-hidden="true" /></Link>{quiz.status !== 'archived' && quiz.mediaProcessing !== 'retry_required' ? <Link to={`/general-practice/${encodeURIComponent(quiz.id)}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2" aria-label={`Edit draft for ${titleOf(quiz)}`}>Edit draft</Link> : null}</div>
                </article>
              })}
            </section>}
    </div>
  </main>
}

export default GeneralPracticeList
