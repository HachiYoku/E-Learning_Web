import { useEffect, useRef, useState } from 'react'
import { SET_DIFFICULTIES, setFormFrom, setFormPayload, validateSetForm } from './quizSetFormFields'
import QuizDialog from '../QuizManagement/QuizDialog'

const inputClass = 'mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 text-sm text-[#2D2E30] outline-none focus:border-[#E58C1A] focus:ring-2 focus:ring-[#E58C1A]/20'

export default function GeneralPracticeSetForm({ set, onSave, onCancel, onReload, title }) {
  const [form, setForm] = useState(() => setFormFrom(set))
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [reconcile, setReconcile] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const busyRef = useRef(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(setFormFrom(set))

  useEffect(() => { setForm(setFormFrom(set)); setErrors({}); setError(''); setReconcile(false) }, [set])

  async function submit(event) {
    event.preventDefault()
    if (busyRef.current || reconcile) return
    const nextErrors = validateSetForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    busyRef.current = true
    setPending(true)
    setError('')
    try { await onSave(setFormPayload(form), set?.version) }
    catch (failure) {
      if (!set && (failure.status === 409 || !failure.status || failure.status >= 500)) { setReconcile(true); setError("We couldn't confirm whether your Quiz Set was created. Please check the Quiz Set list before trying again to avoid creating a duplicate.") }
      else if (failure.status === 409) { setReconcile(true); setError('This Quiz Set changed elsewhere or its state no longer permits the change. Your edits remain here. Reload the latest Set before trying again.') }
      else if (failure.status === 401 || failure.status === 403) setError('Admin access is required. Your edits remain here.')
      else if (failure.status === 404) { setReconcile(true); setError('This Quiz Set is no longer available. Your edits remain here.') }
      else if (failure.status === 400) setError(failure.message || 'Check the Quiz Set fields and try again.')
      else { setReconcile(true); setError('The save outcome could not be confirmed. Reload the latest Set before trying again.') }
    } finally { busyRef.current = false; setPending(false) }
  }

  async function reloadLatest() {
    try {
      const latest = await onReload()
      if (!latest) return
      setForm(setFormFrom(latest))
      setErrors({})
      setError('')
      setReconcile(false)
    } catch { setError('Unable to reload the current Set. Your edits remain here.') }
  }

  function requestLeave() {
    if (busyRef.current) return
    if (dirty) setConfirmDiscard(true)
    else onCancel()
  }

  return <section className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 sm:p-6" aria-label={title}>
    <h2 className="text-xl font-bold text-[#2D2E30]">{title}</h2>
    <p className="mt-2 text-sm text-[#765F55]">{set ? `Current version ${set.version}. Saving will not change the Set status.` : 'New Quiz Sets start Disabled and are not available to learners.'}</p>
    {error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {reconcile && onReload ? <button type="button" onClick={reloadLatest} className="mt-3 min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">Reload current Set</button> : null}
    {reconcile && !set ? <button type="button" onClick={requestLeave} className="mt-3 min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E58C1A]">Check Quiz Set list</button> : null}
    <form onSubmit={submit} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-bold text-[#2D2E30] sm:col-span-2">Name *<input className={inputClass} value={form.name} maxLength={140} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'set-name-error' : undefined} onChange={(event) => setForm({ ...form, name: event.target.value })} />{errors.name ? <span id="set-name-error" className="mt-1 block text-red-700">{errors.name}</span> : null}</label>
      <label className="text-sm font-bold text-[#2D2E30] sm:col-span-2">Description<textarea className={inputClass} value={form.description} maxLength={1000} rows={3} aria-invalid={!!errors.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />{errors.description ? <span className="mt-1 block text-red-700">{errors.description}</span> : null}</label>
      <label className="text-sm font-bold text-[#2D2E30]">Difficulty<select className={inputClass} value={form.difficulty} aria-invalid={!!errors.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option value="">All levels</option>{SET_DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}</select>{errors.difficulty ? <span className="mt-1 block text-red-700">{errors.difficulty}</span> : null}</label>
      <label className="text-sm font-bold text-[#2D2E30] sm:col-span-2">Cover image URL (optional)<input className={inputClass} type="url" value={form.coverImage} maxLength={2048} aria-invalid={!!errors.coverImage} onChange={(event) => setForm({ ...form, coverImage: event.target.value })} /><span className="mt-1 block font-normal text-[#765F55]">Cloudinary HTTPS image URLs only; no upload is performed.</span>{errors.coverImage ? <span className="mt-1 block text-red-700">{errors.coverImage}</span> : null}</label>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" disabled={pending || reconcile} className="min-h-11 rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Saving…' : set ? 'Save Set changes' : 'Create Quiz Set'}</button><button type="button" disabled={pending} onClick={requestLeave} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-5 py-2.5 text-sm font-bold text-[#2D2E30] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] disabled:opacity-50">Cancel</button></div>
    </form>
    {confirmDiscard ? <QuizDialog title="Discard unsaved Set changes?" message="Leaving will discard the values you entered. Continue editing to keep them." cancelText="Continue editing" confirmText="Discard changes" onCancel={() => setConfirmDiscard(false)} onConfirm={() => { setConfirmDiscard(false); onCancel() }} /> : null}
  </section>
}
