import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, BookOpen, Plus } from 'lucide-react'
import { fetchGeneralPracticeSets, isSafeQuizSetCoverImage } from '../../services/generalPracticeAdminService'
import GeneralPracticeSetCover from './GeneralPracticeSetCover'

const statusStyles = {
  active: 'bg-[#EDF8EE] text-[#246B35]',
  disabled: 'bg-[#FFF0EE] text-[#A34D45]',
  archived: 'bg-slate-100 text-slate-600',
}

function GeneralPracticeSetList() {
  const location = useLocation()
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchGeneralPracticeSets()
      .then((items) => { if (active) setSets(items) })
      .catch((failure) => {
        if (active) setError(failure.status === 401 || failure.status === 403
          ? 'Admin access is required to view Quiz Sets.'
          : failure.message || 'Unable to load Quiz Sets.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return <main className="min-h-full bg-[#FFFDF8] px-4 pb-10 pt-6 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Assessment library</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">General Practice Quiz Sets</h1>
          <p className="mt-2 text-[#765F55]">Manage Quiz Sets and create draft quizzes within each Set.</p>
        </div>
        <Link to="/general-practice/sets/new" className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2"><Plus size={18} aria-hidden="true" /> Create Quiz Set</Link>
      </header>

      {location.state?.mediaCleanupRetryRequired ? <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Quiz Set deleted. Its previous cover could not be removed immediately; cleanup will need an operator retry.</p> : null}

      {loading ? <p role="status" className="rounded-2xl border border-[#2D2E30]/10 bg-white p-8 text-[#765F55]">Loading Quiz Sets...</p>
        : error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</p>
          : sets.length === 0 ? <section className="rounded-2xl border border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] p-8 text-center">
            <BookOpen size={32} aria-hidden="true" className="mx-auto text-[#C97112]" />
            <h2 className="mt-3 text-xl font-bold text-[#2D2E30]">No Quiz Sets yet</h2>
            <p className="mt-2 text-[#765F55]">Create a Set to organize General Practice quizzes.</p>
          </section>
            : <section aria-label="General Practice Quiz Sets" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sets.map((set) => <article key={set.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)]">
                <GeneralPracticeSetCover src={isSafeQuizSetCoverImage(set.coverImage) ? set.coverImage : ''} alt={`Cover for ${set.name}`} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusStyles[set.status]}`}>{set.status}</span>
                    <span className="text-xs text-[#765F55]">Order {set.displayOrder}</span>
                  </div>
                  <h2 className="mt-4 break-words text-lg font-bold text-[#2D2E30]">{set.name}</h2>
                  {set.description ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-[#765F55]">{set.description}</p> : null}
                  <p className="mt-2 text-sm text-[#765F55]">{set.difficulty || 'All levels'}</p>
                  <Link to={`/general-practice/sets/${encodeURIComponent(set.id)}`} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] hover:bg-[#FFF4D8] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]" aria-label={`View Quiz Set ${set.name}`}>View Set <ArrowRight size={17} aria-hidden="true" /></Link>
                </div>
              </article>)}
            </section>}
      <Link to="/general-practice/quizzes" className="mt-6 inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-[#765F55] underline-offset-2 hover:text-[#C97112] hover:underline focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">View existing quiz management</Link>
    </div>
  </main>
}

export default GeneralPracticeSetList
