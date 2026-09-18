import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Headphones, Mail, MessageCircleQuestion, Plus, Send } from "lucide-react"
import { createSupportTicket, fetchMySupportTickets, replyToSupportTicket } from "../services/supportTicketService"

const categories = [
  { value: "course", label: "Course access" }, { value: "payment", label: "Payment or order" }, { value: "technical", label: "Technical problem" }, { value: "learning", label: "Learning question" }, { value: "general", label: "General support" },
]
const subjectsByCategory = {
  course: ["Course access", "Lesson progress", "Course content", "Certificate question"],
  payment: ["Payment issue", "Order status", "Refund request", "Promo code problem"],
  technical: ["Cannot sign in", "Website issue", "Video or audio problem", "Other technical problem"],
  learning: ["Question about a lesson", "Practice activity question", "Learning recommendation", "Other learning question"],
  general: ["General question", "Account question", "Feedback", "Other request"],
}
const statusLabel = { open: "Open", in_progress: "In progress", resolved: "Resolved" }
const statusClass = { open: "bg-[#FFF1D0] text-[#9A5816]", in_progress: "bg-[#E8F3FA] text-[#367599]", resolved: "bg-[#E9F4EA] text-[#4D7C57]" }
const fieldClass = "mt-2 h-12 w-full rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-3.5 text-sm text-[#2D2E30] shadow-[0_1px_2px_rgba(45,46,48,0.03)] outline-none transition placeholder:text-[#9A8775] hover:border-[#E58C1A]/35 focus:border-[#E58C1A] focus:bg-white focus:ring-4 focus:ring-[#E58C1A]/10"
const formatMessageDate = (date) => date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)) : ""

