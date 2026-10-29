import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Plus } from 'lucide-react'
import { fetchGeneralPracticeSet, isSafeQuizSetCoverImage, updateGeneralPracticeSet, uploadGeneralPracticeSetCover, removeGeneralPracticeSetCover } from '../../services/generalPracticeAdminService'
import GeneralPracticeSetForm from './GeneralPracticeSetForm'
import GeneralPracticeSetActions from './GeneralPracticeSetActions'
import GeneralPracticeSetCover from './GeneralPracticeSetCover'

const statusStyles = {
  active: 'bg-[#EDF8EE] text-[#246B35]',
  disabled: 'bg-[#FFF0EE] text-[#A34D45]',
  archived: 'bg-slate-100 text-slate-600',
  draft: 'bg-[#FFF9EA] text-[#9A5816]',
  published: 'bg-[#EDF8EE] text-[#246B35]',
}

function GeneralPracticeSetDetails() {
  const { setId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState(location.state?.mediaCleanupRetryRequired
    ? 'Quiz Set saved. The previous cover could not be removed immediately; cleanup will need an operator retry.'
    : location.state?.coverUploadUncertain
    ? 'Quiz Set was created in Disabled status. Cover upload could not be confirmed. Check the current cover before trying again.'
    : location.state?.created ? 'Quiz Set created in Disabled status. It is not available to learners.' : '')

  async function reload() {
    const latest = await fetchGeneralPracticeSet(setId)
    setDetails(latest)
    return latest
  }

  async function save(fields, expectedVersion, { file, remove } = {}) {
    const updated = await updateGeneralPracticeSet(setId, expectedVersion, fields)
    if (updated.id !== setId || updated.version !== expectedVersion + 1) throw new Error('The Set update could not be confirmed.')
    let finalSet = updated
    let cleanupWarning = false
    if (file || remove) {
      try {
        const coverResult = file ? await uploadGeneralPracticeSetCover(setId, updated.version, file)
          : await removeGeneralPracticeSetCover(setId, updated.version)
        finalSet = coverResult.set
        cleanupWarning = coverResult.mediaCleanup === 'retry_required'
      } catch {
        await reload().catch(() => setDetails((current) => ({ ...current, set: updated })))
        setEditing(false)
        setNotice('Set metadata was saved, but the cover change could not be confirmed. Check the displayed cover before trying again.')
        return
      }
    }
    setDetails((current) => ({ ...current, set: finalSet }))
    setEditing(false)
    setNotice(cleanupWarning
      ? 'Quiz Set saved. The previous cover could not be removed immediately; cleanup will need an operator retry.'
      : 'Quiz Set details saved. Its lifecycle status is unchanged.')
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetchGeneralPracticeSet(setId)
      .then((item) => { if (active) setDetails(item) })
      .catch((failure) => {
        if (active) setError(failure.status === 401 || failure.status === 403
          ? 'Admin access is required to view this Quiz Set.'
          : failure.status === 404 ? 'This Quiz Set was not found.'
            : failure.message || 'Unable to load this Quiz Set.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [setId])

  const set = details?.set
  return <main className="min-h-full bg-[#FFFDF8] px-4 pb-10 pt-6 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-5xl">
      {!editing ? <Link to="/general-practice" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:text-[#C97112] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]"><ArrowLeft size={18} aria-hidden="true" /> Back to Quiz Sets</Link> : null}
      {notice ? <p role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p> : null}
      {loading ? <p role="status" className="mt-5 rounded-2xl border border-[#2D2E30]/10 bg-white p-8 text-[#765F55]">Loading Quiz Set...</p>
        : error ? <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</p>
          : <>
            <header className="mb-6 mt-4 grid gap-5 rounded-2xl border border-[#2D2E30]/10 bg-white p-5 sm:p-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-center lg:gap-7">
              <GeneralPracticeSetCover src={isSafeQuizSetCoverImage(set.coverImage) ? set.coverImage : ''} alt={`Cover for ${set.name}`} className="max-w-md rounded-xl" />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">General Practice · Quiz Set</p>
                <h1 className="mt-2 break-words text-3xl font-bold text-[#2D2E30] sm:text-4xl">{set.name}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#765F55]">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusStyles[set.status]}`}>Set: {set.status}</span>
                  <span>{set.difficulty || 'All levels'}</span><span>·</span><span>Display order {set.displayOrder}</span>
                </div>
                {set.description ? <p className="mt-4 whitespace-pre-wrap break-words text-sm text-[#765F55]">{set.description}</p> : null}
                {!editing ? <button type="button" onClick={() => setEditing(true)} className="mt-4 min-h-11 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] hover:bg-[#FFF4D8] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">Edit Set details</button> : null}
              </div>
            </header>
            {editing ? <div className="mb-6"><GeneralPracticeSetForm title="Edit Quiz Set" set={set} onSave={save} onCancel={() => setEditing(false)} onReload={async () => { if (!window.confirm('Reload the latest Set? Unsaved edits will be lost.')) return null; return (await reload()).set }} /></div>
              : <GeneralPracticeSetActions set={set} quizCount={details.quizzes.length} onChange={(updated) => setDetails((current) => ({ ...current, set: updated }))} onReload={reload} onDelete={(result) => navigate('/general-practice', { replace: true,
                state: { mediaCleanupRetryRequired: result?.mediaCleanup === 'retry_required' } })} />}
            <section aria-label="Quizzes in this Set">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-[#2D2E30]">Quizzes ({details.quizzes.length})</h2>{set.status !== 'archived' ? <Link to={`/general-practice/sets/${encodeURIComponent(set.id)}/quizzes/new`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2"><Plus size={18} aria-hidden="true" /> Create Quiz</Link> : null}</div>
              {details.quizzes.length === 0 ? <div className="rounded-2xl border border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] p-8 text-center">
                <BookOpen size={32} aria-hidden="true" className="mx-auto text-[#C97112]" />
                <h3 className="mt-3 text-lg font-bold text-[#2D2E30]">{set.status === 'active' ? 'Quizzes coming soon' : 'No quizzes in this Set'}</h3>
                <p className="mt-2 text-sm text-[#765F55]">Create a draft quiz to add it to this Set.</p>
              </div> : <div className="space-y-3">{details.quizzes.map((quiz) => <article key={quiz.id} className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusStyles[quiz.status]}`}>Quiz: {quiz.status}</span>
                  <span className="text-xs text-[#765F55]">Order {quiz.sortOrder}</span>
                </div>
                <h3 className="mt-3 break-words text-lg font-bold text-[#2D2E30]">{quiz.title || 'Untitled quiz'}</h3>
                <p className="mt-2 text-sm text-[#765F55]">Signed-in students · {quiz.category || 'No category'} · {quiz.difficulty || 'No difficulty'}</p>
                <p className="mt-2 text-xs text-[#765F55]">Published revision: {quiz.publishedRevision ?? 'None'} · Draft version: {quiz.draftVersion ?? 'None'}</p>
                <Link to={`/general-practice/${encodeURIComponent(quiz.id)}`} state={{ fromSet: { id: set.id, name: set.name } }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] hover:bg-[#FFF4D8] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]" aria-label={`View details for ${quiz.title || 'Untitled quiz'}`}>View quiz <ArrowRight size={17} aria-hidden="true" /></Link>
              </article>)}</div>}
            </section>
          </>}
    </div>
  </main>
}

export default GeneralPracticeSetDetails
