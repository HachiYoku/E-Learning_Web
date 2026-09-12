import { useEffect, useState } from "react"
import { Headphones, Mail, MessageCircleQuestion, Plus, Send } from "lucide-react"
import { createSupportTicket, fetchMySupportTickets } from "../services/supportTicketService"

const categories = [
  { value: "course", label: "Course access" }, { value: "payment", label: "Payment or order" }, { value: "technical", label: "Technical problem" }, { value: "learning", label: "Learning question" }, { value: "general", label: "General support" },
]
const statusLabel = { open: "Open", in_progress: "In progress", resolved: "Resolved" }
const statusClass = { open: "bg-[#FFF1D0] text-[#9A5816]", in_progress: "bg-[#E8F3FA] text-[#367599]", resolved: "bg-[#E9F4EA] text-[#4D7C57]" }

function StudentSupport() {
  const [tickets, setTickets] = useState([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState({ category: "general", subject: "", message: "" })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const loadTickets = () => fetchMySupportTickets().then(setTickets).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false))
  useEffect(() => { loadTickets() }, [])
  const submit = async (event) => {
    event.preventDefault(); setSubmitting(true); setError("")
    try { const ticket = await createSupportTicket(form); setTickets((current) => [ticket, ...current]); setForm({ category: "general", subject: "", message: "" }); setIsFormOpen(false) }
    catch (submitError) { setError(submitError.message) } finally { setSubmitting(false) }
  }

  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-10">
    <div className="flex flex-col gap-4 border-b border-[#2D2E30]/10 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Student support</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Help &amp; support</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-[#765F55] sm:text-base">Send a question to the Arun Thai team and track the reply here.</p></div><button type="button" onClick={() => setIsFormOpen((current) => !current)} className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E58C1A]"><Plus className="h-4 w-4" />New request</button></div>
    {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    {isFormOpen ? <form onSubmit={submit} className="mt-6 rounded-[1.5rem] border border-[#E58C1A]/20 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1D0] text-[#C97112]"><MessageCircleQuestion className="h-5 w-5" /></span><div><h2 className="font-bold">Send a support request</h2><p className="text-sm text-[#765F55]">We will reply in this space when we can help.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Topic<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-3 py-3 text-sm outline-none focus:border-[#E58C1A]">{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label className="text-sm font-bold">Subject<input required value={form.subject} maxLength="160" onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-3 py-3 text-sm outline-none focus:border-[#E58C1A]" placeholder="What do you need help with?" /></label></div><label className="mt-4 block text-sm font-bold">Message<textarea required rows="5" maxLength="2000" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className="mt-2 w-full resize-y rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-3 py-3 text-sm outline-none focus:border-[#E58C1A]" placeholder="Tell us what happened and how we can help." /></label><div className="mt-5 flex flex-wrap gap-3"><button disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white hover:bg-[#E58C1A] disabled:opacity-60"><Send className="h-4 w-4" />{submitting ? "Sending…" : "Send request"}</button><button type="button" onClick={() => setIsFormOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-[#765F55] hover:bg-[#FFF1D0]">Cancel</button></div></form> : null}
    <section className="mt-7"><div className="mb-4 flex items-center gap-2"><Headphones className="h-5 w-5 text-[#C97112]" /><h2 className="text-lg font-bold">Your requests</h2></div>{loading ? <p className="py-8 text-sm text-[#765F55]">Loading your requests…</p> : tickets.length === 0 ? <div className="rounded-2xl border border-dashed border-[#D9CEBE] bg-white px-5 py-10 text-center"><Mail className="mx-auto h-6 w-6 text-[#C97112]" /><p className="mt-3 font-bold">No support requests yet</p><p className="mt-1 text-sm text-[#765F55]">Use New request if you need help with your learning account.</p></div> : <div className="space-y-4">{tickets.map((ticket) => <article key={ticket._id} className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C97112]">{categories.find((item) => item.value === ticket.category)?.label || "Support"}</p><h3 className="mt-1 font-bold">{ticket.subject}</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[ticket.status]}`}>{statusLabel[ticket.status]}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#765F55]">{ticket.message}</p>{ticket.replies?.map((reply) => <div key={reply._id} className="mt-4 rounded-xl bg-[#FFF9EA] p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#C97112]">Arun Thai support</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#2D2E30]">{reply.message}</p></div>)}<p className="mt-4 text-xs text-[#9A8775]">Updated {new Date(ticket.updatedAt).toLocaleDateString()}</p></article>)}</div>}</section>
  </div>
}
export default StudentSupport
