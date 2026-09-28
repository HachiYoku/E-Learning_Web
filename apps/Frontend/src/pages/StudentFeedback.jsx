import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, EyeOff, MessageCircleHeart, Send, Share2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchMyEnrollments } from "../services/enrollmentService";
import { createStudentFeedback, fetchMyStudentFeedback, updateStudentFeedbackPublicationConsent } from "../services/studentFeedbackService";
import { feedbackStatus, feedbackStatusLabel } from "../utils/studentFeedbackStatus";

const MIN_FEEDBACK_LENGTH = 20;
const MAX_FEEDBACK_LENGTH = 2000;
const statusClasses = {
  private: "bg-[#F5F1EA] text-[#765F55]",
  awaiting_review: "bg-[#FFF1D0] text-[#9A5816]",
  published: "bg-[#E9F4EA] text-[#246B35]",
  not_selected: "bg-[#E8F3FA] text-[#367599]",
  withdrawn: "bg-[#F5F1EA] text-[#765F55]",
};

function StudentFeedback() {
  const [enrollments, setEnrollments] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [courseId, setCourseId] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successFeedbackId, setSuccessFeedbackId] = useState("");
  const [sharingFeedbackId, setSharingFeedbackId] = useState("");
  const feedbackHeadingRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [nextEnrollments, nextFeedback] = await Promise.all([fetchMyEnrollments(), fetchMyStudentFeedback()]);
      setEnrollments(nextEnrollments);
      setFeedback(nextFeedback);
    } catch (error) {
      setLoadError(error.message || "We couldn't load your feedback right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const feedbackByCourseId = new Map(feedback.map((item) => [String(item.courseId), item]));
  const eligibleCourses = enrollments.filter((enrollment) => enrollment.progress?.completedLessons >= 1 && !feedbackByCourseId.has(String(enrollment.course?.id)));
  const hasEnrollments = enrollments.length > 0;

  const selectedCourseId = eligibleCourses.some((course) => course.course?.id === courseId)
    ? courseId
    : eligibleCourses[0]?.course?.id || "";

  const submit = async (event) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!selectedCourseId) return setFormError("Choose an eligible course first.");
    if (trimmedMessage.length < MIN_FEEDBACK_LENGTH || trimmedMessage.length > MAX_FEEDBACK_LENGTH) {
      return setFormError(`Feedback must be between ${MIN_FEEDBACK_LENGTH} and ${MAX_FEEDBACK_LENGTH} characters.`);
    }
    if (submitting) return;
    setSubmitting(true);
    setFormError("");
    try {
      const created = await createStudentFeedback({ courseId: selectedCourseId, feedback: trimmedMessage });
      setFeedback((current) => [created, ...current]);
      setSuccessFeedbackId(created._id);
      setSharingFeedbackId(created._id);
      setMessage("");
      setCourseId("");
    } catch (error) {
      setFormError(error.message || "We couldn't save your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const replaceFeedback = (updated) => setFeedback((current) => current.map((item) => item._id === updated._id ? updated : item));

  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
    <Link to="/app/more" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#9A5816] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15"><ChevronLeft className="h-4 w-4" />More</Link>
    <div className="mt-4"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Student app</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">Share Your Feedback</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base">Your genuine feedback helps Arun Thai improve the learning experience for you and future students.</p></div>

    {loading ? <LoadingState /> : loadError ? <LoadError message={loadError} onRetry={load} /> : <>
      {!hasEnrollments ? <EmptyState title="No enrolled courses yet" description="Start a course first, then you can share feedback about your learning experience." /> : eligibleCourses.length ? <section className="mt-8 rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-5 shadow-[0_18px_45px_-35px_rgba(80,48,19,0.35)] sm:p-7"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1D0] text-[#C97112]"><MessageCircleHeart className="h-5 w-5" /></span><div><h2 className="font-bold text-[#2D2E30]">How has this course helped you?</h2><p className="mt-1 text-sm leading-relaxed text-[#765F55]">Tell us what worked well and what could improve. Your feedback is saved privately first.</p></div></div><form className="mt-6" onSubmit={submit}><div><span id="feedback-course-label" className="block text-sm font-bold text-[#2D2E30]">Course</span><CourseSelector courses={eligibleCourses} value={selectedCourseId} onChange={(value) => { setCourseId(value); setFormError(""); }} disabled={submitting} /></div><label className="mt-5 block text-sm font-bold text-[#2D2E30]">Your feedback<textarea value={message} onChange={(event) => { setMessage(event.target.value); setFormError(""); }} disabled={submitting} rows="6" maxLength={MAX_FEEDBACK_LENGTH} className="mt-2 w-full resize-y rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] p-3 text-sm font-normal leading-6 outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" placeholder="Share your genuine learning experience…" aria-describedby="feedback-character-count" /></label><div id="feedback-character-count" className="mt-2 flex items-center justify-between gap-3 text-xs text-[#765F55]"><span>At least {MIN_FEEDBACK_LENGTH} characters</span><span>{message.length} / {MAX_FEEDBACK_LENGTH}</span></div>{formError ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{formError}</p> : null}<button type="submit" disabled={submitting || !selectedCourseId || message.trim().length < MIN_FEEDBACK_LENGTH} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"><Send className="h-4 w-4" />{submitting ? "Saving feedback…" : "Save Private Feedback"}</button></form></section> : feedback.length ? null : <EligibilityState enrollments={enrollments} feedbackByCourseId={feedbackByCourseId} />}

      {feedback.length ? <section className="mt-8"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Your feedback</p><h2 ref={feedbackHeadingRef} tabIndex="-1" className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30]">Your Feedback</h2></div><div className="mt-5 space-y-4">{feedback.map((item) => <FeedbackCard key={item._id} feedback={item} enrollment={enrollments.find((entry) => String(entry.course?.id) === String(item.courseId))} showSuccess={item._id === successFeedbackId} onUpdate={replaceFeedback} onOpenSharing={() => setSharingFeedbackId(item._id)} />)}</div></section> : null}
      {hasEnrollments && !eligibleCourses.length && feedback.length ? <p className="mt-6 text-sm leading-relaxed text-[#765F55]">You can share feedback for another course after completing its first lesson.</p> : null}
      <SharePreferenceModal feedback={feedback.find((item) => item._id === sharingFeedbackId)} onClose={() => setSharingFeedbackId("")} onUpdate={replaceFeedback} returnFocusRef={feedbackHeadingRef} />
    </>}
  </div>;
}

function CourseSelector({ courses, value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef(null);
  const selectedCourse = courses.find((entry) => entry.course?.id === value)?.course;

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeWhenOutside = (event) => { if (!selectorRef.current?.contains(event.target)) setIsOpen(false); };
    const closeOnEscape = (event) => { if (event.key === "Escape") setIsOpen(false); };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeWhenOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [isOpen]);

  return <div ref={selectorRef} className="relative mt-2"><button type="button" aria-labelledby="feedback-course-label" aria-haspopup="listbox" aria-expanded={isOpen} disabled={disabled} onClick={() => setIsOpen((open) => !open)} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setIsOpen(true); } }} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-3 text-left text-sm font-semibold text-[#2D2E30] outline-none transition hover:border-[#E58C1A]/45 hover:bg-white focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 disabled:cursor-not-allowed disabled:opacity-60"><span className={selectedCourse ? "min-w-0 truncate" : "text-[#9B867C]"}>{selectedCourse?.title || "Choose a course"}</span><ChevronDown aria-hidden="true" className={`ml-3 h-4 w-4 shrink-0 text-[#9A5816] transition ${isOpen ? "rotate-180" : ""}`} /></button>{isOpen ? <div role="listbox" aria-labelledby="feedback-course-label" className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-[#E58C1A]/25 bg-white p-1.5 shadow-[0_18px_35px_-18px_rgba(45,46,48,0.45)]">{courses.map((entry) => <button key={entry.course.id} type="button" role="option" aria-selected={entry.course.id === value} onClick={() => { onChange(entry.course.id); setIsOpen(false); }} className={`flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm transition ${entry.course.id === value ? "bg-[#FFF1D0] font-bold text-[#9A5816]" : "font-medium text-[#2D2E30] hover:bg-[#FFF9EA]"}`}>{entry.course.title}</button>)}</div> : null}</div>;
}

function LoadingState() { return <div aria-busy="true" aria-label="Loading feedback" className="mt-8 animate-pulse rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-6"><div className="h-4 w-32 rounded bg-[#F2EFEB]" /><div className="mt-4 h-24 rounded-xl bg-[#F2EFEB]" /></div>; }
function LoadError({ message, onRetry }) { return <section className="mt-8 rounded-[1.75rem] border border-red-200 bg-red-50 p-5 sm:p-6"><p role="alert" className="text-sm leading-6 text-red-700">{message}</p><button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-200">Try again</button></section>; }
function EmptyState({ title, description }) { return <section className="mt-8 rounded-[1.75rem] border border-dashed border-[#D9CEBE] bg-white p-6 text-center sm:p-8"><MessageCircleHeart className="mx-auto h-7 w-7 text-[#C97112]" /><h2 className="mt-4 text-lg font-bold text-[#2D2E30]">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#765F55]">{description}</p></section>; }
function EligibilityState({ enrollments, feedbackByCourseId }) { const zeroCompleted = enrollments.filter((item) => !feedbackByCourseId.has(String(item.course?.id)) && item.progress?.completedLessons < 1); return <section className="mt-8 rounded-[1.75rem] border border-dashed border-[#D9CEBE] bg-white p-6 text-center sm:p-8"><EyeOff className="mx-auto h-7 w-7 text-[#C97112]" /><h2 className="mt-4 text-lg font-bold text-[#2D2E30]">Complete a lesson first</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#765F55]">After you complete your first lesson in a course, you can share private feedback about your experience.</p>{zeroCompleted.length ? <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[#9A5816]">{zeroCompleted.length} course{zeroCompleted.length === 1 ? "" : "s"} still getting started</p> : null}</section>; }

function FeedbackCard({ feedback, enrollment, showSuccess, onUpdate, onOpenSharing }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const status = feedbackStatus(feedback);
  const canWithdraw = feedback.publicationConsent?.status === "permitted";
  const canOfferSharing = !canWithdraw && status !== "published";

  const withdrawPermission = async () => {
    if (saving) return;
    setSaving(true); setError("");
    try { onUpdate(await updateStudentFeedbackPublicationConsent(feedback._id, { status: "withdrawn" })); setWithdrawOpen(false); } catch (requestError) { setError(requestError.message || "We couldn't withdraw public sharing."); } finally { setSaving(false); }
  };

  return <article className="overflow-hidden rounded-[1.5rem] border border-[#2D2E30]/10 bg-white shadow-sm"><div className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C97112]">{enrollment?.course?.title || "Your course"}</p><p className="mt-2 text-sm leading-6 text-[#2D2E30] whitespace-pre-wrap">{feedback.originalFeedback}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[status]}`}>{feedbackStatusLabel(feedback)}</span></div>{showSuccess ? <div role="status" className="mt-5 rounded-xl border border-[#7EAF85]/30 bg-[#EDF8EE] px-4 py-3 text-sm text-[#246B35]"><p className="font-bold">Thank you for your feedback ✓</p><p className="mt-1">Your feedback has been saved privately.</p></div> : null}{error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p> : null}</div>{canWithdraw ? <div className="border-t border-[#2D2E30]/10 bg-[#FFFDF8] px-5 py-4 sm:px-6"><p className="text-sm leading-6 text-[#765F55]">You have given Arun Thai permission to consider displaying this feedback on its website.</p><button type="button" onClick={() => setWithdrawOpen(true)} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#A34D45]/35 bg-white px-4 py-3 text-sm font-bold text-[#A34D45] transition hover:bg-[#FDE8E5] focus:outline-none focus:ring-4 focus:ring-[#A34D45]/15">Withdraw Public Sharing</button></div> : null}{canOfferSharing ? <div className="border-t border-[#E58C1A]/15 bg-[#FFF9EA] px-5 py-5 sm:px-6"><div className="flex items-start gap-3"><Share2 className="mt-0.5 h-5 w-5 shrink-0 text-[#C97112]" /><div><h3 className="font-bold text-[#2D2E30]">Share your experience publicly?</h3><p className="mt-1 text-sm leading-6 text-[#765F55]">Your feedback remains private unless you choose to allow sharing.</p></div></div><button type="button" onClick={onOpenSharing} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E58C1A]/35 bg-white px-4 py-3 text-sm font-bold text-[#9A5816] transition hover:bg-[#FFF1D0] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15">Choose sharing preference</button></div> : null}{withdrawOpen ? <WithdrawDialog saving={saving} onCancel={() => setWithdrawOpen(false)} onConfirm={withdrawPermission} /> : null}</article>;
}

function SharePreferenceModal({ feedback, onClose, onUpdate, returnFocusRef }) {
  const [namePreference, setNamePreference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!feedback) return undefined;
    const previousFocus = document.activeElement;
    const fallbackFocusTarget = returnFocusRef?.current;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1]; const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", handleKeyDown); document.body.style.overflow = previousBodyOverflow; document.documentElement.style.overflow = previousDocumentOverflow; if (previousFocus?.isConnected) previousFocus.focus(); else fallbackFocusTarget?.focus(); };
  }, [feedback, onClose, returnFocusRef]);

  if (!feedback) return null;
  const allowSharing = async () => {
    if (!namePreference || saving) return;
    setSaving(true); setError("");
    try { onUpdate(await updateStudentFeedbackPublicationConsent(feedback._id, { status: "permitted", namePreference })); onClose(); } catch (requestError) { setError(requestError.message || "Your feedback is saved privately, but we couldn't save your sharing preference. Please try again."); } finally { setSaving(false); }
  };
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#2D2E30]/65 p-3 backdrop-blur-[2px] sm:p-4" role="presentation"><section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="share-feedback-title" className="w-full max-w-md rounded-[1.75rem] border border-[#E58C1A]/20 bg-[#FFFDF8] p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Your feedback</p><h2 id="share-feedback-title" className="mt-2 text-xl font-bold tracking-tight text-[#2D2E30] sm:text-2xl">Share your experience publicly?</h2></div><button ref={closeRef} type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#2D2E30] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15" aria-label="Close sharing options"><X className="h-5 w-5" aria-hidden="true" /></button></div><p className="mt-3 text-sm leading-6 text-[#765F55]">Your feedback has already been saved privately. Public sharing is optional, and Arun Thai will review it before anything appears on the website.</p><fieldset className="mt-5"><legend className="text-sm font-bold text-[#2D2E30]">If it is selected, how should your name appear?</legend><label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#2D2E30]/10 bg-white px-3 text-sm font-semibold text-[#2D2E30]"><input type="radio" name="new-feedback-name-preference" value="first_name" checked={namePreference === "first_name"} onChange={(event) => setNamePreference(event.target.value)} />First name</label><label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#2D2E30]/10 bg-white px-3 text-sm font-semibold text-[#2D2E30]"><input type="radio" name="new-feedback-name-preference" value="anonymous" checked={namePreference === "anonymous"} onChange={(event) => setNamePreference(event.target.value)} />Anonymous learner</label></fieldset>{error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-700">Your feedback is still saved privately. {error}</p> : null}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm font-bold text-[#765F55] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15">Keep Private</button><button type="button" onClick={allowSharing} disabled={saving || !namePreference} className="min-h-11 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : "Allow Sharing"}</button></div></section></div>, document.body);
}

function WithdrawDialog({ saving, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  useEffect(() => { const closeOnEscape = (event) => { if (event.key === "Escape" && !saving) onCancel(); }; document.addEventListener("keydown", closeOnEscape); return () => document.removeEventListener("keydown", closeOnEscape); }, [onCancel, saving]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/60 p-4 backdrop-blur-[2px]" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="withdraw-sharing-title" className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6"><h2 id="withdraw-sharing-title" className="text-xl font-bold text-[#2D2E30]">Withdraw public sharing?</h2><p className="mt-3 text-sm leading-6 text-[#765F55]">This removes permission to display your feedback publicly. Your private feedback will remain saved.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button ref={cancelRef} type="button" disabled={saving} onClick={onCancel} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold text-[#765F55]">Cancel</button><button type="button" disabled={saving} onClick={onConfirm} className="min-h-11 rounded-xl bg-[#A34D45] px-4 text-sm font-bold text-white disabled:opacity-60">{saving ? "Withdrawing…" : "Withdraw Public Sharing"}</button></div></section></div>;
}

export default StudentFeedback;
