import { Archive, LockKeyhole, Plus, Trash2, X } from "lucide-react";
import PromoCodeForm from "./PromoCodeForm";
import { useEffect, useState } from "react";
import { createPromoCode, deletePromoCode, fetchPromoCodes, updatePromoCode } from "../../services/promoCodeService";
import { fetchCourses } from "../../services/courseService";

const blank = () => ({ code: "", discountType: "percent", discountValue: "", usageLimit: "", startsAt: "", expiresAt: "", applicableCourses: [], isActive: true });
const isoDate = (value) => value ? String(value).slice(0, 10) : "";
const getPromoStatus = (promo) => {
  const now = new Date();
  if (promo.archivedAt) return { label: "Archived", className: "bg-gray-200 text-gray-600" };
  if (!promo.isActive) return { label: "Inactive", className: "bg-gray-100 text-gray-500" };
  if (promo.startsAt && new Date(promo.startsAt) > now) return { label: "Scheduled", className: "bg-blue-50 text-blue-700" };
  if (promo.expiresAt && new Date(promo.expiresAt) < now) return { label: "Expired", className: "bg-[#FFF0EE] text-[#A34D45]" };
  if (promo.usageLimit && promo.usageCount >= promo.usageLimit) return { label: "Exhausted", className: "bg-[#FFF1D0] text-[#9A5816]" };
  return { label: "Active", className: "bg-[#E9F4EA] text-[#246B35]" };
};

