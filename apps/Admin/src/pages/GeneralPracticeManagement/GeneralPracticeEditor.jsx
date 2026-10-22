import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { createGeneralPracticeSetDraft, fetchGeneralPracticeQuiz, fetchGeneralPracticeSet, updateGeneralPracticeDraft } from '../../services/generalPracticeAdminService'
import { ACCESS_LEVELS, CATEGORIES, DIFFICULTIES, draftFromQuiz, draftPayload, emptyDraft, newQuestion, validateDraft } from './generalPracticeDraft'
import { useAuth } from '../../contexts/AuthContext'
import { browserCreationStorage, clearCreation, creationStorageKey, readCreation, uuidV4, writeCreation } from './generalPracticeCreationRecovery'

const inputClass = 'mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 text-sm text-[#2D2E30] outline-none focus:border-[#E58C1A] focus:ring-2 focus:ring-[#E58C1A]/20'
const secondaryClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] hover:bg-[#FFF4D8] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]'

function GeneralPracticeEditor() {
  const { quizId, setId } = useParams()
  const editing = Boolean(quizId)
  const creating = !editing && Boolean(setId)
  const setPath = `/general-practice/sets/${encodeURIComponent(setId || '')}`
  const navigate = useNavigate()
  const { user } = useAuth()
  const adminId = typeof user?.id === 'string' ? user.id.toLowerCase() : String(user?.id || '').toLowerCase()
  const storageKey = creating ? creationStorageKey(adminId, setId) : null
  const creationStorage = browserCreationStorage()
  const initialForm = useRef(null)
  if (!initialForm.current) initialForm.current = emptyDraft()
  const [form, setForm] = useState(initialForm.current)
  const [quiz, setQuiz] = useState(null)
  const [parentSet, setParentSet] = useState(null)
  const [baseline, setBaseline] = useState(JSON.stringify(initialForm.current))
  const [loading, setLoading] = useState(editing || creating)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [validationErrors, setValidationErrors] = useState([])
  const [requiresReload, setRequiresReload] = useState(false)
  const [creationOperation, setCreationOperation] = useState(null)
  const [recoveryState, setRecoveryState] = useState('checking')
  const [confirmedCreationId, setConfirmedCreationId] = useState(null)
  const savingRef = useRef(false)
  const currentStorageKey = useRef(storageKey)
  currentStorageKey.current = storageKey
  const activeCreationOperation = creationOperation?.adminId === adminId && creationOperation?.setId === setId?.toLowerCase() ? creationOperation : null
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
    if (!creating) return undefined
    const recovered = readCreation(creationStorage, storageKey)
    setCreationOperation(null)
    setRecoveryState(recovered.state)
    if (recovered.operation) {
      setCreationOperation(recovered.operation)
      const restored = draftFromQuiz({ draft: recovered.operation.draft })
      setForm(restored)
      setBaseline(JSON.stringify(restored))
    } else {
      const blank = emptyDraft()
      setForm(blank)
      setBaseline(JSON.stringify(blank))
    }
    if (!/^[0-9a-f]{24}$/i.test(setId)) {
      setError('This Quiz Set link is invalid.')
      setLoading(false)
      return undefined
    }
    let active = true
    setLoading(true)
    setParentSet(null)
    setError('')
    fetchGeneralPracticeSet(setId)
      .then(({ set }) => {
        if (!active) return
        if (set.id.toLowerCase() !== setId.toLowerCase()) setError('The Quiz Set response does not match this page. Return to the catalog before creating a quiz.')
        else {
          setParentSet(set)
          if (set.status === 'archived') setError('Archived Quiz Sets cannot accept new quizzes.')
        }
      })
      .catch((failure) => { if (active) setError(failure.status === 401 || failure.status === 403 ? 'Admin access is required to create a quiz.' : failure.status === 404 ? 'This Quiz Set was not found.' : failure.message || 'Unable to load this Quiz Set.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [creating, setId, storageKey])

  useEffect(() => {
    if (confirmedCreationId || (!dirty && !(creating && (saving || activeCreationOperation || recoveryState === 'corrupt')))) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [confirmedCreationId, creating, activeCreationOperation, dirty, recoveryState, saving])

  const leave = (path) => {
    if (creating && savingRef.current) return
    if (confirmedCreationId) { navigate(path); return }
    if (creating && activeCreationOperation && !window.confirm('This Quiz may already have been created. Leaving keeps the same request available in this tab, but does not resolve its outcome. Leave now?')) return
    if (dirty && !activeCreationOperation && !window.confirm('Leave this page? Unsaved draft changes will be lost.')) return
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

  const confirmedCreate = (result, operation) => /^[0-9a-f]{24}$/i.test(result?.id || '')
    && result.quizSetId?.toLowerCase() === operation.setId && result.status === 'draft'
    && Number.isSafeInteger(result.sortOrder) && result.sortOrder >= 1
    && result.draft?.version === 1 && Array.isArray(result.draft.questions)

  const dispatchCreate = async (operation) => {
    if (savingRef.current || operation.adminId !== adminId || operation.setId !== setId?.toLowerCase() || confirmedCreationId) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const result = await createGeneralPracticeSetDraft(operation.setId, operation.creationRequestId, operation.draft)
      if (currentStorageKey.current !== storageKey) return
      if (!confirmedCreate(result, operation)) {
        const uncertain = { ...operation, status: 'uncertain' }
        setCreationOperation(uncertain)
        if (!writeCreation(creationStorage, storageKey, uncertain)) setRecoveryState('unavailable')
        setError('The creation response could not be verified. This Quiz may already exist. Check the Set quiz list or deliberately retry the same request.')
        return
      }
      setConfirmedCreationId(result.id)
      if (!clearCreation(creationStorage, storageKey)) {
        setError('Quiz creation was confirmed, but browser recovery data could not be cleared. Do not submit again; check the Set quiz list.')
        return
      }
      setCreationOperation(null)
      setBaseline(JSON.stringify(form))
      navigate(`/general-practice/${encodeURIComponent(result.id)}`, { replace: true, state: { created: true } })
    } catch (failure) {
      if (currentStorageKey.current !== storageKey) return
      if ([400, 401, 403, 404].includes(failure.status)) {
        if (clearCreation(creationStorage, storageKey)) {
          setCreationOperation(null)
          setError(failure.status === 400 ? failure.message || 'Correct the draft and try again.' : failure.status === 404 ? 'This Quiz Set is no longer available.' : 'Admin access is required to create this quiz.')
        } else {
          setRecoveryState('unavailable')
          setError('The request was rejected, but browser recovery data could not be cleared. Do not start another creation.')
        }
      } else {
        const next = { ...operation, status: failure.status === 409 ? 'conflict' : 'uncertain' }
        setCreationOperation(next)
        if (!writeCreation(creationStorage, storageKey, next)) setRecoveryState('unavailable')
        setError(failure.status === 409
          ? 'This creation request conflicts with an existing operation. Do not create another Quiz; investigate the Set quiz list.'
          : 'We could not confirm whether your Quiz was created. Check the Set quiz list before trying again, or deliberately retry the same request.')
      }
    } finally { savingRef.current = false; setSaving(false) }
  }

  const abandonCreate = () => {
    if (savingRef.current || !window.confirm('This Quiz may already exist. Abandoning recovery will discard this request ID and cannot undo a created Quiz. Abandon it?')) return
    if (!clearCreation(creationStorage, storageKey)) {
      setRecoveryState('unavailable')
      setError('Unable to clear the recovery record. Do not start another creation.')
      return
    }
    setCreationOperation(null)
    setRecoveryState('empty')
    setError('Recovery was abandoned. Check the Set quiz list before creating another Quiz.')
  }

  const save = async (event) => {
    event.preventDefault()
    if (!editing && !creating) return
    if (creating && (!parentSet || parentSet.id.toLowerCase() !== setId.toLowerCase() || parentSet.status === 'archived')) return
    if (savingRef.current || requiresReload || mediaPending || (creating && (activeCreationOperation || recoveryState !== 'empty' || confirmedCreationId))) return
    setSavedMessage('')
    const problems = validateDraft(form)
    setValidationErrors(problems)
    if (problems.length) return
    if (creating) {
      let creationRequestId
      try { creationRequestId = globalThis.crypto?.randomUUID?.() } catch { creationRequestId = null }
      if (!creationRequestId || !uuidV4.test(creationRequestId)) {
        setError('Secure request ID generation is unavailable. Quiz creation is blocked in this browser.')
        return
      }
      const operation = { version: 1, adminId, setId: parentSet.id.toLowerCase(), creationRequestId,
        draft: draftPayload(form), status: 'pending' }
      if (!writeCreation(creationStorage, storageKey, operation)) {
        setRecoveryState('unavailable')
        setError('Browser session storage is unavailable. Quiz creation is blocked to protect recovery.')
        return
      }
      setCreationOperation(operation)
      await dispatchCreate(operation)
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    const expectedVersion = quiz?.draft?.version ?? 0
    try {
      const result = await updateGeneralPracticeDraft(quizId, expectedVersion, draftPayload(form))
      const samePublishedRevision = (result?.published?.revision ?? null) === (quiz?.published?.revision ?? null)
      const confirmed = result?.contextType === 'standalone' && result.id === quizId && result.draft?.version === expectedVersion + 1 && samePublishedRevision
      if (!confirmed) {
        setRequiresReload(true)
        setError('The save response could not be confirmed. Check the latest quiz state before trying again.')
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
        setError('The save outcome is uncertain. Your edits remain here; reload the latest saved draft before trying again.')
      } else {
        setError(failure.message || 'Unable to save this draft. Your edits remain on this page.')
      }
    } finally { savingRef.current = false; setSaving(false) }
  }

  if (!editing && !creating) return <main className="min-h-full bg-[#FFFDF8] px-4 pb-16 pt-6 sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl">
    <button type="button" onClick={() => navigate('/general-practice')} className={secondaryClass}><ArrowLeft size={18} aria-hidden="true" /> Back to Quiz Sets</button>
    <div role="status" className="mt-6 rounded-2xl border border-[#E58C1A]/25 bg-[#FFF9EA] p-6">
      <h1 className="text-2xl font-bold text-[#2D2E30]">Choose a Quiz Set to create a quiz</h1>
      <p className="mt-2 text-sm text-[#765F55]">Open a Quiz Set and select Create Quiz. Existing quiz drafts remain editable.</p>
    </div>
  </div></main>

  return <main className="min-h-full bg-[#FFFDF8] px-4 pb-16 pt-6 sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl">
    <button type="button" disabled={creating && saving} onClick={() => leave(editing ? `/general-practice/${encodeURIComponent(quizId)}` : setPath)} className={`${secondaryClass} disabled:cursor-not-allowed disabled:opacity-50`}><ArrowLeft size={18} aria-hidden="true" /> {editing ? 'Back to General Practice' : 'Back to Quiz Set'}</button>
    <header className="mb-6 mt-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">General Practice · Draft editor</p><h1 className="mt-2 text-3xl font-bold text-[#2D2E30] sm:text-4xl">{editing ? 'Edit quiz draft' : 'Create quiz draft'}</h1><p className="mt-2 text-sm text-[#765F55]">{creating && parentSet ? <>Quiz Set: <strong>{parentSet.name}</strong>. </> : null}Saving a draft does not publish it or change a published revision.</p></header>
    {loading ? <p role="status" className="rounded-2xl bg-white p-8 text-[#765F55]">Loading {editing ? 'quiz draft' : 'Quiz Set'}...</p> : (editing && !quiz) || (creating && !parentSet) ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error || 'Unable to load this Quiz Set.'}</p> : creating && parentSet?.status === 'archived' && !activeCreationOperation ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">Archived Quiz Sets cannot accept new quizzes.</p> : quiz?.status === 'archived' ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">Archived quizzes cannot be edited.</p> : <form onSubmit={save} noValidate className="space-y-6">
      {quiz?.published ? <p className="rounded-xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-4 text-sm text-[#765F55]">Published revision {quiz.published.revision} stays unchanged until a separate publication action. {quiz.draft ? `You are editing draft version ${quiz.draft.version}.` : 'This save will create draft version 1 from the published content.'}</p> : null}
      {mediaPending ? <p role="status" className="rounded-xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-4 text-sm text-[#765F55]">Media processing must be retried from quiz details before saving another draft. This editor will not repeat the committed operation.</p> : null}
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}{requiresReload && editing ? <button type="button" onClick={reloadLatest} className="ml-2 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">Reload latest saved draft</button> : null}</div> : null}
      {creating && activeCreationOperation && !confirmedCreationId ? <div role="status" className="rounded-2xl border border-[#E58C1A]/30 bg-[#FFF9EA] p-5 text-sm text-[#2D2E30]">
        <h2 className="font-bold">Creation request needs review</h2>
        <p className="mt-2">This Quiz may already exist. The original request is retained for this Admin and Quiz Set. Its draft cannot be edited during recovery. Check the Set quiz list before deciding whether to retry. No retry happens automatically.</p>
        {recoveryState === 'unavailable' ? <p className="mt-2 font-semibold">Browser storage is unavailable. Refreshing may lose this recovery request; do not start a new creation.</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => leave(setPath)} className={secondaryClass}>Check this Set's quiz list</button>
          {activeCreationOperation.status !== 'conflict' && !confirmedCreationId ? <button type="button" disabled={saving} onClick={() => dispatchCreate(activeCreationOperation)} className={`${secondaryClass} disabled:opacity-50`}>Retry same request</button> : null}
          <button type="button" disabled={saving || Boolean(confirmedCreationId)} onClick={abandonCreate} className={`${secondaryClass} disabled:opacity-50`}>Abandon recovery</button>
        </div>
      </div> : null}
      {creating && recoveryState === 'corrupt' ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">A saved creation request is invalid. Creation is blocked until you explicitly clear it. Check this Set's quiz list first. <button type="button" onClick={abandonCreate} className="ml-2 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">Clear invalid recovery record</button></div> : null}
      {creating && recoveryState === 'unavailable' && !creationOperation && !error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Browser session storage or Admin identity is unavailable. Creation is blocked until recovery can be stored safely.</p> : null}
      {creating && confirmedCreationId ? <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Quiz creation was confirmed. Do not submit again. <button type="button" onClick={() => navigate(`/general-practice/${encodeURIComponent(confirmedCreationId)}`, { replace: true })} className="ml-2 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">View created Quiz</button></p> : null}
      {validationErrors.length > 0 ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-bold">Please fix these fields:</p><ul className="mt-2 list-disc pl-5">{validationErrors.map((problem) => <li key={problem}>{problem}</li>)}</ul></div> : null}
      {savedMessage ? <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{savedMessage}</p> : null}
      <fieldset disabled={creating && (Boolean(activeCreationOperation) || recoveryState !== 'empty' || Boolean(confirmedCreationId))} className="space-y-6 disabled:opacity-70"><legend className="sr-only">Quiz draft fields</legend>
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
      </fieldset>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving || requiresReload || mediaPending || (creating && (parentSet?.status === 'archived' || Boolean(activeCreationOperation) || recoveryState !== 'empty' || Boolean(confirmedCreationId)))} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2D2E30] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Save draft'}</button><button type="button" disabled={creating && saving} onClick={() => leave(editing ? `/general-practice/${encodeURIComponent(quizId)}` : setPath)} className={`${secondaryClass} disabled:cursor-not-allowed disabled:opacity-50`}>Cancel</button></div>
    </form>}
  </div></main>
}

export default GeneralPracticeEditor
