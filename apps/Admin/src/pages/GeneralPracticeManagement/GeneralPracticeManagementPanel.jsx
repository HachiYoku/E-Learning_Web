import { useRef, useState } from 'react'
import QuizDialog from '../QuizManagement/QuizDialog'
import { archiveGeneralPracticeQuiz, disableGeneralPracticeQuiz, enableGeneralPracticeQuiz, fetchGeneralPracticeQuiz, publishGeneralPracticeDraft, restoreGeneralPracticeQuiz, retryGeneralPracticeMedia } from '../../services/generalPracticeAdminService'

const actions = {
  publish: { title: 'Publish draft?', confirmText: 'Publish draft', message: 'The pending draft will become the student-visible revision. Existing saved attempts remain unchanged.' },
  disable: { title: 'Disable quiz?', confirmText: 'Disable quiz', message: 'New attempts and unfinished sessions will be unavailable. Saved results and history remain available.' },
  enable: { title: 'Enable quiz?', confirmText: 'Enable quiz', message: 'The last published revision becomes available again. Any unpublished draft remains unpublished.' },
  archive: { title: 'Archive quiz?', confirmText: 'Archive quiz', message: 'This removes the quiz from new-attempt availability and invalidates unfinished sessions. Saved attempts remain available. Archived quizzes cannot be re-enabled or edited.' },
  restore: { title: 'Restore quiz to Draft?', confirmText: 'Restore quiz', message: 'The quiz will return to Draft and remain unavailable to students until you explicitly publish it. Saved attempts remain available.' },
  retry: { title: 'Retry media processing?', confirmText: 'Retry media processing', message: 'Retry media reconciliation only. This will not save or publish the draft again.' },
}

function responseConfirmed(action, before, result) {
  if (result?.id !== before.id || result.contextType !== 'standalone') return false
  if (action === 'retry') return ['complete', 'retry_required'].includes(result.mediaProcessing)
  if (action === 'publish') return result.status === 'published' && !result.draft && result.published?.revision === (before.published?.revision ?? 0) + 1
  if (action === 'restore') return result.status === 'draft' && result.draft?.version === (before.draft?.version ?? 1)
    && (result.published?.revision ?? null) === (before.published?.revision ?? null)
  return result.status === ({ disable: 'disabled', enable: 'published', archive: 'archived' })[action]
}

