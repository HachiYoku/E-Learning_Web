import { LockKeyhole, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPromoCode, deletePromoCode, fetchPromoCodes, updatePromoCode } from "../../services/promoCodeService";

const blank = () => ({ code: "", discountType: "percent", discountValue: "", usageLimit: "", expiresAt: "", isActive: true });
const getPromoStatus = (code) => {
  if (!code.isActive) return { label: "Inactive", className: "bg-gray-100 text-gray-500" };
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return { label: "Expired", className: "bg-[#FFF0EE] text-[#A34D45]" };
  if (code.usageLimit && code.usageCount >= code.usageLimit) return { label: "Used up", className: "bg-[#FFF1D0] text-[#9A5816]" };
  return { label: "Active", className: "bg-[#E9F4EA] text-[#246B35]" };
};

function PromoCodes() {
  const [codes, setCodes] = useState([]);
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
  useEffect(() => { load(); }, []);

  const change = (key, value) => setForm((item) => ({ ...item, [key]: value }));
  const payload = () => ({ ...form, discountValue: Number(form.discountValue), usageLimit: form.usageLimit ? Number(form.usageLimit) : null, expiresAt: form.expiresAt || null });
  const saveEdit = async () => {
    try {
      setSaving(true);
      const saved = await updatePromoCode(form._id, payload());
      setCodes((items) => items.map((item) => item._id === saved._id ? saved : item));
      setForm(null);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const requestCreate = (event) => { event.preventDefault(); if (form._id) return saveEdit(); setAdminPassword(""); setVerificationError(""); setConfirmOpen(true); };
  const confirmCreate = async () => {
    if (!adminPassword.trim()) return setVerificationError("Enter your admin password to create this promo code.");
    try {
      setSaving(true); setVerificationError("");
      const saved = await createPromoCode(payload(), adminPassword);
      setCodes((items) => [saved, ...items]); setForm(null); setConfirmOpen(false); setAdminPassword("");
    } catch (err) { setVerificationError(err.status === 403 ? "Incorrect admin password. Please try again." : err.message); } finally { setSaving(false); }
  };
  const closeConfirm = () => { if (!saving) { setConfirmOpen(false); setAdminPassword(""); setVerificationError(""); } };
  const requestDelete = (code) => { setDeleteTarget(code); setDeletePassword(""); setDeleteError(""); };
  const closeDelete = () => { if (!deleteSaving) { setDeleteTarget(null); setDeletePassword(""); setDeleteError(""); } };
  const confirmDelete = async () => {
    if (!deletePassword.trim()) return setDeleteError("Enter your admin password to delete this promo code.");
    try {
      setDeleteSaving(true); setDeleteError("");
      await deletePromoCode(deleteTarget._id, deletePassword);
      setCodes((items) => items.filter((item) => item._id !== deleteTarget._id));
      setDeleteTarget(null); setDeletePassword("");
    } catch (err) { setDeleteError(err.status === 403 ? "Incorrect admin password. Please try again." : err.message); } finally { setDeleteSaving(false); }
  };

  return <div className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8"><div className="mx-auto max-w-6xl">
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#C97112]">Manual payment discounts</p><h1 className="mt-2 text-3xl font-bold text-[#2D2E30] sm:text-4xl">Promo codes</h1><p className="mt-2 text-[#765F55]">Create codes learners can apply before uploading a transfer receipt.</p></div><button onClick={() => { setForm(blank()); setError(""); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 font-bold text-white hover:bg-[#E58C1A]"><Plus size={18} /> Create code</button></header>
    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {form && <form onSubmit={requestCreate} className="mb-7 rounded-3xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-5"><h2 className="text-xl font-bold">{form._id ? "Edit promo code" : "New promo code"}</h2>{!form._id && <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/75 px-3 py-2 text-sm text-[#765F55]"><ShieldCheck size={17} className="text-[#C97112]" /> Password verification is required before this code is created.</div>}<div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Code"><input required value={form.code} onChange={(e) => change("code", e.target.value.toUpperCase())} placeholder="WELCOME20" className="input" /></Field><Field label="Discount type"><select value={form.discountType} onChange={(e) => change("discountType", e.target.value)} className="input"><option value="percent">Percentage (%)</option><option value="fixed">Fixed amount (THB)</option></select></Field><Field label="Discount value"><input required type="number" min="0.01" value={form.discountValue} onChange={(e) => change("discountValue", e.target.value)} className="input" /></Field><Field label="Total use limit (optional)"><input type="number" min="1" value={form.usageLimit || ""} onChange={(e) => change("usageLimit", e.target.value)} className="input" /></Field><Field label="Expiry date (optional)"><input type="date" value={form.expiresAt ? String(form.expiresAt).slice(0, 10) : ""} onChange={(e) => change("expiresAt", e.target.value)} className="input" /></Field><label className="flex items-end gap-2 pb-3 text-sm font-bold"><input type="checkbox" checked={form.isActive} onChange={(e) => change("isActive", e.target.checked)} /> Active now</label>
    </div><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setForm(null)} className="rounded-xl px-4 py-2.5 font-bold">Cancel</button><button disabled={saving} className="rounded-xl bg-[#2D2E30] px-5 py-2.5 font-bold text-white hover:bg-[#E58C1A]">{form._id ? (saving ? "Saving..." : "Save changes") : "Continue to verification"}</button></div></form>}
    <div className="overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white">{codes.length ? codes.map((code) => { const status = getPromoStatus(code); return <div key={code._id} className="flex flex-col gap-3 border-b border-[#2D2E30]/10 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><code className="rounded-lg bg-[#FFF1CE] px-2 py-1 font-bold text-[#9A5816]">{code.code}</code><span className={`rounded-full px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span></div><p className="mt-2 text-sm text-[#765F55]">{code.discountType === "percent" ? `${code.discountValue}% off` : `THB ${code.discountValue} off`} · Used {code.usageCount}{code.usageLimit ? ` / ${code.usageLimit}` : ""}{code.expiresAt ? ` · Expires ${new Date(code.expiresAt).toLocaleDateString()}` : ""}</p></div><div className="flex gap-2"><button onClick={() => setForm({ ...code, usageLimit: code.usageLimit || "" })} className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-[#FFF4D8]">Edit</button><button onClick={() => requestDelete(code)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-[#A34D45] hover:bg-[#FFF0EE]"><Trash2 size={15} /> Delete</button></div></div> }) : <div className="p-10 text-center text-[#765F55]">No promo codes yet.</div>}</div>
    {deleteTarget && <PasswordModal title="Delete promo code" description={<>This permanently deletes <strong className="text-[#2D2E30]">{deleteTarget.code}</strong>. Enter your admin password to continue.</>} password={deletePassword} error={deleteError} saving={deleteSaving} onChange={setDeletePassword} onConfirm={confirmDelete} onClose={closeDelete} dangerous />}
    {confirmOpen && <PasswordModal title="Create promo code" description={<>Enter your admin password to create <strong className="text-[#2D2E30]">{form?.code || "this promo code"}</strong>.</>} password={adminPassword} error={verificationError} saving={saving} onChange={setAdminPassword} onConfirm={confirmCreate} onClose={closeConfirm} />}
  </div></div>;
}

function PasswordModal({ title, description, password, error, saving, onChange, onConfirm, onClose, dangerous = false }) {
  const accent = dangerous ? "#A34D45" : "#C97112";
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/65 p-4 backdrop-blur-sm"><div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#E58C1A]/20 bg-[#FFFDF8] shadow-[0_28px_70px_-26px_rgba(45,46,48,.65)]" role="dialog" aria-modal="true" aria-labelledby="promo-password-title"><div className={`h-1.5 ${dangerous ? "bg-[#A34D45]" : "bg-gradient-to-r from-[#E58C1A] via-[#F8C56A] to-[#FFF1CE]"}`} /><div className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className={`rounded-2xl p-3 ${dangerous ? "bg-[#FFF0EE] text-[#A34D45]" : "bg-[#FFF1CE] text-[#C97112]"}`}><LockKeyhole size={21} /></span><div><p className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: accent }}>Security confirmation</p><h2 id="promo-password-title" className="mt-1 text-xl font-bold text-[#2D2E30]">{title}</h2></div></div><button type="button" onClick={onClose} disabled={saving} className="rounded-xl p-2 text-[#765F55] hover:bg-[#FFF1CE]" aria-label="Close confirmation"><X size={19} /></button></div><p className="mt-5 text-sm leading-6 text-[#765F55]">{description}</p>{error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<label className="mt-5 block text-sm font-bold text-[#2D2E30]">Admin password<input autoFocus type="password" value={password} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); }} placeholder="Enter your admin password" className="input text-sm font-normal" disabled={saving} autoComplete="current-password" /></label><div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#2D2E30]/10 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={saving} className="button-secondary">Cancel</button><button type="button" onClick={onConfirm} disabled={saving} className={`px-4 py-2.5 font-bold text-white disabled:opacity-60 ${dangerous ? "rounded-xl bg-[#A34D45] hover:bg-[#8D4039]" : "button-primary"}`}>{saving ? "Working..." : dangerous ? "Delete promo code" : "Confirm and create"}</button></div></div></div></div>;
}

function Field({ label, children }) { return <label className="text-sm font-bold">{label}{children}</label>; }
export default PromoCodes;