function SupportSelect({ id, label, hint, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef(null)

  useEffect(() => {
    const closeOnOutsideClick = (event) => { if (!selectRef.current?.contains(event.target)) setIsOpen(false) }
    const closeOnEscape = (event) => { if (event.key === "Escape") setIsOpen(false) }
    document.addEventListener("mousedown", closeOnOutsideClick)
    document.addEventListener("keydown", closeOnEscape)
    return () => { document.removeEventListener("mousedown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape) }
  }, [])

  const selectedOption = options.find((option) => option.value === value) || options[0]

  return <div ref={selectRef} className="relative"><div className="flex items-center justify-between text-sm font-bold text-[#2D2E30]"><label id={`${id}-label`}>{label}</label><span className="text-xs font-medium text-[#9A8775]">{hint}</span></div><button type="button" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen} aria-haspopup="listbox" aria-labelledby={`${id}-label`} className={`${fieldClass} flex items-center justify-between text-left font-medium`}><span className="truncate">{selectedOption.label}</span><ChevronDown aria-hidden="true" className={`ml-3 h-4 w-4 shrink-0 text-[#C97112] transition ${isOpen ? "rotate-180" : ""}`} /></button>{isOpen ? <div role="listbox" aria-labelledby={`${id}-label`} className="absolute z-30 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-[#E58C1A]/20 bg-white p-1.5 shadow-[0_18px_35px_-16px_rgba(45,46,48,0.35)]">{options.map((option) => { const isSelected = option.value === value; return <button type="button" role="option" aria-selected={isSelected} key={option.value} onClick={() => { onChange(option.value); setIsOpen(false) }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${isSelected ? "bg-[#FFF1D0] text-[#9A5816]" : "text-[#2D2E30] hover:bg-[#FFF9EA]"}`}><span>{option.label}</span>{isSelected ? <Check aria-hidden="true" className="h-4 w-4" /> : null}</button> })}</div> : null}</div>
}

function StudentSupport() {
  const [tickets, setTickets] = useState([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState({ category: "general", subject: subjectsByCategory.general[0], message: "" })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState({})
  const [replyingTicketId, setReplyingTicketId] = useState("")
  const [reopeningTicketId, setReopeningTicketId] = useState("")
  const [error, setError] = useState("")

  const loadTickets = () => fetchMySupportTickets().then(setTickets).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false))
  useEffect(() => { loadTickets() }, [])
  const submit = async (event) => {
    event.preventDefault(); setSubmitting(true); setError("")
    try { const ticket = await createSupportTicket(form); setTickets((current) => [ticket, ...current]); setForm({ category: "general", subject: subjectsByCategory.general[0], message: "" }); setIsFormOpen(false) }
    catch (submitError) { setError(submitError.message) } finally { setSubmitting(false) }
  }
  const submitReply = async (event, ticketId) => {
    event.preventDefault()
    const message = replyDrafts[ticketId]?.trim()
    if (!message) return
    setReplyingTicketId(ticketId); setError("")
    try { const ticket = await replyToSupportTicket(ticketId, message); setTickets((current) => current.map((item) => item._id === ticket._id ? ticket : item)); setReplyDrafts((current) => ({ ...current, [ticketId]: "" })); setReopeningTicketId("") }
    catch (replyError) { setError(replyError.message) } finally { setReplyingTicketId("") }
  }

  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-10">
    <div className="flex flex-col gap-4 border-b border-[#2D2E30]/10 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Student support</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Help &amp; support</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-[#765F55] sm:text-base">Send a question to the Arun Thai team and track the reply here.</p></div><button type="button" onClick={() => setIsFormOpen((current) => !current)} className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E58C1A]"><Plus className="h-4 w-4" />New request</button></div>
    {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    {isFormOpen ? <form onSubmit={submit} className="mt-6 rounded-[1.5rem] border border-[#E58C1A]/20 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1D0] text-[#C97112]"><MessageCircleQuestion className="h-5 w-5" /></span><div><h2 className="font-bold">Send a support request</h2><p className="text-sm text-[#765F55]">We will reply in this space when we can help.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><SupportSelect id="support-topic" label="Topic" hint="Choose one" value={form.category} options={categories} onChange={(category) => setForm((current) => ({ ...current, category, subject: subjectsByCategory[category][0] }))} /><SupportSelect id="support-subject" label="Subject" hint="Choose one" value={form.subject} options={subjectsByCategory[form.category].map((subject) => ({ value: subject, label: subject }))} onChange={(subject) => setForm((current) => ({ ...current, subject }))} /></div><label className="mt-4 block text-sm font-bold">Message<textarea required rows="5" maxLength="2000" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className="mt-2 w-full resize-y rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-3 py-3 text-sm outline-none focus:border-[#E58C1A]" placeholder="Tell us what happened and how we can help." /></label><div className="mt-5 flex flex-wrap gap-3"><button disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white hover:bg-[#E58C1A] disabled:opacity-60"><Send className="h-4 w-4" />{submitting ? "Sending…" : "Send request"}</button><button type="button" onClick={() => setIsFormOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-[#765F55] hover:bg-[#FFF1D0]">Cancel</button></div></form> : null}
    <section className="mt-7"><div className="mb-4 flex items-center gap-2"><Headphones className="h-5 w-5 text-[#C97112]" /><h2 className="text-lg font-bold">Your requests</h2></div>{loading ? <p className="py-8 text-sm text-[#765F55]">Loading your requests…</p> : tickets.length === 0 ? <div className="rounded-2xl border border-dashed border-[#D9CEBE] bg-white px-5 py-10 text-center"><Mail className="mx-auto h-6 w-6 text-[#C97112]" /><p className="mt-3 font-bold">No support requests yet</p><p className="mt-1 text-sm text-[#765F55]">Use New request if you need help with your learning account.</p></div> : <div className="space-y-4">{tickets.map((ticket) => { const isReopening = reopeningTicketId === ticket._id; const canReply = ticket.status !== "resolved" || isReopening; return <article key={ticket._id} className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C97112]">{categories.find((item) => item.value === ticket.category)?.label || "Support"}</p><h3 className="mt-1 font-bold">{ticket.subject}</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[ticket.status]}`}>{statusLabel[ticket.status]}</span></div><div className="mt-3"><p className="whitespace-pre-wrap text-sm leading-relaxed text-[#765F55]">{ticket.message}</p><p className="mt-2 text-xs text-[#9A8775]">{ticket.createdAt ? `You · ${formatMessageDate(ticket.createdAt)}` : "You"}</p></div>{ticket.replies?.map((reply) => { const isStudentReply = reply.authorRole === "user"; const sender = isStudentReply ? "You" : "Arun Thai support"; return <div key={reply._id} className={`mt-4 rounded-xl p-4 ${isStudentReply ? "border border-[#2D2E30]/10 bg-[#FFFDF8]" : "bg-[#FFF9EA]"}`}><p className={`text-xs font-bold uppercase tracking-[0.12em] ${isStudentReply ? "text-[#765F55]" : "text-[#C97112]"}`}>{sender}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#2D2E30]">{reply.message}</p><p className="mt-2 text-xs text-[#9A8775]">{reply.createdAt ? `${sender} · ${formatMessageDate(reply.createdAt)}` : sender}</p></div> })}{canReply ? <form onSubmit={(event) => submitReply(event, ticket._id)} className="mt-4 border-t border-[#2D2E30]/10 pt-4"><label className="text-sm font-bold text-[#2D2E30]">{ticket.status === "resolved" ? "Reply to reopen this request" : "Reply to support"}<textarea required rows="3" maxLength="2000" value={replyDrafts[ticket._id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [ticket._id]: event.target.value }))} className="mt-2 w-full resize-y rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-3 py-3 text-sm outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" placeholder="Write a reply…" /></label><button disabled={replyingTicketId === ticket._id || !replyDrafts[ticket._id]?.trim()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E58C1A] disabled:opacity-60"><Send className="h-4 w-4" />{replyingTicketId === ticket._id ? "Sending…" : ticket.status === "resolved" ? "Reopen and send" : "Send reply"}</button></form> : <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#E9F4EA] px-4 py-3"><p className="text-sm text-[#397445]">This request is resolved. Need more help?</p><button type="button" onClick={() => setReopeningTicketId(ticket._id)} className="rounded-lg border border-[#4D7C57]/30 bg-white px-3 py-2 text-sm font-bold text-[#246B35] transition hover:border-[#4D7C57]/55 hover:bg-[#F5FBF5] focus:outline-none focus:ring-4 focus:ring-[#4D7C57]/10">Reopen request</button></div>}</article> })}</div>}</section>
  </div>
}
export default StudentSupport
