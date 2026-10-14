import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { createGeneralPracticeDraft, fetchGeneralPracticeQuiz, updateGeneralPracticeDraft } from '../../services/generalPracticeAdminService'
import { ACCESS_LEVELS, CATEGORIES, DIFFICULTIES, draftFromQuiz, draftPayload, emptyDraft, newQuestion, validateDraft } from './generalPracticeDraft'

const inputClass = 'mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 text-sm text-[#2D2E30] outline-none focus:border-[#E58C1A] focus:ring-2 focus:ring-[#E58C1A]/20'
const secondaryClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] hover:bg-[#FFF4D8] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]'

function GeneralPracticeEditor() {
  const { quizId } = useParams()
  const editing = Boolean(quizId)
  const navigate = useNavigate()
  const initialForm = useRef(null)
  if (!initialForm.current) initialForm.current = emptyDraft()
  const [form, setForm] = useState(initialForm.current)
  const [quiz, setQuiz] = useState(null)
  const [baseline, setBaseline] = useState(JSON.stringify(initialForm.current))
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [validationErrors, setValidationErrors] = useState([])
  const [requiresReload, setRequiresReload] = useState(false)
  const savingRef = useRef(false)
  const dirty = JSON.stringify(form) !== baseline
  const mediaPending = quiz?.mediaProcessing === 'retry_required'

  useEffect(() => {
    if (!editing) return undefined
    let active = true
    setLoading(true)
    setError('')
    fetchGeneralPracticeQuiz(quizId)
      .then((item) => {
        if (!active) return
        setQuiz(item)
        const loaded = draftFromQuiz(item)
        setForm(loaded)
        setBaseline(JSON.stringify(loaded))
      })
      .catch((failure) => { if (active) setError(failure.status === 401 || failure.status === 403 ? 'Admin access is required to edit this quiz.' : failure.status === 404 ? 'This quiz was not found.' : failure.message || 'Unable to load the quiz.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [editing, quizId])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const leave = (path) => {
    if (dirty && !window.confirm('Leave this page? Unsaved draft changes will be lost.')) return
    navigate(path)
  }
  const changeQuestion = (index, patch) => setForm((current) => ({ ...current, questions: current.questions.map((question, position) => position === index ? { ...question, ...patch } : question) }))
  const moveQuestion = (index, direction) => setForm((current) => {
    const questions = [...current.questions]
    const [question] = questions.splice(index, 1)
    questions.splice(index + direction, 0, question)
    return { ...current, questions }
  })
  const removeOption = (index, optionIndex) => setForm((current) => ({ ...current, questions: current.questions.map((question, position) => {
    if (position !== index) return question
    const options = question.options.filter((_, choice) => choice !== optionIndex)
    const correctAnswer = question.correctAnswer === optionIndex ? null : question.correctAnswer > optionIndex ? question.correctAnswer - 1 : question.correctAnswer
    return { ...question, options, correctAnswer }
  }) }))

  const reloadLatest = async () => {
    if (!window.confirm('Reload the latest saved draft? Your unsaved changes will be lost.')) return
    try {
      setLoading(true)
      setError('')
      const latest = await fetchGeneralPracticeQuiz(quizId)
      const loaded = draftFromQuiz(latest)
      setQuiz(latest)
      setForm(loaded)
      setBaseline(JSON.stringify(loaded))
      setRequiresReload(false)
      setValidationErrors([])
    } catch (failure) { setError(failure.message || 'Unable to reload the latest draft.') }
    finally { setLoading(false) }
  }

  const save = async (event) => {
    event.preventDefault()
    if (!editing) return
    if (savingRef.current || requiresReload || mediaPending) return
    setSavedMessage('')
    const problems = validateDraft(form)
    setValidationErrors(problems)
    if (problems.length) return
    savingRef.current = true
    setSaving(true)
    setError('')
    const expectedVersion = quiz?.draft?.version ?? 0
    try {
      const result = editing
        ? await updateGeneralPracticeDraft(quizId, expectedVersion, draftPayload(form))
        : await createGeneralPracticeDraft(draftPayload(form))
      const samePublishedRevision = (result?.published?.revision ?? null) === (quiz?.published?.revision ?? null)
      if (result?.contextType !== 'standalone' || !result.id || (editing && result.id !== quizId) || !result.draft || result.draft.version !== (editing ? expectedVersion + 1 : 1) || (editing && !samePublishedRevision) || (!editing && (result.status !== 'draft' || result.published))) {
        setRequiresReload(true)
        setError('The save response could not be confirmed. Check the latest quiz state before trying again.')
        return
      }
      if (!editing) {
        navigate(`/general-practice/${encodeURIComponent(result.id)}/edit`, { replace: true, state: { saved: true } })
        return
      }
      const loaded = draftFromQuiz(result)
      setQuiz(result)
      setForm(loaded)
      setBaseline(JSON.stringify(loaded))
      setSavedMessage(`Draft saved. Version ${result.draft.version}. It has not been published.`)
    } catch (failure) {
      if (failure.status === 409) {
        setRequiresReload(true)
        setError('This quiz changed elsewhere. Your edits remain here. Reload the latest saved draft before making another save.')
      } else if (failure.status === 401 || failure.status === 403) {
        setError('Admin access is required to save this draft. Your edits remain on this page.')
      } else if (!failure.status || failure.status >= 500) {
        setRequiresReload(true)
        setError(editing ? 'The save outcome is uncertain. Your edits remain here; reload the latest saved draft before trying again.' : 'The create outcome is uncertain. Check the General Practice list before creating another quiz.')
      } else {
        setError(failure.message || 'Unable to save this draft. Your edits remain on this page.')
      }
    } finally { savingRef.current = false; setSaving(false) }
  }

  if (!editing) return <main className="min-h-full bg-[#FFFDF8] px-4 pb-16 pt-6 sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl">
    <button type="button" onClick={() => navigate('/general-practice')} className={secondaryClass}><ArrowLeft size={18} aria-hidden="true" /> Back to Quiz Sets</button>
    <div role="status" className="mt-6 rounded-2xl border border-[#E58C1A]/25 bg-[#FFF9EA] p-6">
      <h1 className="text-2xl font-bold text-[#2D2E30]">Quiz creation is not available yet</h1>
      <p className="mt-2 text-sm text-[#765F55]">New quizzes must be created within a Quiz Set. Set-scoped creation will be added in a later step. Existing quiz drafts remain editable.</p>
    </div>
  </div></main>

  return <main className="min-h-full bg-[#FFFDF8] px-4 pb-16 pt-6 sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl">
    <button type="button" onClick={() => leave(editing ? `/general-practice/${encodeURIComponent(quizId)}` : '/general-practice')} className={secondaryClass}><ArrowLeft size={18} aria-hidden="true" /> Back to General Practice</button>
    <header className="mb-6 mt-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">General Practice · Draft editor</p><h1 className="mt-2 text-3xl font-bold text-[#2D2E30] sm:text-4xl">{editing ? 'Edit quiz draft' : 'Create quiz draft'}</h1><p className="mt-2 text-sm text-[#765F55]">Saving a draft does not publish it or change a published revision.</p></header>
    {loading ? <p role="status" className="rounded-2xl bg-white p-8 text-[#765F55]">Loading quiz draft...</p> : editing && !quiz ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error || 'Unable to load this quiz.'}</p> : quiz?.status === 'archived' ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">Archived quizzes cannot be edited.</p> : <form onSubmit={save} noValidate className="space-y-6">
      {quiz?.published ? <p className="rounded-xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-4 text-sm text-[#765F55]">Published revision {quiz.published.revision} stays unchanged until a separate publication action. {quiz.draft ? `You are editing draft version ${quiz.draft.version}.` : 'This save will create draft version 1 from the published content.'}</p> : null}
      {mediaPending ? <p role="status" className="rounded-xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-4 text-sm text-[#765F55]">Media processing must be retried from quiz details before saving another draft. This editor will not repeat the committed operation.</p> : null}
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}{requiresReload && editing ? <button type="button" onClick={reloadLatest} className="ml-2 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">Reload latest saved draft</button> : null}{requiresReload && !editing ? <button type="button" onClick={() => leave('/general-practice')} className="ml-2 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">Check quiz list</button> : null}</div> : null}
      {validationErrors.length > 0 ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-bold">Please fix these fields:</p><ul className="mt-2 list-disc pl-5">{validationErrors.map((problem) => <li key={problem}>{problem}</li>)}</ul></div> : null}
      {savedMessage ? <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{savedMessage}</p> : null}
      <section className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6"><h2 className="text-xl font-bold text-[#2D2E30]">Quiz details</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-bold text-[#2D2E30] sm:col-span-2">Title<input value={form.title} maxLength={140} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} /></label>
        <label className="text-sm font-bold text-[#2D2E30] sm:col-span-2">Description<textarea value={form.description} maxLength={1000} rows={3} onChange={(event) => setForm({ ...form, description: event.target.value })} className={inputClass} /></label>
        <label className="text-sm font-bold text-[#2D2E30]">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={inputClass}><option value="">Choose category</option>{CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm font-bold text-[#2D2E30]">Difficulty<select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })} className={inputClass}><option value="">Choose difficulty</option>{DIFFICULTIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm font-bold text-[#2D2E30] sm:col-span-2">Visibility<select value={form.standaloneAccess} onChange={(event) => setForm({ ...form, standaloneAccess: event.target.value })} className={inputClass}><option value="">Choose visibility</option>{ACCESS_LEVELS.map((value) => <option key={value} value={value}>{value === 'students' ? 'Students Only' : 'Public'}</option>)}</select></label>
      </div></section>
      <section aria-label="Questions" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-[#2D2E30]">Questions ({form.questions.length}/10)</h2><button type="button" disabled={form.questions.length >= 10} onClick={() => setForm((current) => ({ ...current, questions: [...current.questions, newQuestion()] }))} className={`${secondaryClass} disabled:cursor-not-allowed disabled:opacity-50`}><Plus size={18} aria-hidden="true" /> Add question</button></div>
        {form.questions.map((question, index) => <section key={question.localId} aria-label={`Question ${index + 1}`} className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold text-[#2D2E30]">Question {index + 1}</h3><div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)} className={`${secondaryClass} disabled:opacity-50`} aria-label={`Move question ${index + 1} up`}><ArrowUp size={16} aria-hidden="true" /></button><button type="button" disabled={index === form.questions.length - 1} onClick={() => moveQuestion(index, 1)} className={`${secondaryClass} disabled:opacity-50`} aria-label={`Move question ${index + 1} down`}><ArrowDown size={16} aria-hidden="true" /></button><button type="button" disabled={form.questions.length === 1} onClick={() => setForm((current) => ({ ...current, questions: current.questions.filter((_, position) => position !== index) }))} className={`${secondaryClass} disabled:opacity-50`} aria-label={`Remove question ${index + 1}`}><Trash2 size={16} aria-hidden="true" /></button></div></div>
          <label className="mt-5 block text-sm font-bold text-[#2D2E30]">Question text<input value={question.prompt || ''} maxLength={280} onChange={(event) => changeQuestion(index, { prompt: event.target.value })} className={inputClass} /></label>
          {(question.image || question.audio) ? <p className="mt-3 text-xs text-[#765F55]">Existing {question.image ? 'image' : ''}{question.image && question.audio ? ' and ' : ''}{question.audio ? 'audio' : ''} references will be preserved. Media changes are not available here.</p> : null}
          <fieldset className="mt-5"><legend className="text-sm font-bold text-[#2D2E30]">Answer options and correct answer</legend><div className="mt-3 space-y-3">{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-3"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#2D2E30]"><input type="radio" name={`correct-${question.localId}`} checked={question.correctAnswer === optionIndex} onChange={() => changeQuestion(index, { correctAnswer: optionIndex })} className="h-4 w-4 accent-[#E58C1A]" /> Correct</label><label className="min-w-40 flex-1 text-sm font-semibold text-[#2D2E30]">Option {optionIndex + 1}<input value={option} onChange={(event) => changeQuestion(index, { options: question.options.map((value, position) => position === optionIndex ? event.target.value : value) })} className={inputClass} /></label><button type="button" disabled={question.options.length <= 2} onClick={() => removeOption(index, optionIndex)} className={`${secondaryClass} disabled:opacity-50`} aria-label={`Remove option ${optionIndex + 1} from question ${index + 1}`}><Trash2 size={16} aria-hidden="true" /></button></div>)}</div><button type="button" disabled={question.options.length >= 6} onClick={() => changeQuestion(index, { options: [...question.options, ''] })} className={`${secondaryClass} mt-3 disabled:opacity-50`}><Plus size={16} aria-hidden="true" /> Add option</button></fieldset>
          <label className="mt-5 block text-sm font-bold text-[#2D2E30]">Explanation (optional)<textarea value={question.explanation || ''} maxLength={2000} rows={3} onChange={(event) => changeQuestion(index, { explanation: event.target.value })} className={inputClass} /></label>
        </section>)}
      </section>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving || requiresReload || mediaPending} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2D2E30] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Save draft'}</button><button type="button" onClick={() => leave(editing ? `/general-practice/${encodeURIComponent(quizId)}` : '/general-practice')} className={secondaryClass}>Cancel</button></div>
    </form>}
  </div></main>
}

export default GeneralPracticeEditor
