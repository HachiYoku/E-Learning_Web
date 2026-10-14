import { useRef, useState } from 'react'
import QuizDialog from '../QuizManagement/QuizDialog'
import { deleteGeneralPracticeSet, transitionGeneralPracticeSet } from '../../services/generalPracticeAdminService'

const actions = {
  activate: { label: 'Activate Set', title: 'Activate Quiz Set?', message: 'Published quizzes in this Set may become available for new learner sessions. Existing quiz statuses do not change.' },
  disable: { label: 'Disable Set', title: 'Disable Quiz Set?', message: 'New quiz starts will be blocked and unfinished sessions invalidated. Individual quiz statuses and saved attempts do not change. Reactivating will not restore invalidated sessions.' },
  archive: { label: 'Archive Set', title: 'Archive Quiz Set?', message: 'New quiz starts will be blocked and unfinished sessions invalidated. Individual quiz statuses and saved attempts do not change.' },
  restore: { label: 'Restore Set', title: 'Restore Quiz Set?', message: 'The Set will return to Disabled, not Active. New sessions will remain blocked until it is activated separately.' },
  delete: { label: 'Delete empty Set', title: 'Permanently delete Quiz Set?', message: 'This cannot be undone. Only an empty, non-active Set is eligible. No quizzes will be deleted. The server will recheck eligibility.' },
}

export default function GeneralPracticeSetActions({ set, quizCount, onChange, onDelete, onReload }) {
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reconcile, setReconcile] = useState(false)
  const busyRef = useRef(false)
  const available = set.status === 'disabled' ? ['activate', 'archive']
    : set.status === 'active' ? ['disable', 'archive'] : ['restore']
  if (set.status !== 'active' && quizCount === 0) available.push('delete')

  async function execute() {
    if (!confirm || busyRef.current || reconcile) return
    const action = confirm
    busyRef.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (action === 'delete') {
        await deleteGeneralPracticeSet(set.id, set.version)
        onDelete()
      } else {
        const updated = await transitionGeneralPracticeSet(set.id, set.version, action)
        if (updated.id !== set.id || updated.version !== set.version + 1 || updated.status !== ({ activate: 'active', disable: 'disabled', archive: 'archived', restore: 'disabled' })[action]) throw new Error('The Set transition could not be confirmed.')
        onChange(updated)
        setNotice(`${actions[action].label} confirmed. Current Set status: ${updated.status}.`)
      }
    } catch (failure) {
      if (failure.status === 409) { setReconcile(true); setError('This Set changed or the action is no longer allowed. Reload the current Set before trying again.') }
      else if (failure.status === 401 || failure.status === 403) setError('Admin access is required to manage this Set.')
      else if (failure.status === 404) { setReconcile(true); setError('This Set is no longer available. Reload before trying again.') }
      else if (failure.status === 400) setError(failure.message || 'The requested Set action is invalid.')
      else { setReconcile(true); setError('The action outcome is uncertain. Reload the current Set before trying again.') }
    } finally { busyRef.current = false; setBusy(false); setConfirm(null) }
  }

  async function reload() {
    setBusy(true)
    try { await onReload(); setReconcile(false); setError(''); setNotice('') }
    catch { setError('Unable to reload the Set. Do not retry the action yet.') }
    finally { setBusy(false) }
  }

  return <section aria-label="Quiz Set management" className="mb-6 rounded-2xl border border-[#2D2E30]/10 bg-white p-5 sm:p-6">
    <h2 className="text-lg font-bold text-[#2D2E30]">Manage Quiz Set</h2>
    <p className="mt-1 text-sm text-[#765F55]">Set status: {set.status} · Version {set.version}. Quiz statuses remain separate.</p>
    {set.status === 'disabled' ? <p className="mt-2 text-sm text-[#765F55]">Published quizzes are not available for new learner sessions while this Set is Disabled.</p> : null}
    {error ? <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p> : null}
    {reconcile ? <button type="button" disabled={busy} onClick={reload} className="mt-3 min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E58C1A] disabled:opacity-50">Reload current Set</button> : null}
    <div className="mt-4 flex flex-wrap gap-2">{available.map((action) => <button key={action} type="button" disabled={busy || reconcile} onClick={() => setConfirm(action)} className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-50 ${action === 'delete' ? 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100' : 'border-[#2D2E30]/15 bg-white text-[#2D2E30] hover:bg-[#FFF4D8]'}`}>{actions[action].label}</button>)}</div>
    {set.status === 'active' ? <p className="mt-3 text-xs text-[#765F55]">Disable this Set before it can be deleted.</p> : quizCount > 0 ? <p className="mt-3 text-xs text-[#765F55]">Only empty Sets can be deleted. This Set contains {quizCount} quiz{quizCount === 1 ? '' : 'zes'}.</p> : null}
    {confirm ? <QuizDialog title={actions[confirm].title} message={actions[confirm].message} confirmText={actions[confirm].label} onConfirm={execute} onCancel={() => { if (!busyRef.current) setConfirm(null) }} busy={busy} /> : null}
  </section>
}
