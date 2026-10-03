import { Film, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import ConfirmationModal from "../../components/ConfirmationModal";
import { createReel, deleteReel, fetchAdminReels, updateReel } from "../../services/reelService";

const emptyForm = () => ({ url: "", displayOrder: "0", isActive: true });

function ReelForm({ reel, onCancel, onSaved }) {
  const [form, setForm] = useState(() => reel ? { url: reel.url, displayOrder: String(reel.displayOrder), isActive: reel.isActive } : emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { url: form.url, displayOrder: Number(form.displayOrder), isActive: form.isActive };
      const saved = reel ? await updateReel(reel.id, payload) : await createReel(payload);
      onSaved(saved);
    } catch (submitError) {
      setError(submitError.message || "Unable to save Reel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-[#2D2E30]">{reel ? "Edit Reel" : "Add Reel"}</h2><p className="mt-1 text-sm text-[#765F55]">Paste a public YouTube, TikTok, Facebook video/Reel, or Facebook Share link. The platform is detected automatically.</p></div></div>
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <label className="mt-5 block text-sm font-bold text-[#2D2E30]">Social-media URL<input required type="url" value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://www.youtube.com/watch?v=..." className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-3 text-sm outline-none transition focus:border-[#E58C1A] focus:ring-2 focus:ring-[#E58C1A]/25" /></label>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end"><label className="block text-sm font-bold text-[#2D2E30] sm:w-48">Display order<input required min="0" step="1" type="number" value={form.displayOrder} onChange={(event) => setForm((current) => ({ ...current, displayOrder: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-3 text-sm outline-none transition focus:border-[#E58C1A] focus:ring-2 focus:ring-[#E58C1A]/25" /></label><label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-[#2D2E30]"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 accent-[#E58C1A]" />Active on the public Courses page</label></div>
      <div className="mt-6 flex flex-wrap gap-3"><button disabled={saving} type="submit" className="rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A] disabled:cursor-wait disabled:opacity-60">{saving ? "Saving..." : "Save Reel"}</button><button type="button" onClick={onCancel} className="rounded-xl border border-[#2D2E30]/15 px-4 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-white">Cancel</button></div>
    </form>
  );
}

function Reels() {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let active = true;
    fetchAdminReels().then((items) => { if (active) setReels(items); }).catch((loadError) => { if (active) setError(loadError.message || "Unable to load Reels."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saved = (reel) => {
    setReels((current) => {
      const withoutSaved = current.filter((item) => item.id !== reel.id);
      return [...withoutSaved, reel].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
    });
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteReel(deleting.id);
      setReels((current) => current.filter((item) => item.id !== deleting.id));
      setError("");
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete Reel.");
    } finally {
      setDeleting(null);
    }
  };

  return <div className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112] sm:text-xs">Content library</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl md:text-4xl">Manage Reels</h1><p className="mt-2 text-sm text-[#765F55] sm:text-base">Choose the public social videos shown on the Courses page.</p></div><button type="button" onClick={() => setEditing("new")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#E58C1A] sm:w-auto"><Plus size={18} />Add Reel</button></div>
    {error ? <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    {editing ? <ReelForm reel={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSaved={saved} /> : null}
    <div className="mt-6 overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-sm">{loading ? <p className="p-8 text-center text-[#765F55]">Loading Reels...</p> : reels.length === 0 ? <p className="p-8 text-center text-[#765F55]">No Reels yet. Add a public social video to get started.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[#FFF9EA] text-xs uppercase tracking-wide text-[#765F55]"><tr><th className="px-4 py-3">Platform</th><th className="px-4 py-3">URL</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Order</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{reels.map((reel) => <tr key={reel.id} className="border-t border-[#2D2E30]/8"><td className="px-4 py-4 capitalize font-semibold text-[#2D2E30]">{reel.platform}</td><td className="max-w-sm truncate px-4 py-4 text-[#765F55]" title={reel.url}>{reel.url}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${reel.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{reel.isActive ? "Active" : "Inactive"}</span></td><td className="px-4 py-4 text-[#765F55]">{reel.displayOrder}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(reel)} className="rounded-lg p-2 text-[#2D2E30] transition hover:bg-[#FFF1CE]" aria-label={`Edit ${reel.platform} Reel`}><Pencil size={17} /></button><button type="button" onClick={() => setDeleting(reel)} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50" aria-label={`Delete ${reel.platform} Reel`}><Trash2 size={17} /></button></div></td></tr>)}</tbody></table></div>}</div>
    <ConfirmationModal isOpen={Boolean(deleting)} title="Delete Reel" message="Are you sure you want to delete this Reel? This action cannot be undone." confirmText="Delete" cancelText="Cancel" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} isDangerous />
  </div>;
}

export default Reels;