function GeneralPracticeManagementPanel({ quiz, onQuizChange }) {
  const [confirmAction, setConfirmAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reconciliationRequired, setReconciliationRequired] = useState(false)
  const busyRef = useRef(false)
  const mediaPending = quiz.mediaProcessing === 'retry_required'
  const controlsLocked = busy || reconciliationRequired || mediaPending

  const reloadCurrent = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const latest = await fetchGeneralPracticeQuiz(quiz.id)
      onQuizChange(latest)
      setReconciliationRequired(false)
      setError('')
      setNotice('Current quiz state loaded.')
    } catch (failure) { setError(failure.status === 401 || failure.status === 403 ? 'Admin access is required to reload this quiz.' : failure.message || 'Unable to reload the quiz.') }
    finally { busyRef.current = false; setBusy(false) }
  }

  const execute = async () => {
    const action = confirmAction
    if (!action || busyRef.current || reconciliationRequired || (mediaPending && action !== 'retry')) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await ({
        publish: () => publishGeneralPracticeDraft(quiz.id, quiz.draft.version),
        disable: () => disableGeneralPracticeQuiz(quiz.id),
        enable: () => enableGeneralPracticeQuiz(quiz.id),
        archive: () => archiveGeneralPracticeQuiz(quiz.id),
        restore: () => restoreGeneralPracticeQuiz(quiz.id),
        retry: () => retryGeneralPracticeMedia(quiz.id),
      })[action]()
      if (!responseConfirmed(action, quiz, result)) {
        setReconciliationRequired(true)
        setError('The response could not be confirmed. Reload the current quiz before another action.')
        return
      }
      onQuizChange(result)
      try {
        const latest = await fetchGeneralPracticeQuiz(quiz.id)
        onQuizChange(latest)
        setNotice(action === 'publish' && quiz.published ? 'publish-success' : action === 'retry' && latest.mediaProcessing === 'retry_required' ? 'Media processing still requires retry. No draft save or publication was repeated.' : `${actions[action].confirmText} confirmed. Current quiz state loaded.`)
      } catch {
        setReconciliationRequired(true)
        setNotice(action === 'publish' && quiz.published ? 'publish-success' : `${actions[action].confirmText} confirmed by the server, but the latest state could not be reloaded.`)
      }
    } catch (failure) {
      if (failure.status === 409) {
        setReconciliationRequired(true)
        setError('The quiz changed or this action is no longer allowed. Reload its current state before another action.')
      } else if (failure.status === 401 || failure.status === 403) {
        setError('Admin access is required for this action. No success has been confirmed.')
      } else if (failure.status === 400) {
        setError(failure.message || 'The quiz is not valid for this action.')
      } else if (failure.status === 404) {
        setReconciliationRequired(true)
        setError('This quiz is unavailable. Reload its current state before another action.')
      } else {
        setReconciliationRequired(true)
        setError('The outcome is uncertain. Reload the current quiz before another action; do not repeat this request blindly.')
      }
    } finally {
      busyRef.current = false
      setBusy(false)
      setConfirmAction(null)
    }
  }

  const button = (action, label, disabled = controlsLocked) => <button key={action} type="button" disabled={disabled} onClick={() => { setError(''); setNotice(''); setConfirmAction(action) }} className="min-h-11 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] hover:bg-[#FFF4D8] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-50">{label}</button>

  return <section aria-label="Quiz management" className="mb-6 rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6">
    <h2 className="text-lg font-bold text-[#2D2E30]">Manage quiz</h2>
    <p className="mt-1 text-sm text-[#765F55]">Published revision: {quiz.published?.revision ?? 'None'} · Pending draft version: {quiz.draft?.version ?? 'None'} · Unpublished changes: {quiz.draft ? 'Yes' : 'No'}</p>
    <p className="mt-1 text-sm text-[#765F55]">Media processing: {quiz.mediaProcessing === 'retry_required' ? 'Retry required' : 'Complete'}</p>
    {mediaPending ? <p role="status" className="mt-3 rounded-xl border border-[#E58C1A]/30 bg-[#FFF9EA] p-3 text-sm text-[#765F55]">A Quiz write has already committed. Retry media processing; do not save or publish again to recover it.</p> : null}
    {error ? <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {notice ? <div role="status" className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice === 'publish-success' ? <><p className="font-bold">Quiz Update Published</p><p className="mt-1">Your changes are now live for new quiz attempts. Students who started this quiz before the update will continue using their previous version until their current session ends or expires (up to 24 hours).</p></> : notice}</div> : null}
    {reconciliationRequired ? <button type="button" disabled={busy} onClick={reloadCurrent} className="mt-4 min-h-11 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] disabled:opacity-50">Reload current quiz</button> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      {quiz.draft && ['draft', 'published'].includes(quiz.status) ? button('publish', 'Publish draft') : null}
      {quiz.status === 'published' ? button('disable', 'Disable quiz') : null}
      {quiz.status === 'disabled' && quiz.published ? button('enable', 'Enable quiz') : null}
      {quiz.status !== 'archived' ? button('archive', 'Archive quiz') : null}
      {quiz.status === 'archived' ? button('restore', 'Restore quiz') : null}
      {mediaPending ? button('retry', 'Retry media processing', busy || reconciliationRequired) : null}
    </div>
    {confirmAction ? <QuizDialog title={actions[confirmAction].title} message={actions[confirmAction].message} confirmText={actions[confirmAction].confirmText} onConfirm={execute} onCancel={() => { if (!busyRef.current) setConfirmAction(null) }} busy={busy} /> : null}
  </section>
}

export default GeneralPracticeManagementPanel
