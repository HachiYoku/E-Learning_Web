import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Camera, CheckCircle2, Mail, Pencil, ShieldCheck, Trash2, UserRound, X } from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { updateProfile } from "../services/authService"

const inputClass = "w-full rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-4 py-3 text-sm font-semibold text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10"

function MyProfile() {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState("info")
  const { user, setUser, confirmAccountDeletion, deleteAccount } = useAuth()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [scheduledDeletion, setScheduledDeletion] = useState(null)
  const [deletionInProgress, setDeletionInProgress] = useState(false)
  const deletionTimerRef = useRef(null)
  const countdownTimerRef = useRef(null)
  const deletionStateRef = useRef("idle")
  const mountedRef = useRef(true)
  const userEmail = user?.email || "user@example.com"
  const userName = user?.name || "Student"
  const deletionScheduledOrInProgress = Boolean(scheduledDeletion) || deletionInProgress
  const [formData, setFormData] = useState({ userName, avatarFile: null, avatarPreview: "" })

  const profileImage = formData.avatarPreview || user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail}`
  const handleChange = (event) => setFormData((current) => ({ ...current, userName: event.target.value }))
  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFormData((current) => ({ ...current, avatarFile: file, avatarPreview: URL.createObjectURL(file) }))
    setMessage("")
  }
  const handleCancel = () => {
    setFormData({ userName, avatarFile: null, avatarPreview: "" })
    setIsEditing(false)
    setMessage("")
  }
  const handleSave = async () => {
    setIsSaving(true)
    setMessage("")
    try {
      const updatedUser = await updateProfile({ name: formData.userName, avatarFile: formData.avatarFile })
      setUser(updatedUser)
      setIsEditing(false)
      setFormData((current) => ({ ...current, avatarFile: null, avatarPreview: "" }))
      setMessage("Your profile has been updated.")
      setMessageType("success")
    } catch (error) {
      setMessage(error.message)
      setMessageType("error")
    } finally {
      setIsSaving(false)
    }
  }

  const clearScheduledDeletion = useCallback(() => {
    if (deletionTimerRef.current) window.clearTimeout(deletionTimerRef.current)
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current)
    deletionTimerRef.current = null
    countdownTimerRef.current = null
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearScheduledDeletion()
    }
  }, [clearScheduledDeletion])

  const cancelScheduledDeletion = useCallback(() => {
    if (deletionStateRef.current !== "scheduled") return
    clearScheduledDeletion()
    deletionStateRef.current = "idle"
    setScheduledDeletion(null)
    setMessage("Account deletion cancelled.")
    setMessageType("success")
  }, [clearScheduledDeletion])

  const scheduleAccountDeletion = useCallback((deletionConfirmationToken) => {
    if (deletionStateRef.current !== "idle") return false

    const endsAt = Date.now() + 5000
    deletionStateRef.current = "scheduled"
    setDeleteError("")
    setDeleteOpen(false)
    setScheduledDeletion({ secondsRemaining: 5 })

    const updateCountdown = () => {
      const secondsRemaining = Math.max(1, Math.ceil((endsAt - Date.now()) / 1000))
      setScheduledDeletion({ secondsRemaining })
    }
    countdownTimerRef.current = window.setInterval(updateCountdown, 250)
    deletionTimerRef.current = window.setTimeout(async () => {
      clearScheduledDeletion()
      deletionStateRef.current = "deleting"
      if (mountedRef.current) {
        setScheduledDeletion(null)
        setDeletionInProgress(true)
      }
      try {
        await deleteAccount(deletionConfirmationToken)
      } catch (error) {
        if (!mountedRef.current) return
        deletionStateRef.current = "idle"
        setDeletionInProgress(false)
        setDeleteError(error.message || "Unable to delete your account.")
        setDeleteOpen(true)
      }
    }, 5000)
    return true
  }, [clearScheduledDeletion, deleteAccount])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-10">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Account settings</p>
      <div className="mt-3"><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your profile</h1><p className="mt-2 text-sm leading-relaxed text-[#765F55] sm:text-base">Keep your learning account details up to date.</p></div>

      {message ? <div className={`mt-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${messageType === "success" ? "border-[#7EAF85]/30 bg-[#EDF8EE] text-[#246B35]" : "border-red-200 bg-red-50 text-red-700"}`}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{message}</div> : null}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-5">
        <section className="rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-5 shadow-[0_18px_45px_-35px_rgba(80,48,19,0.35)] sm:p-6 lg:col-span-2">
          <div className="flex items-center gap-4"><div className="flex shrink-0 flex-col items-center gap-2"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF1D0]"><img src={profileImage} alt={userName} className="size-10 rounded-xl object-cover shadow-sm" /></div><label className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-bold text-[#C97112] transition hover:bg-[#FFF1D0]"><Camera className="h-3.5 w-3.5" />Change photo<input type="file" accept="image/*" onClick={() => setIsEditing(true)} onChange={handleAvatarChange} className="hidden" /></label></div><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C97112]">Student account</p><h2 className="mt-1 truncate text-xl font-bold">{formData.userName || "Student"}</h2><p className="mt-1 truncate text-sm text-[#765F55]">{userEmail}</p></div></div>
          <div className="mt-6 rounded-2xl bg-[#FFF9EA] p-4"><div className="flex items-center gap-2 text-sm font-bold text-[#2D2E30]"><ShieldCheck className="h-4 w-4 text-[#4D7C57]" />Your student account</div><p className="mt-2 text-sm leading-relaxed text-[#765F55]">Your profile details are used to personalize your Arun Thai learning space.</p></div>
          <div className="mt-5 flex items-center justify-between border-t border-[#2D2E30]/10 pt-4"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[#765F55]">Account status</span><span className="inline-flex items-center gap-1.5 rounded-full bg-[#E9F4EA] px-2.5 py-1 text-xs font-bold text-[#4D7C57]"><span className="h-1.5 w-1.5 rounded-full bg-[#4D7C57]" />Active</span></div>
        </section>

        <section className="rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-5 shadow-[0_18px_45px_-35px_rgba(80,48,19,0.35)] sm:p-7 lg:col-span-3">
          <div className="flex items-center justify-between gap-3 border-b border-[#2D2E30]/10 pb-5"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1D0] text-[#C97112]"><UserRound className="h-5 w-5" /></span><div><h2 className="font-bold">Personal details</h2><p className="mt-0.5 text-sm text-[#765F55]">Your name and contact details.</p></div></div>{!isEditing ? <button type="button" onClick={() => setIsEditing(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2D2E30] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#E58C1A]"><Pencil className="h-3.5 w-3.5" />Edit</button> : <span className="shrink-0 rounded-full bg-[#FFF1D0] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9A5816]">Editing</span>}</div>
          <div className="mt-6 space-y-5"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#765F55]">Display name</span>{isEditing ? <input type="text" value={formData.userName} onChange={handleChange} placeholder="Enter your name" className={inputClass} /> : <div className="rounded-xl border border-[#2D2E30]/10 bg-[#FFF9EA] px-4 py-3 text-sm font-semibold">{formData.userName}</div>}</label><div><span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#765F55]">Email address</span><div className="flex items-center gap-3 rounded-xl border border-[#2D2E30]/10 bg-[#FFF9EA] px-4 py-3 text-sm font-semibold"><Mail className="h-4 w-4 shrink-0 text-[#C97112]" /><span className="min-w-0 break-all">{userEmail}</span></div></div></div>
          <div className="mt-6 rounded-2xl border border-[#E58C1A]/20 bg-[#FFF4D8]/55 p-4"><p className="text-sm font-bold text-[#2D2E30]">Need to update your email?</p><p className="mt-1 text-sm leading-relaxed text-[#765F55]">Contact Arun Thai support and we will help update your account.</p><a href="mailto:arunthaiedu@gmail.com" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#C97112] hover:underline"><Mail className="h-4 w-4" />arunthaiedu@gmail.com</a></div>
          {isEditing ? <div className="mt-6 flex flex-wrap gap-3 border-t border-[#2D2E30]/10 pt-5"><button type="button" onClick={handleSave} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A] disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />{isSaving ? "Saving…" : "Save changes"}</button><button type="button" onClick={handleCancel} className="inline-flex items-center gap-2 rounded-xl border border-[#2D2E30]/15 px-5 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA]"><X className="h-4 w-4" />Cancel</button></div> : null}
        </section>
      </div>
      <section className="mt-8 rounded-[1.75rem] border border-[#D78A86]/40 bg-[#FFF8F7] p-5 shadow-[0_18px_45px_-35px_rgba(80,48,19,0.35)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A34D45]">Danger Zone</p><h2 className="mt-2 text-xl font-bold text-[#2D2E30]">Delete Account</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-[#765F55]">Permanently delete your account and personal learning data.</p></div><button type="button" onClick={() => { setDeleteError(""); setDeleteOpen(true) }} disabled={deletionScheduledOrInProgress} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#A34D45]/35 bg-white px-4 py-3 text-sm font-bold text-[#A34D45] transition hover:bg-[#FDE8E5] disabled:cursor-not-allowed disabled:opacity-60"><Trash2 className="h-4 w-4" />Delete Account</button></div>
      </section>
      {deleteOpen ? <DeleteAccountModal error={deleteError} onClose={() => setDeleteOpen(false)} onConfirmPassword={confirmAccountDeletion} onSchedule={scheduleAccountDeletion} /> : null}
      {scheduledDeletion ? <ScheduledDeletionBanner secondsRemaining={scheduledDeletion.secondsRemaining} onUndo={cancelScheduledDeletion} /> : null}
      {deletionInProgress ? <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-[#A34D45]/35 bg-white p-4 shadow-2xl lg:bottom-6"><p className="font-bold text-[#2D2E30]">Deleting account…</p><p className="mt-1 text-sm text-[#765F55]">Your account deletion is in progress and can no longer be cancelled.</p></div> : null}
    </div>
  )
}

function DeleteAccountModal({ error: initialError, onClose, onConfirmPassword, onSchedule }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (!password.trim()) return setError("Enter your current password to continue.")
    setPending(true); setError("")
    try {
      const deletionConfirmationToken = await onConfirmPassword(password)
      onSchedule(deletionConfirmationToken)
    } catch (requestError) {
      setError(requestError.message || "Unable to confirm your password.")
      setPending(false)
    }
  }
  const displayedError = error || initialError
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/60 p-4 backdrop-blur-[2px]" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="w-full max-w-md rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-[#2D2E30]/10 p-5"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FDE8E5] text-[#A34D45]"><AlertTriangle className="h-5 w-5" /></span><div><h2 id="delete-account-title" className="text-xl font-bold text-[#2D2E30]">Delete your account?</h2><p className="mt-1 text-sm text-[#765F55]">This cannot be undone.</p></div></div><button type="button" onClick={onClose} disabled={pending} className="rounded-xl p-2 text-[#765F55] transition hover:bg-[#FFF1D0] disabled:opacity-60" aria-label="Close delete account dialog"><X className="h-5 w-5" /></button></div><form onSubmit={submit} className="p-5"><p className="text-sm leading-6 text-[#765F55]">This permanently deletes your account and personal learning data. Some transaction records may be retained for record-keeping purposes.</p><label className="mt-5 block text-sm font-bold text-[#2D2E30]">Current password<input autoFocus required type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError("") }} className={`${inputClass} mt-2`} /></label>{displayedError ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{displayedError}</p> : null}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold text-[#765F55] disabled:opacity-60">Cancel</button><button disabled={pending || !password.trim()} className="min-h-11 rounded-xl bg-[#A34D45] px-4 text-sm font-bold text-white transition hover:bg-[#8E3E37] disabled:cursor-not-allowed disabled:opacity-60">Delete Account</button></div></form></section></div>
}

function ScheduledDeletionBanner({ secondsRemaining, onUndo }) {
  return <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 flex-col gap-3 rounded-2xl border border-[#A34D45]/35 bg-white p-4 shadow-2xl sm:flex-row sm:items-center sm:justify-between lg:bottom-6"><div className="min-w-0"><p className="font-bold text-[#2D2E30]">Account deletion scheduled</p><p className="mt-1 text-sm leading-5 text-[#765F55]">Your account will be permanently deleted in {secondsRemaining} second{secondsRemaining === 1 ? "" : "s"}.</p></div><button type="button" onClick={onUndo} className="min-h-11 shrink-0 rounded-xl border border-[#A34D45]/35 px-4 text-sm font-bold text-[#A34D45] transition hover:bg-[#FDE8E5] focus:outline-none focus:ring-4 focus:ring-[#A34D45]/15">Undo</button></div>
}

export default MyProfile
