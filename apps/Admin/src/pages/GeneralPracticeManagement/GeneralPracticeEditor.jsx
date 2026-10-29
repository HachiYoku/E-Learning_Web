import { useContext, useEffect, useRef, useState } from 'react'
import { UNSAFE_NavigationContext, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Check, ImagePlus, Info, Plus, Trash2 } from 'lucide-react'
import { abandonFailedGeneralPracticeCreation, createGeneralPracticeSetDraft, fetchGeneralPracticeCreationOutcome, fetchGeneralPracticeQuiz, fetchGeneralPracticeSet, updateGeneralPracticeDraft } from '../../services/generalPracticeAdminService'
import { CATEGORIES, DIFFICULTIES, draftFromQuiz, draftPayload, emptyDraft, newQuestion, validateDraft } from './generalPracticeDraft'
import { useAuth } from '../../contexts/AuthContext'
import { browserCreationStorage, clearCreation, creationStorageKey, readCreation, uuidV4, writeCreation } from './generalPracticeCreationRecovery'
import GeneralPracticeSelect from './GeneralPracticeSelect'
import QuizDialog from '../QuizManagement/QuizDialog'

const inputClass = 'mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 text-sm text-[#2D2E30] outline-none focus:border-[#E58C1A] focus:ring-2 focus:ring-[#E58C1A]/20'
const secondaryClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] hover:bg-[#FFF4D8] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]'

function GeneralPracticeEditor() {
  const { quizId, setId } = useParams()
  const editing = Boolean(quizId)
  const creating = !editing && Boolean(setId)
  const setPath = `/general-practice/sets/${encodeURIComponent(setId || '')}`
  const navigate = useNavigate()
  const navigation = useContext(UNSAFE_NavigationContext)
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
  const [savedVersion, setSavedVersion] = useState(null)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const permitNavigation = useRef(false)
  const [validationErrors, setValidationErrors] = useState([])
  const [requiresReload, setRequiresReload] = useState(false)
  const [creationOperation, setCreationOperation] = useState(null)
  const [recoveryState, setRecoveryState] = useState('checking')
  const [confirmedCreationId, setConfirmedCreationId] = useState(null)
  const savingRef = useRef(false)
  const previewUrls = useRef(new Set())
  const currentStorageKey = useRef(storageKey)
  currentStorageKey.current = storageKey
  const activeCreationOperation = creationOperation?.adminId === adminId && creationOperation?.setId === setId?.toLowerCase() ? creationOperation : null
  const dirty = JSON.stringify(form) !== baseline
  const mediaPending = quiz?.mediaProcessing === 'retry_required'

  useEffect(() => () => { for (const url of previewUrls.current) URL.revokeObjectURL(url) }, [])

  const selectMedia = (index, type, file) => {
    if (!file) return
    const image = type === 'image'
    const accepted = image ? ['image/jpeg', 'image/png', 'image/webp'] : ['audio/mpeg', 'audio/mp4', 'audio/x-m4a']
    const limit = (image ? 5 : 10) * 1024 * 1024
    if (!accepted.includes(file.type) || file.size > limit) {
      setError(image ? 'Question image must be JPG, PNG, or WebP, up to 5 MB.' : 'Question audio must be MP3 or M4A, up to 10 MB.')
      return
    }
    const previous = form.questions[index]?.[`${type}Preview`]
    if (previous?.startsWith('blob:')) { URL.revokeObjectURL(previous); previewUrls.current.delete(previous) }
    const preview = URL.createObjectURL(file)
    previewUrls.current.add(preview)
    changeQuestion(index, { [`${type}File`]: file, [`${type}Preview`]: preview, [`${type}Action`]: 'replace' })
    setError('')
  }

  const clearPreview = (question, type) => {
    const preview = question?.[`${type}Preview`]
    if (preview?.startsWith('blob:')) { URL.revokeObjectURL(preview); previewUrls.current.delete(preview) }
  }

  const removeMedia = (index, type) => {
    const question = form.questions[index]
    const original = (quiz?.draft || quiz?.published)?.questions?.find((item) => item._id === question?._id)
    clearPreview(question, type)
    changeQuestion(index, { [type]: '', [`${type}PublicId`]: '', [`${type}ResourceType`]: '',
      [`${type}Format`]: '', [`${type}File`]: null, [`${type}Preview`]: '',
      [`${type}Action`]: original?.[type] ? 'remove' : 'keep',
      ...(type === 'image' ? { imageAlt: '', imageDecorative: false } : { audioLabel: '' }) })
  }

  const keepMedia = (index, type) => {
    const question = form.questions[index]
    const original = (quiz?.draft || quiz?.published)?.questions?.find((item) => item._id === question?._id)
    clearPreview(question, type)
    changeQuestion(index, { [type]: original?.[type] || '',
      [`${type}PublicId`]: original?.[`${type}PublicId`] || '',
      [`${type}ResourceType`]: original?.[`${type}ResourceType`] || '',
      [`${type}Format`]: original?.[`${type}Format`] || '',
      [`${type}File`]: null, [`${type}Preview`]: '', [`${type}Action`]: 'keep',
      ...(type === 'image' ? { imageAlt: original?.imageAlt || '', imageDecorative: Boolean(original?.imageDecorative) }
        : { audioLabel: original?.audioLabel || '' }) })
  }

  const mediaControl = (question, index, type) => {
    const image = type === 'image'
    const label = image ? 'image' : 'audio'
    const action = question[`${type}Action`] || 'keep'
    const original = (quiz?.draft || quiz?.published)?.questions?.find((item) => item._id === question._id)?.[type]
    const source = action === 'replace' ? question[`${type}Preview`] : question[type]
    return <div key={type} className={image ? 'rounded-2xl border-2 border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] p-4' : 'rounded-xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-3'}>
      <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-[#9A5816]">Question {index + 1} {label}: {action === 'replace' ? 'Replace selected' : action === 'remove' ? 'Remove on save' : original ? 'Keep current' : 'No attachment'}</p>
        {!image && source ? <button type="button" aria-label={`Remove question ${index + 1} audio`} title="Remove question audio" onClick={() => removeMedia(index, type)} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#A34D45] shadow-sm transition hover:bg-[#FFF0EE] focus:outline-none focus:ring-2 focus:ring-[#A34D45]"><Trash2 size={18} aria-hidden="true" /></button> : null}
      </div>
      {source ? image ? <div className="relative mt-3"><img src={source} alt={`Question ${index + 1} preview`} className="aspect-video w-full rounded-xl object-contain" /><button type="button" aria-label={`Remove question ${index + 1} image`} title="Remove question image" onClick={() => removeMedia(index, type)} className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/95 text-[#A34D45] shadow-md transition hover:bg-[#FFF0EE] focus:outline-none focus:ring-2 focus:ring-[#A34D45] focus:ring-offset-2"><Trash2 size={18} aria-hidden="true" /></button></div>
        : <audio controls preload="none" src={source} aria-label={`Question ${index + 1} audio preview`} className="mt-3 w-full">Audio playback is unavailable.</audio> : image ? <div className="mt-3 flex aspect-video items-center justify-center gap-2 rounded-xl bg-[#FFF1CE] text-sm font-semibold text-[#765F55]"><ImagePlus size={24} aria-hidden="true" /> Upload prompt image</div> : null}
      <label className="mt-3 block text-sm font-bold text-[#2D2E30]">{creating ? 'Question' : original ? 'Replace' : 'Add'} {label} ({image ? 'JPG, PNG, WebP; up to 5 MB' : 'MP3, M4A; up to 10 MB'})
        <input type="file" accept={image ? 'image/jpeg,image/png,image/webp' : 'audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a'}
          onChange={(event) => { selectMedia(index, type, event.target.files?.[0]); event.target.value = '' }} className="mt-2 block w-full text-sm text-[#765F55] file:mr-3 file:rounded-lg file:border-0 file:bg-[#FFF1CE] file:px-3 file:py-2 file:font-bold file:text-[#9A5816]" />
      </label>
      {original && action !== 'keep' ? <div className="mt-3 flex flex-wrap gap-2">
        {original && action !== 'keep' ? <button type="button" onClick={() => keepMedia(index, type)} className={secondaryClass}>Keep original {label}</button> : null}
      </div> : null}
    </div>
  }

  const selectedFiles = () => form.questions.flatMap((question, index) => [
    ...(question.imageFile ? [{ field: `questionImage_${index}`, file: question.imageFile }] : []),
    ...(question.audioFile ? [{ field: `questionAudio_${index}`, file: question.audioFile }] : []),
  ])

  const finishFailedAbandon = () => {
    if (!clearCreation(creationStorage, storageKey)) {
      setRecoveryState('unavailable')
      setError('The request was abandoned, but browser recovery data could not be cleared. Do not submit again.')
      return
    }
    setCreationOperation(null)
    setRecoveryState('empty')
    for (const url of previewUrls.current) URL.revokeObjectURL(url)
    previewUrls.current.clear()
    const blank = emptyDraft()
    setForm(blank)
    setBaseline(JSON.stringify(blank))
    setError('The failed request was abandoned. Re-enter the draft and select files before saving again.')
  }

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
    let active = true
    const recovered = readCreation(creationStorage, storageKey)
    setCreationOperation(null)
    setRecoveryState(recovered.state)
    if (recovered.operation) {
      setCreationOperation(recovered.operation)
      if (recovered.operation.version === 1) {
        const restored = draftFromQuiz({ draft: recovered.operation.draft })
        setForm(restored)
        setBaseline(JSON.stringify(restored))
      } else {
        fetchGeneralPracticeCreationOutcome(setId, recovered.operation.creationRequestId)
          .then((outcome) => {
            if (!active) return
            if (outcome?.status === 'committed' && outcome.quiz?.id) {
              setConfirmedCreationId(outcome.quiz.id)
              if (clearCreation(creationStorage, storageKey)) { permitNavigation.current = true; navigate(`/general-practice/${encodeURIComponent(outcome.quiz.id)}`, { replace: true, state: { created: true } }) }
            } else if (outcome?.status === 'failed' && ['complete', 'unverified', 'retry_required'].includes(outcome.mediaCleanup)) {
              const failed = { ...recovered.operation, status: 'failed', mediaCleanup: outcome.mediaCleanup }
              setCreationOperation(failed)
              if (!writeCreation(creationStorage, storageKey, failed)) setRecoveryState('unavailable')
            } else if (outcome?.status === 'abandoned') finishFailedAbandon()
          })
          .catch(() => { /* Keep the original request blocked while its outcome is unknown. */ })
      }
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

  useEffect(() => {
    const navigator = navigation?.navigator
    if (!navigator || confirmedCreationId || (!dirty && !activeCreationOperation)) return undefined
    const originals = {}
    for (const method of ['push', 'replace', 'go']) {
      originals[method] = navigator[method]
      navigator[method] = (...args) => {
        if (permitNavigation.current) return originals[method].apply(navigator, args)
        setPendingNavigation((current) => current || { proceed: () => originals[method].apply(navigator, args) })
      }
    }
    return () => { for (const method of Object.keys(originals)) navigator[method] = originals[method] }
  }, [navigation, dirty, activeCreationOperation, confirmedCreationId])

  const leave = (path) => {
    if (creating && savingRef.current) return
    if (confirmedCreationId) { navigate(path); return }
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
    if (savingRef.current || operation.adminId !== adminId || operation.setId !== setId?.toLowerCase() || confirmedCreationId
      || (operation.version === 2 && recoveryState === 'unavailable')
      || (operation.version === 2 && operation.status !== 'pending' && (operation.status !== 'failed' || !operation.draft || !operation.files?.length))) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const result = operation.version === 2
        ? await createGeneralPracticeSetDraft(operation.setId, operation.creationRequestId, operation.draft, operation.files)
        : await createGeneralPracticeSetDraft(operation.setId, operation.creationRequestId, operation.draft)
      if (currentStorageKey.current !== storageKey) return
      if (!confirmedCreate(result, operation)) {
        const uncertain = { ...operation, status: 'uncertain' }
        setCreationOperation(uncertain)
        if (!writeCreation(creationStorage, storageKey, uncertain)) setRecoveryState('unavailable')
        setError(operation.version === 2
          ? 'The creation response could not be verified. Check the original request before taking further action.'
          : 'The creation response could not be verified. This Quiz may already exist. Check the Set quiz list or deliberately retry the same request.')
        return
      }
      setConfirmedCreationId(result.id)
      if (!clearCreation(creationStorage, storageKey)) {
        setError('Quiz creation was confirmed, but browser recovery data could not be cleared. Do not submit again; check the Set quiz list.')
        return
      }
      setCreationOperation(null)
      setBaseline(JSON.stringify(form))
      permitNavigation.current = true
      navigate(`/general-practice/${encodeURIComponent(result.id)}`, { replace: true, state: { created: true } })
    } catch (failure) {
      if (currentStorageKey.current !== storageKey) return
      if (operation.version === 2 && failure.status === 503 && failure.code === 'quiz_creation_precommit_failed'
        && ['complete', 'unverified', 'retry_required'].includes(failure.data?.mediaCleanup)) {
        const next = { ...operation, status: 'failed', mediaCleanup: failure.data.mediaCleanup }
        setCreationOperation(next)
        if (!writeCreation(creationStorage, storageKey, next)) setRecoveryState('unavailable')
        setError(`The original Save failed before a quiz was committed. You can manually retry the same unchanged request.${next.mediaCleanup === 'retry_required' ? ' Uploaded media cleanup still requires attention.' : next.mediaCleanup === 'unverified' ? ' The failed upload may have left an asset that needs review.' : ''}`)
      } else if ([400, 401, 403, 404].includes(failure.status)) {
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
          : operation.version === 2
            ? 'We could not confirm whether your Quiz was created. Check the original request; no media will be uploaded again automatically.'
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

  const abandonFailedCreate = async () => {
    if (savingRef.current || activeCreationOperation?.version !== 2 || activeCreationOperation.status !== 'failed') return
    try {
      if (!window.confirm('Abandon the failed request? This cannot undo a committed Quiz. Re-enter the draft and files to start again.')) return
      const outcome = await abandonFailedGeneralPracticeCreation(activeCreationOperation.setId,
        activeCreationOperation.creationRequestId)
      if (outcome?.status === 'committed' && outcome.quiz?.id) {
        setConfirmedCreationId(outcome.quiz.id)
        if (clearCreation(creationStorage, storageKey)) { permitNavigation.current = true; navigate(`/general-practice/${encodeURIComponent(outcome.quiz.id)}`, { replace: true, state: { created: true } }) }
        else setError('Creation was confirmed, but recovery data could not be cleared. Do not submit again.')
        return
      }
      if (outcome?.status !== 'abandoned') throw new Error('Unknown creation outcome')
      finishFailedAbandon()
    } catch { setError('Unable to verify or clear the failed request. Keep creation blocked and check the original request again.') }
  }

  const checkCreationOutcome = async () => {
    if (!activeCreationOperation || activeCreationOperation.version !== 2) return
    try {
      const outcome = await fetchGeneralPracticeCreationOutcome(activeCreationOperation.setId,
        activeCreationOperation.creationRequestId)
      if (outcome?.status === 'committed' && outcome.quiz?.id) {
        setConfirmedCreationId(outcome.quiz.id)
        if (clearCreation(creationStorage, storageKey)) { permitNavigation.current = true; navigate(`/general-practice/${encodeURIComponent(outcome.quiz.id)}`, { replace: true, state: { created: true } }) }
        else setError('Creation was confirmed, but recovery data could not be cleared. Do not submit again.')
      } else if (outcome?.status === 'failed' && ['complete', 'unverified', 'retry_required'].includes(outcome.mediaCleanup)) {
        const failed = { ...activeCreationOperation, status: 'failed', mediaCleanup: outcome.mediaCleanup }
        setCreationOperation(failed)
        if (!writeCreation(creationStorage, storageKey, failed)) setRecoveryState('unavailable')
        setError('The original request failed before commit. You may manually retry it if its original draft and files are still available, or abandon it.')
      } else if (outcome?.status === 'abandoned') finishFailedAbandon()
      else setError('The original request has not been confirmed. Keep this request blocked; do not create another quiz.')
    } catch { setError('Unable to confirm the original request. Do not create another quiz.') }
  }

  const save = async (event) => {
    event.preventDefault()
    if (!editing && !creating) return
    if (creating && (!parentSet || parentSet.id.toLowerCase() !== setId.toLowerCase() || parentSet.status === 'archived')) return
    if (savingRef.current || requiresReload || mediaPending || (creating && (activeCreationOperation || recoveryState !== 'empty' || confirmedCreationId))) return
    setSavedVersion(null)
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
      const files = selectedFiles()
      const operation = { version: files.length ? 2 : 1, adminId, setId: parentSet.id.toLowerCase(), creationRequestId,
        draft: draftPayload(form), ...(files.length ? { files } : {}), status: 'pending' }
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
      const files = selectedFiles()
      const result = files.length
        ? await updateGeneralPracticeDraft(quizId, expectedVersion, draftPayload(form), files)
        : await updateGeneralPracticeDraft(quizId, expectedVersion, draftPayload(form))
      const samePublishedRevision = (result?.published?.revision ?? null) === (quiz?.published?.revision ?? null)
      const confirmed = result?.contextType === 'standalone' && result.id === quizId && result.draft?.version === expectedVersion + 1 && samePublishedRevision
      if (!confirmed) {
        setRequiresReload(true)
        setError('The save response could not be confirmed. Check the latest quiz state before trying again.')
        return
      }
      const loaded = draftFromQuiz(result)
      for (const url of previewUrls.current) URL.revokeObjectURL(url)
      previewUrls.current.clear()
      setQuiz(result)
      setForm(loaded)
      setBaseline(JSON.stringify(loaded))
      setSavedVersion(result.draft.version)
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

  if (!editing && !creating) return <main className="min-h-screen bg-[#FFFDF8] px-4 pb-12 pt-6 sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl">
    <button type="button" onClick={() => navigate('/general-practice')} className={secondaryClass}><ArrowLeft size={18} aria-hidden="true" /> Back to Quiz Sets</button>
    <div role="status" className="mt-6 rounded-2xl border border-[#E58C1A]/25 bg-[#FFF9EA] p-6">
      <h1 className="text-2xl font-bold text-[#2D2E30]">Choose a Quiz Set to create a quiz</h1>
      <p className="mt-2 text-sm text-[#765F55]">Open a Quiz Set and select Create Quiz. Existing quiz drafts remain editable.</p>
    </div>
  </div></main>

  return <main className="min-h-screen bg-[#FFFDF8] px-4 pb-12 pt-6 sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl">
    <button type="button" disabled={creating && saving} onClick={() => leave(editing ? `/general-practice/${encodeURIComponent(quizId)}` : setPath)} className={`${secondaryClass} disabled:cursor-not-allowed disabled:opacity-50`}><ArrowLeft size={18} aria-hidden="true" /> {editing ? 'Back to General Practice' : 'Back to Quiz Set'}</button>
    <header className="mb-6 mt-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">General Practice · Draft editor</p><h1 className="mt-2 text-3xl font-bold text-[#2D2E30] sm:text-4xl">{editing ? 'Edit quiz draft' : 'Create quiz draft'}</h1><p className="mt-2 text-sm text-[#765F55]">{creating && parentSet ? <>Quiz Set: <strong>{parentSet.name}</strong>. </> : null}Saving a draft does not publish it or change a published revision.</p></header>
    {loading ? <p role="status" className="rounded-2xl bg-white p-8 text-[#765F55]">Loading {editing ? 'quiz draft' : 'Quiz Set'}...</p> : (editing && !quiz) || (creating && !parentSet) ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error || 'Unable to load this Quiz Set.'}</p> : creating && parentSet?.status === 'archived' && !activeCreationOperation ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">Archived Quiz Sets cannot accept new quizzes.</p> : quiz?.status === 'archived' ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">Archived quizzes cannot be edited.</p> : <form onSubmit={save} noValidate className="space-y-6">
      {editing ? <section aria-label="Revision status" className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border border-[#2D2E30]/15 bg-white px-3 py-1.5 font-semibold text-[#2D2E30]">Published {quiz.published ? `v${quiz.published.revision}` : 'none'}</span>
        <span className="rounded-full border border-[#E58C1A]/30 bg-[#FFF9EA] px-3 py-1.5 font-semibold text-[#9A5816]">Draft {quiz.draft ? `v${quiz.draft.version}` : 'none'}</span>
        <details className="group relative ml-auto">
          <summary onKeyDown={(event) => { if (event.key === 'Escape') event.currentTarget.parentElement.open = false }} className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl px-2 font-semibold text-[#765F55] hover:bg-[#FFF4D8] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] [&::-webkit-details-marker]:hidden"><Info size={17} aria-hidden="true" /> Version details</summary>
          <div className="absolute right-0 z-10 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[#E58C1A]/25 bg-white p-4 text-sm leading-6 text-[#765F55] shadow-lg">
            <p>Saving a draft does not publish it.</p>
            <p className="mt-2">Publishing makes the new revision available to new attempts.</p>
            <p className="mt-2">Existing unfinished student sessions retain their original snapshot until completion or expiration, up to 24 hours.</p>
          </div>
        </details>
      </section> : null}
      {mediaPending ? <p role="status" className="rounded-xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-4 text-sm text-[#765F55]">Media processing must be retried from quiz details before saving another draft. This editor will not repeat the committed operation.</p> : null}
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}{requiresReload && editing ? <button type="button" onClick={reloadLatest} className="ml-2 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">Reload latest saved draft</button> : null}</div> : null}
      {creating && activeCreationOperation && !confirmedCreationId ? <div role="status" className="rounded-2xl border border-[#E58C1A]/30 bg-[#FFF9EA] p-5 text-sm text-[#2D2E30]">
        <h2 className="font-bold">Creation request needs review</h2>
        <p className="mt-2">{activeCreationOperation.status === 'failed'
          ? 'This Save failed before commit. The original request ID is retained for an explicit retry. After a refresh, draft content and files must be entered again for a new request.'
          : 'This Quiz may already exist. The original request is retained for this Admin and Quiz Set. Its draft cannot be edited during recovery. No retry happens automatically.'}</p>
        {recoveryState === 'unavailable' ? <p className="mt-2 font-semibold">Browser storage is unavailable. Refreshing may lose this recovery request; do not start a new creation.</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => leave(setPath)} className={secondaryClass}>Check this Set's quiz list</button>
          {activeCreationOperation.version === 2 ? <button type="button" onClick={checkCreationOutcome} className={secondaryClass}>Check original request</button> : null}
          {activeCreationOperation.version === 2 && activeCreationOperation.status === 'failed' && activeCreationOperation.draft && activeCreationOperation.files?.length ? <button type="button" disabled={saving || recoveryState === 'unavailable'} onClick={() => dispatchCreate(activeCreationOperation)} className={`${secondaryClass} disabled:opacity-50`}>Retry same request</button> : null}
          {activeCreationOperation.version === 2 && activeCreationOperation.status === 'failed' ? <button type="button" disabled={saving || recoveryState === 'unavailable'} onClick={abandonFailedCreate} className={`${secondaryClass} disabled:opacity-50`}>Abandon failed request</button> : null}
          {activeCreationOperation.version === 1 && activeCreationOperation.status !== 'conflict' && !confirmedCreationId ? <button type="button" disabled={saving} onClick={() => dispatchCreate(activeCreationOperation)} className={`${secondaryClass} disabled:opacity-50`}>Retry same request</button> : null}
          {activeCreationOperation.version === 1 ? <button type="button" disabled={saving || Boolean(confirmedCreationId)} onClick={abandonCreate} className={`${secondaryClass} disabled:opacity-50`}>Abandon recovery</button> : null}
        </div>
      </div> : null}
      {creating && recoveryState === 'corrupt' ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">A saved creation request is invalid. Creation is blocked until you explicitly clear it. Check this Set's quiz list first. <button type="button" onClick={abandonCreate} className="ml-2 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">Clear invalid recovery record</button></div> : null}
      {creating && recoveryState === 'unavailable' && !creationOperation && !error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Browser session storage or Admin identity is unavailable. Creation is blocked until recovery can be stored safely.</p> : null}
      {creating && confirmedCreationId ? <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Quiz creation was confirmed. Do not submit again. <button type="button" onClick={() => navigate(`/general-practice/${encodeURIComponent(confirmedCreationId)}`, { replace: true })} className="ml-2 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">View created Quiz</button></p> : null}
      {validationErrors.length > 0 ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-bold">Please fix these fields:</p><ul className="mt-2 list-disc pl-5">{validationErrors.map((problem) => <li key={problem}>{problem}</li>)}</ul></div> : null}
      <fieldset disabled={creating && (Boolean(activeCreationOperation) || recoveryState !== 'empty' || Boolean(confirmedCreationId))} className="space-y-6 disabled:opacity-70"><legend className="sr-only">Quiz draft fields</legend>
      <section className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6"><h2 className="text-xl font-bold text-[#2D2E30]">Quiz details</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-bold text-[#2D2E30] sm:col-span-2">Title<input value={form.title} maxLength={140} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} /></label>
        <label className="text-sm font-bold text-[#2D2E30] sm:col-span-2">Description<textarea value={form.description} maxLength={1000} rows={3} onChange={(event) => setForm({ ...form, description: event.target.value })} className={inputClass} /></label>
        <GeneralPracticeSelect label="Category" value={form.category} options={[{ value: '', label: 'Choose category' }, ...CATEGORIES]} placeholder="Choose category" onChange={(category) => setForm((current) => ({ ...current, category }))} />
        <GeneralPracticeSelect label="Difficulty" value={form.difficulty} options={[{ value: '', label: 'Choose difficulty' }, ...DIFFICULTIES]} placeholder="Choose difficulty" onChange={(difficulty) => setForm((current) => ({ ...current, difficulty }))} />
        <p className="text-sm text-[#765F55] sm:col-span-2">General Practice quizzes are available only to signed-in students.</p>
      </div></section>
      <section aria-label="Questions" className="space-y-4">
        <h2 className="text-xl font-bold text-[#2D2E30]">Questions ({form.questions.length}/10)</h2>
        {form.questions.map((question, index) => {
          const problems = validationErrors.filter((problem) => problem.startsWith(`Question ${index + 1}:`))
          return <section key={question.localId} aria-label={`Question ${index + 1}`} className={`rounded-3xl border p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6 ${problems.length ? 'border-red-300 bg-red-50/50' : 'border-[#2D2E30]/10 bg-white'}`}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF1CE] text-sm font-bold text-[#C97112]">{index + 1}</span><h3 className="text-xl font-bold text-[#2D2E30]">Question {index + 1}</h3></div>
              <div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)} className={`${secondaryClass} disabled:opacity-50`} aria-label={`Move question ${index + 1} up`}><ArrowUp size={16} aria-hidden="true" /></button><button type="button" disabled={index === form.questions.length - 1} onClick={() => moveQuestion(index, 1)} className={`${secondaryClass} disabled:opacity-50`} aria-label={`Move question ${index + 1} down`}><ArrowDown size={16} aria-hidden="true" /></button><button type="button" disabled={form.questions.length === 1} onClick={() => setForm((current) => ({ ...current, questions: current.questions.filter((_, position) => position !== index) }))} className={`${secondaryClass} disabled:opacity-50`} aria-label={`Remove question ${index + 1}`}><Trash2 size={16} aria-hidden="true" /></button></div>
            </div>
            {problems.length ? <div className="mb-4 text-sm text-red-700"><p className="font-bold">Incomplete question</p><ul className="mt-1 list-inside list-disc">{problems.map((problem) => <li key={problem}>{problem.replace(`Question ${index + 1}: `, '')}</li>)}</ul></div> : null}
            <div className="grid gap-6 lg:grid-cols-2">
              {mediaControl(question, index, 'image')}
              <div className="space-y-5">
                <label className="block text-sm font-bold text-[#2D2E30]">Question text<input value={question.prompt || ''} maxLength={280} onChange={(event) => changeQuestion(index, { prompt: event.target.value })} className={inputClass} /></label>
                {mediaControl(question, index, 'audio')}
                <fieldset><legend className="text-sm font-bold text-[#2D2E30]">Answer options and correct answer</legend><div className="mt-3 space-y-2.5">{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-2 rounded-xl border border-[#2D2E30]/10 bg-[#FFFDF8] px-3 py-2.5 hover:border-[#E58C1A]/35 hover:bg-[#FFF9EA]"><label className="flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-[#2D2E30]"><input type="radio" name={`correct-${question.localId}`} checked={question.correctAnswer === optionIndex} onChange={() => changeQuestion(index, { correctAnswer: optionIndex })} className="h-4 w-4 accent-[#E58C1A]" /> Correct</label><span aria-hidden="true" className="w-6 text-center text-sm font-medium text-[#765F55]">{String.fromCharCode(65 + optionIndex)}</span><label className="min-w-0 flex-1"><span className="sr-only">Option {optionIndex + 1}</span><input aria-label={`Option ${optionIndex + 1}`} value={option} onChange={(event) => changeQuestion(index, { options: question.options.map((value, position) => position === optionIndex ? event.target.value : value) })} className="min-h-11 w-full border-none bg-transparent text-sm text-[#2D2E30] outline-none" /></label><button type="button" disabled={question.options.length <= 2} onClick={() => removeOption(index, optionIndex)} className="rounded-lg p-2 text-[#765F55] hover:bg-[#FFF1CE] disabled:opacity-50" aria-label={`Remove option ${optionIndex + 1} from question ${index + 1}`}><Trash2 size={16} aria-hidden="true" /></button></div>)}</div><button type="button" disabled={question.options.length >= 6} onClick={() => changeQuestion(index, { options: [...question.options, ''] })} className={`${secondaryClass} mt-3 disabled:opacity-50`}><Plus size={16} aria-hidden="true" /> Add option</button></fieldset>
                <label className="block text-sm font-bold text-[#2D2E30]">Explanation (optional)<textarea value={question.explanation || ''} maxLength={2000} rows={3} onChange={(event) => changeQuestion(index, { explanation: event.target.value })} className={inputClass} /></label>
              </div>
            </div>
          </section>
        })}
      </section>
      </fieldset>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" disabled={form.questions.length >= 10} onClick={() => setForm((current) => ({ ...current, questions: [...current.questions, newQuestion()] }))} className={`${secondaryClass} disabled:cursor-not-allowed disabled:opacity-50`}><Plus size={18} aria-hidden="true" /> Add question</button><div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">{savedVersion !== null && !dirty && !saving && !error && !requiresReload ? <p role="status" className="inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 sm:w-auto"><Check size={16} aria-hidden="true" /> Draft saved · Version {savedVersion}</p> : null}<button type="submit" disabled={saving || requiresReload || mediaPending || (creating && (parentSet?.status === 'archived' || Boolean(activeCreationOperation) || recoveryState !== 'empty' || Boolean(confirmedCreationId)))} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#2D2E30] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{saving ? 'Saving...' : 'Save draft'}</button></div></div>
    </form>}
    {pendingNavigation ? <QuizDialog title={activeCreationOperation ? 'Creation request needs review' : 'Unsaved changes'} message={activeCreationOperation ? 'This quiz may already have been created. Leaving keeps the same request available in this tab, but does not resolve its outcome.' : 'You have unsaved draft changes. Leaving this page will discard those changes.'} cancelText="Stay and continue editing" confirmText="Leave without saving" showClose onCancel={() => setPendingNavigation(null)} onConfirm={() => { permitNavigation.current = true; pendingNavigation.proceed(); setPendingNavigation(null) }} /> : null}
  </div></main>
}

export default GeneralPracticeEditor
