import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { fetchGeneralPracticeQuiz } from '../../services/generalPracticeAdminService'
import GeneralPracticePreview from './GeneralPracticePreview'
import GeneralPracticeManagementPanel from './GeneralPracticeManagementPanel'

function ContentSummary({ label, content }) {
  if (!content) return null
  return <section className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6">
    <h2 className="text-lg font-bold text-[#2D2E30]">{label}</h2>
    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="font-semibold text-[#765F55]">Title</dt><dd className="mt-1 break-words text-[#2D2E30]">{content.title || 'Untitled quiz'}</dd></div>
      <div><dt className="font-semibold text-[#765F55]">Access</dt><dd className="mt-1 text-[#2D2E30]">Signed-in students</dd></div>
      <div><dt className="font-semibold text-[#765F55]">Category</dt><dd className="mt-1 text-[#2D2E30]">{content.category || 'Not set'}</dd></div>
      <div><dt className="font-semibold text-[#765F55]">Difficulty</dt><dd className="mt-1 text-[#2D2E30]">{content.difficulty || 'Not set'}</dd></div>
      <div className="sm:col-span-2"><dt className="font-semibold text-[#765F55]">Description</dt><dd className="mt-1 whitespace-pre-wrap break-words text-[#2D2E30]">{content.description || 'No description'}</dd></div>
      <div><dt className="font-semibold text-[#765F55]">Questions</dt><dd className="mt-1 text-[#2D2E30]">{content.questions?.length ?? 0}</dd></div>
      <div><dt className="font-semibold text-[#765F55]">{label === 'Published revision' ? 'Revision' : 'Draft version'}</dt><dd className="mt-1 text-[#2D2E30]">{label === 'Published revision' ? content.revision : content.version}</dd></div>
    </dl>
  </section>
}

function GeneralPracticeDetails() {
  const { quizId } = useParams()
  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewKind, setPreviewKind] = useState('published')

  useEffect(() => {
    let active = true
    fetchGeneralPracticeQuiz(quizId)
      .then((item) => { if (active) setQuiz(item) })
      .catch((failure) => { if (active) setError(failure.status === 401 || failure.status === 403 ? 'Admin access is required to view this quiz.' : failure.status === 404 ? 'This General Practice quiz was not found.' : failure.message || 'Unable to load this General Practice quiz.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [quizId])

  const activePreview = quiz?.draft && (previewKind === 'draft' || !quiz.published) ? 'draft' : 'published'
  const persistedSetId = typeof quiz?.quizSetId === 'string' && /^[0-9a-f]{24}$/i.test(quiz.quizSetId) ? quiz.quizSetId : null
  // A legacy standalone quiz without persisted membership returns to the quiz catalog.
  const setBackPath = persistedSetId ? `/general-practice/sets/${encodeURIComponent(persistedSetId)}` : null

  return <main className="min-h-full bg-[#FFFDF8] px-4 pb-10 pt-6 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-5xl">
      <Link to={setBackPath || '/general-practice/quizzes'} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:text-[#C97112] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]"><ArrowLeft size={18} aria-hidden="true" /> {setBackPath ? 'Back to Quiz Set' : 'Back to quizzes'}</Link>
      {loading ? <p role="status" className="mt-5 rounded-2xl border border-[#2D2E30]/10 bg-white p-8 text-[#765F55]">Loading quiz details...</p>
        : error ? <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
          : <>
            <header className="mb-6 mt-4"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">General Practice · Admin details</p><h1 className="mt-2 break-words text-3xl font-bold text-[#2D2E30] sm:text-4xl">{quiz.published?.title || quiz.draft?.title || 'Untitled quiz'}</h1><p className="mt-2 text-sm font-semibold capitalize text-[#765F55]">Status: {quiz.status}</p>{quiz.status !== 'archived' && quiz.mediaProcessing !== 'retry_required' ? <Link to={`/general-practice/${encodeURIComponent(quiz.id)}/edit`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2">Edit draft</Link> : null}</header>
            <GeneralPracticeManagementPanel quiz={quiz} onQuizChange={setQuiz} />
            <div className="space-y-4"><ContentSummary label="Published revision" content={quiz.published} /><ContentSummary label="Unpublished draft" content={quiz.draft} /></div>
            <div className="mb-4 mt-7 flex flex-wrap gap-2" aria-label="Preview revision">
              {quiz.published ? <button type="button" onClick={() => setPreviewKind('published')} aria-pressed={activePreview === 'published'} className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E58C1A] ${activePreview === 'published' ? 'bg-[#2D2E30] text-white' : 'border border-[#2D2E30]/15 bg-white text-[#2D2E30]'}`}>Published Preview</button> : null}
              {quiz.draft ? <button type="button" onClick={() => setPreviewKind('draft')} aria-pressed={activePreview === 'draft'} className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E58C1A] ${activePreview === 'draft' ? 'bg-[#2D2E30] text-white' : 'border border-[#2D2E30]/15 bg-white text-[#2D2E30]'}`}>Draft Preview</button> : null}
            </div>
            <GeneralPracticePreview kind={activePreview} content={activePreview === 'draft' ? quiz.draft : quiz.published} />
          </>}
    </div>
  </main>
}

export default GeneralPracticeDetails