function PromoCodes() {
  const [codes, setCodes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);

  const load = () => fetchPromoCodes().then(setCodes).catch((err) => setError(err.message));
  useEffect(() => { load(); fetchCourses().then(setCourses).catch((err) => setError(err.message)); }, []);
  const change = (key, value) => setForm((item) => ({ ...item, [key]: value }));
  const used = Boolean(form?.hasHistory);
  const payload = () => ({ ...form, discountValue: Number(form.discountValue), usageLimit: form.usageLimit ? Number(form.usageLimit) : null, startsAt: used ? form._startsAtRaw : (form.startsAt || null), expiresAt: used ? form._expiresAtRaw : (form.expiresAt || null), applicableCourses: form.applicableCourses || [] });
  const openEdit = (promo) => setForm({ ...promo, _startsAtRaw: promo.startsAt || null, _expiresAtRaw: promo.expiresAt || null, startsAt: isoDate(promo.startsAt), expiresAt: isoDate(promo.expiresAt), usageLimit: promo.usageLimit || "", applicableCourses: (promo.applicableCourses || []).map((course) => String(course._id || course)) });
  const requestCreate = (event) => { event.preventDefault(); setAdminPassword(""); setVerificationError(""); setConfirmOpen(true); };
  const confirmCreate = async () => {
    if (saving) return;
    if (!adminPassword.trim()) return setVerificationError("Enter your admin password to save this promo code.");
    try {
      setSaving(true); setVerificationError("");
      const saved = form._id
        ? await updatePromoCode(form._id, payload(), adminPassword)
        : await createPromoCode(payload(), adminPassword);
      setCodes((items) => form._id ? items.map((item) => item._id === saved._id ? saved : item) : [saved, ...items]);
      setForm(null); setConfirmOpen(false); setAdminPassword("");
    } catch (err) {
      setVerificationError(err.status === 403 ? "Incorrect admin password. Please try again." : err.message);
      setAdminPassword("");
    } finally { setSaving(false); }
  };
  const confirmDelete = async () => { if (!deletePassword.trim()) return setDeleteError("Enter your admin password to continue."); try { setDeleteSaving(true); setDeleteError(""); const result = await deletePromoCode(deleteTarget._id, deletePassword); setCodes((items) => result.archived ? items.map((item) => item._id === deleteTarget._id ? result.promo : item) : items.filter((item) => item._id !== deleteTarget._id)); setDeleteTarget(null); setDeletePassword(""); } catch (err) { setDeleteError(err.status === 403 ? "Incorrect admin password. Please try again." : err.message); } finally { setDeleteSaving(false); } };

  return <div className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8"><div className="mx-auto max-w-6xl">
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#C97112]">Manual payment discounts</p><h1 className="mt-2 text-3xl font-bold text-[#2D2E30] sm:text-4xl">Promo codes</h1><p className="mt-2 text-[#765F55]">Create and manage discounts before learners upload a transfer receipt.</p></div><button onClick={() => { setForm(blank()); setError(""); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 font-bold text-white transition hover:bg-[#E58C1A]"><Plus size={18} /> Create code</button></header>
    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {form && <PromoCodeForm key={form._id || "new"} form={form} courses={courses} change={change} saving={saving} onSubmit={requestCreate} onClose={() => setForm(null)} />}
    <div className="overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white">{codes.length ? codes.map((code) => { const status = getPromoStatus(code); const scope = code.applicableCourses?.length ? code.applicableCourses.map((course) => course.title || "Selected course").join(", ") : "All courses"; return <div key={code._id} className="flex flex-col gap-3 border-b border-[#2D2E30]/10 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><code className="rounded-lg bg-[#FFF1CE] px-2 py-1 font-bold text-[#9A5816]">{code.code}</code><span className={`rounded-full px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>{code.hasHistory && <span className="rounded-full bg-[#F3E9D9] px-2 py-1 text-xs font-bold text-[#765F55]">Used history</span>}</div><p className="mt-2 text-sm text-[#765F55]">{code.discountType === "percent" ? `${code.discountValue}% off` : `THB ${code.discountValue} off`} · Usage {code.usageCount}{code.usageLimit ? ` / ${code.usageLimit}` : " / Unlimited"} · {scope}</p><p className="mt-1 text-xs text-[#9A8775]">{code.startsAt ? `Starts ${new Date(code.startsAt).toLocaleDateString()} · ` : "Starts immediately · "}{code.expiresAt ? `Ends ${new Date(code.expiresAt).toLocaleDateString()}` : "No expiry"}</p></div><div className="flex gap-2"><button onClick={() => openEdit(code)} className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-[#FFF4D8]">Edit</button><button onClick={() => { setDeleteTarget(code); setDeletePassword(""); setDeleteError(""); }} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-[#A34D45] hover:bg-[#FFF0EE]">{code.hasHistory ? <Archive size={15} /> : <Trash2 size={15} />}{code.hasHistory ? "Archive" : "Delete"}</button></div></div> }) : <div className="p-10 text-center text-[#765F55]">No promo codes yet.</div>}</div>
    {deleteTarget && <PasswordModal title={deleteTarget.hasHistory ? "Archive promo code" : "Delete promo code"} description={deleteTarget.hasHistory ? <>This code has payment history, so it will be archived and no longer usable. Its financial history will remain intact.</> : <>This permanently deletes <strong className="text-[#2D2E30]">{deleteTarget.code}</strong>. Enter your admin password to continue.</>} password={deletePassword} error={deleteError} saving={deleteSaving} onChange={setDeletePassword} onConfirm={confirmDelete} onClose={() => !deleteSaving && setDeleteTarget(null)} dangerous />}
    {confirmOpen && <PasswordModal title={form?._id ? "Save promo changes" : "Create promo code"} confirmLabel={form?._id ? "Confirm and save" : "Confirm and create"} description={<>Enter your admin password to {form?._id ? "save changes to" : "create"} <strong className="text-[#2D2E30]">{form?.code || "this promo code"}</strong>.</>} password={adminPassword} error={verificationError} saving={saving} onChange={setAdminPassword} onConfirm={confirmCreate} onClose={() => { if (!saving) { setConfirmOpen(false); setAdminPassword(""); setVerificationError(""); } }} />}
  </div></div>;
}

function PasswordModal({ title, description, password, error, saving, onChange, onConfirm, onClose, dangerous = false, confirmLabel = "Confirm and create" }) { const accent = dangerous ? "#A34D45" : "#C97112"; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/65 p-4 backdrop-blur-sm"><div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#E58C1A]/20 bg-[#FFFDF8] shadow-[0_28px_70px_-26px_rgba(45,46,48,.65)]" role="dialog" aria-modal="true"><div className={`h-1.5 ${dangerous ? "bg-[#A34D45]" : "bg-gradient-to-r from-[#E58C1A] via-[#F8C56A] to-[#FFF1CE]"}`} /><div className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className={`rounded-2xl p-3 ${dangerous ? "bg-[#FFF0EE] text-[#A34D45]" : "bg-[#FFF1CE] text-[#C97112]"}`}><LockKeyhole size={21} /></span><div><p className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: accent }}>Security confirmation</p><h2 className="mt-1 text-xl font-bold text-[#2D2E30]">{title}</h2></div></div><button type="button" onClick={onClose} disabled={saving} className="rounded-xl p-2 text-[#765F55] hover:bg-[#FFF1CE]" aria-label="Close confirmation"><X size={19} /></button></div><p className="mt-5 text-sm leading-6 text-[#765F55]">{description}</p>{error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<label className="mt-5 block text-sm font-bold text-[#2D2E30]">Admin password<input autoFocus type="password" value={password} onChange={(e) => onChange(e.target.value)} placeholder="Enter your admin password" className="input text-sm font-normal" disabled={saving} autoComplete="current-password" /></label><div className="mt-6 flex justify-end gap-3 border-t border-[#2D2E30]/10 pt-5"><button type="button" onClick={onClose} disabled={saving} className="button-secondary">Cancel</button><button type="button" onClick={onConfirm} disabled={saving} className={`px-4 py-2.5 font-bold text-white disabled:opacity-60 ${dangerous ? "rounded-xl bg-[#A34D45] hover:bg-[#8D4039]" : "button-primary"}`}>{saving ? "Working..." : dangerous ? "Continue" : confirmLabel}</button></div></div></div></div>; }

export default PromoCodes;
