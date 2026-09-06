import { AlertCircle, Clock3, MailCheck, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchPendingVerifications } from '../../services/userService'

const formatDate = (value) => value
  ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not available'

function PendingVerifications() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadPendingVerifications = async () => {
    try {
      setLoading(true)
      setError('')
      setUsers(await fetchPendingVerifications())
    } catch (loadError) {
      setError(loadError.message || 'Unable to load pending verification accounts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPendingVerifications()
  }, [])

  return (
    <main className="min-h-full bg-[#FFFDF8] p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112] sm:text-xs">Account safety</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl md:text-4xl">Pending verification</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#765F55]">Accounts appear here until their email address is verified. They are kept separate from active users.</p>
        </div>
        <button type="button" onClick={loadPendingVerifications} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E58C1A]/30 bg-white px-4 py-2.5 text-sm font-bold text-[#765F55] transition hover:border-[#E58C1A] hover:text-[#C97112] disabled:cursor-not-allowed disabled:opacity-60">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error ? <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" />{error}</div> : null}

      <section className="overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)]">
        <div className="flex items-center gap-3 border-b border-[#2D2E30]/10 bg-[#FFF9EA] px-4 py-4 sm:px-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF1CE] text-[#C97112]"><MailCheck size={20} /></span>
          <div><h2 className="font-bold text-[#2D2E30]">Awaiting email confirmation</h2><p className="text-xs text-[#765F55]">{users.length} {users.length === 1 ? 'account' : 'accounts'} pending</p></div>
        </div>

        {loading ? <div className="px-6 py-14 text-center text-sm text-[#765F55]">Loading pending accounts…</div> : users.length === 0 ? <div className="px-6 py-14 text-center"><MailCheck size={30} className="mx-auto mb-3 text-[#7AB589]" /><p className="font-bold text-[#2D2E30]">No accounts are waiting for verification.</p><p className="mt-1 text-sm text-[#765F55]">New registrations will appear here until they confirm their email.</p></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[700px]"><thead><tr className="border-b border-[#2D2E30]/10 text-left"><th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#765F55] sm:px-6">Account</th><th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#765F55]">Registered</th><th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#765F55]">Verification link expires</th><th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#765F55] sm:px-6">Account expires</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-[#2D2E30]/8 last:border-0 hover:bg-[#FFF4D8]/35"><td className="px-4 py-4 sm:px-6"><p className="font-semibold text-[#2D2E30]">{user.name || 'Unnamed user'}</p><p className="mt-0.5 text-sm text-[#765F55]">{user.email}</p></td><td className="px-4 py-4 text-sm text-[#765F55]">{formatDate(user.createdAt)}</td><td className="px-4 py-4 text-sm text-[#765F55]">{formatDate(user.verificationTokenExpires)}</td><td className="px-4 py-4 text-sm text-[#765F55] sm:px-6"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF1CE] px-2.5 py-1 text-xs font-bold text-[#A86710]"><Clock3 size={13} />{formatDate(user.unverifiedExpiresAt)}</span></td></tr>)}</tbody></table></div>
        )}
      </section>
    </main>
  )
}

export default PendingVerifications
