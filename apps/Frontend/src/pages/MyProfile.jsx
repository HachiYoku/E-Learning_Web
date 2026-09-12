import { useEffect, useState } from "react"
import { Camera, CheckCircle2, Mail, Pencil, ShieldCheck, UserRound, X } from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { updateProfile } from "../services/authService"

const inputClass = "w-full rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-4 py-3 text-sm font-semibold text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10"

function MyProfile() {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState("info")
  const { user, setUser } = useAuth()
  const userEmail = user?.email || "user@example.com"
  const userName = user?.name || "Student"
  const [formData, setFormData] = useState({ userName, avatarFile: null, avatarPreview: "" })

  useEffect(() => {
    setFormData({ userName, avatarFile: null, avatarPreview: "" })
  }, [userEmail, userName])

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
    </div>
  )
}

export default MyProfile
