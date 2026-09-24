import { useState } from "react";
import { Check, LockKeyhole, Search, X } from "lucide-react";
import "./PromoCodeForm.css";

const input = "mt-2 block min-w-0 w-full rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-3.5 py-3 text-sm text-[#2D2E30] outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 disabled:cursor-not-allowed disabled:opacity-60";

export default function PromoCodeForm({ form, courses, change, saving, onSubmit, onClose }) {
  const [scope, setScope] = useState(form.applicableCourses.length ? "selected" : "all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const locked = Boolean(form.hasHistory || form.archivedAt);
  const visibleCourses = courses.filter((course) => course.title.toLowerCase().includes(search.toLowerCase()));
  const submit = (event) => {
    event.preventDefault();
    if (scope === "selected" && !form.applicableCourses.length) {
      setError("Select at least one course, or choose All courses.");
      return;
    }
    setError("");
    onSubmit(event);
  };

  return (
    <form onSubmit={submit} className="mb-8 overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white text-[#2D2E30] shadow-[0_12px_30px_-24px_rgba(45,46,48,.45)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#E58C1A]/15 bg-[#FFF9EA] px-5 py-5 sm:px-7">
        <div>
          <h2 className="text-xl font-bold">{form._id ? "Edit promo code" : "New promo code"}</h2>
          <p className="mt-1 text-sm text-[#765F55]">Set a discount and choose where learners can use it.</p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close promo form" className="rounded-lg p-2 text-[#765F55] hover:bg-white focus-visible:outline-[#E58C1A]"><X size={20} /></button>
      </div>

      <div className="promo-form-body p-5 sm:p-7">
        {locked && <p className="flex items-start gap-2 rounded-xl bg-[#FFF9EA] p-3 text-sm text-[#765F55]"><LockKeyhole size={17} className="mt-0.5 shrink-0 text-[#C97112]" />{form.archivedAt ? "This promo is archived. Its details are kept for your records." : "This promo has payment history. Offer details are locked; availability can still be changed."}</p>}

        <fieldset disabled={locked || saving} className="min-w-0">
          <legend className="mb-4 text-sm font-bold">Discount details</legend>
          <div className="promo-discount-grid">
            <label className="text-sm font-semibold">Promo code
              <input required pattern="[A-Za-z0-9-]{3,40}" maxLength={40} value={form.code} onChange={(e) => change("code", e.target.value.toUpperCase())} placeholder="e.g. WELCOME20" className={`${input} font-mono tracking-wide`} />
              <span className="mt-2 block text-xs font-normal text-[#765F55]">3–40 letters, numbers or hyphens.</span>
            </label>
            <div>
              <fieldset><legend className="mb-2 text-sm font-semibold">Discount type</legend>
                <div className="promo-options">
                  <Option name="discount-type" checked={form.discountType === "percent"} onChange={() => change("discountType", "percent")}>Percentage (%)</Option>
                  <Option name="discount-type" checked={form.discountType === "fixed"} onChange={() => change("discountType", "fixed")}>Fixed amount (฿)</Option>
                </div>
              </fieldset>
            </div>
              <label className="block text-sm font-semibold">{form.discountType === "percent" ? "Percentage off" : "Amount off (THB)"}
                <input required type="number" min="0.01" step="0.01" max={form.discountType === "percent" ? 100 : undefined} value={form.discountValue} onChange={(e) => change("discountValue", e.target.value)} placeholder={form.discountType === "percent" ? "20" : "500"} className={input} />
              </label>
          </div>
        </fieldset>

        <fieldset disabled={locked || saving} className="min-w-0 border-t border-[#2D2E30]/10 pt-5">
          <legend className="pr-3 text-sm font-bold">Eligible courses</legend>
          <div className="promo-options promo-scope-options">
            <Option name="course-scope" checked={scope === "all"} onChange={() => { setScope("all"); change("applicableCourses", []); setError(""); }}>All courses</Option>
            <Option name="course-scope" checked={scope === "selected"} onChange={() => setScope("selected")}>Selected courses</Option>
          </div>
          {scope === "all" ? <p className="mt-3 text-xs text-[#765F55]">Applies to all eligible courses. Existing course discounts cannot be combined with a promo.</p> : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#2D2E30]/15">
              <div className="flex items-center gap-2 border-b border-[#2D2E30]/10 px-3 py-3"><Search size={17} className="text-[#9A8775]" /><input aria-label="Search courses" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses…" className="min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#E58C1A]" /><span className="shrink-0 text-xs font-semibold text-[#C97112]">{form.applicableCourses.length} selected</span></div>
              <div className="max-h-52 overflow-y-auto overscroll-contain p-2">
                {visibleCourses.map((course) => {
                  const id = String(course.id);
                  const selected = form.applicableCourses.includes(id);
                  return <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm ${selected ? "bg-[#FFF4D8] text-[#9A5816]" : "hover:bg-[#FFF9EA]"}`}><input type="checkbox" checked={selected} onChange={(e) => { change("applicableCourses", e.target.checked ? [...form.applicableCourses, id] : form.applicableCourses.filter((value) => value !== id)); setError(""); }} className="h-4 w-4 shrink-0 accent-[#C97112]" /><span className="min-w-0 break-words">{course.title}</span></label>;
                })}
                {!visibleCourses.length && <p className="p-4 text-center text-sm text-[#765F55]">{courses.length ? "No courses match your search." : "No courses available to select."}</p>}
              </div>
            </div>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-[#A34D45]">{error}</p>}
        </fieldset>

        <fieldset disabled={locked || saving} className="min-w-0 border-t border-[#2D2E30]/10 pt-5">
          <legend className="pr-3 text-sm font-bold">Dates & usage <span className="font-normal text-[#9A8775]">· Optional</span></legend>
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="min-w-0 text-sm font-semibold">Start date<input type="date" value={form.startsAt || ""} onChange={(e) => change("startsAt", e.target.value)} className={input} /><span className="mt-2 block text-xs font-normal text-[#765F55]">Leave blank to start immediately.</span></label>
            <label className="min-w-0 text-sm font-semibold">Expiry date<input type="date" min={form.startsAt || undefined} value={form.expiresAt || ""} onChange={(e) => change("expiresAt", e.target.value)} className={input} /><span className="mt-2 block text-xs font-normal text-[#765F55]">Leave blank for no expiry.</span></label>
            <label className="min-w-0 text-sm font-semibold">Total usage limit<input type="number" min="1" step="1" value={form.usageLimit || ""} onChange={(e) => change("usageLimit", e.target.value)} placeholder="Unlimited" className={input} /><span className="mt-2 block text-xs font-normal text-[#765F55]">Across all learners.</span></label>
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-5 border-t border-[#2D2E30]/10 pt-5">
          <div><p id="promo-enabled-label" className="text-sm font-bold">Enable promo code</p><p className="mt-1 text-xs text-[#765F55]">{form.isActive ? "Available when its dates and usage limits allow." : "Saved as inactive. Learners cannot apply it."}</p></div>
          <button type="button" role="switch" aria-checked={form.isActive} aria-labelledby="promo-enabled-label" disabled={saving || Boolean(form.archivedAt)} onClick={() => change("isActive", !form.isActive)} className="promo-enable-switch"><span /></button>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-[#2D2E30]/10 bg-[#FFFDF8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="flex items-center gap-2 text-xs text-[#765F55]"><LockKeyhole size={14} />Changes apply after saving and confirming your admin password.</p>
        <div className="flex gap-3"><button type="button" disabled={saving} onClick={onClose} className="flex-1 rounded-xl border border-[#2D2E30]/15 bg-white px-5 py-3 text-sm font-bold hover:bg-[#FFF4D8] sm:flex-none">Cancel</button><button disabled={saving || Boolean(form.archivedAt)} className="flex-1 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A] disabled:opacity-50 sm:flex-none">{saving ? "Saving…" : form._id ? "Save changes" : "Continue"}</button></div>
      </div>
    </form>
  );
}

function Option({ name, checked, onChange, children }) {
  return <label className="promo-option"><input type="radio" name={name} checked={checked} onChange={onChange} /><span><Check size={14} aria-hidden="true" className={checked ? "" : "promo-option-check-hidden"} />{children}</span></label>;
}
