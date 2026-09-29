import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import ConfirmationModal from "../../components/ConfirmationModal";
import {
  fetchAdminStudentFeedback,
  fetchAdminStudentFeedbackDetail,
  updateAdminStudentFeedbackPublication,
} from "../../services/adminStudentFeedbackService";

const FILTERS = [
  ["awaiting_review", "Awaiting Review"],
  ["published", "Published"],
  ["not_selected", "Kept Private"],
  ["withdrawn", "Sharing Withdrawn"],
  ["private", "Private Feedback"],
];
const labels = {
  private: "Private",
  awaiting_review: "Awaiting website review",
  published: "Published",
  not_selected: "Kept private",
  withdrawn: "Sharing withdrawn",
};
const badgeClasses = {
  private: "bg-slate-100 text-slate-700",
  awaiting_review: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  not_selected: "bg-sky-100 text-sky-800",
  withdrawn: "bg-slate-100 text-slate-700",
};
const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

function StudentFeedback() {
  const [status, setStatus] = useState("awaiting_review");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ feedback: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [decision, setDecision] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchAdminStudentFeedback({ status, page }));
    } catch (requestError) {
      setError(requestError.message || "Unable to load student feedback.");
    } finally {
      setLoading(false);
    }
  }, [page, status]);
  useEffect(() => {
    load();
  }, [load]);
  const changeFilter = (nextStatus) => {
    setStatus(nextStatus);
    setPage(1);
    setSelected(null);
    setSuccess("");
  };
  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetailError("");
    setSelected(null);
    setSuccess("");
    try {
      const response = await fetchAdminStudentFeedbackDetail(id);
      setSelected(response.feedback);
    } catch (requestError) {
      setDetailError(
        requestError.message || "Unable to load feedback details."
      );
    } finally {
      setDetailLoading(false);
    }
  };
  const submitDecision = async () => {
    if (!decision || !selected || saving) return;
    setSaving(true);
    setActionError("");
    try {
      const publicationStatus = decision === "remove" ? "not_selected" : decision;
      const response = await updateAdminStudentFeedbackPublication(
        selected._id,
        publicationStatus
      );
      setSelected(response.feedback);
      setDecision("");
      setSuccess(
        decision === "published"
          ? "Selected for website publication"
          : "Kept private"
      );
      await load();
    } catch (requestError) {
      setActionError(
        requestError.message ||
          "Unable to save this publication decision. Refresh and try again."
      );
      setDecision("");
      // A conflict can mean the student withdrew consent after this record
      // was opened. Reload the protected, server-authoritative detail rather
      // than leaving a potentially stale publication action on screen.
      try {
        const latest = await fetchAdminStudentFeedbackDetail(selected._id);
        setSelected(latest.feedback);
      } catch {
        // Preserve the original request error; the user can use the existing
        // detail retry path if refreshing the record also fails.
      }
    } finally {
      setSaving(false);
    }
  };

  const emptyLabel = (
    FILTERS.find(([value]) => value === status)?.[1] || "feedback"
  )
    .replace(/ feedback$/i, "")
    .toLowerCase();
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">
            Student stories
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2D2E30]">
            Student Feedback
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#765F55]">
            Review feedback students have explicitly allowed Arun Thai to
            consider for the public website. Private feedback remains private.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Feedback publication filters"
        >
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              onClick={() => changeFilter(value)}
              className={`min-h-11 rounded-xl px-3 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15 ${
                status === value
                  ? "bg-[#2D2E30] text-white"
                  : "border border-[#2D2E30]/10 bg-[#FFFDF8] text-[#765F55] hover:bg-[#FFF1D0] hover:text-[#9A5816]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {success ? (
        <p
          role="status"
          className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
        >
          {success}
        </p>
      ) : null}
      {error ? (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700"
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </section>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.75fr)]">
          <section
            aria-live="polite"
            className="overflow-hidden rounded-3xl border border-[#2D2E30]/10 bg-white shadow-sm"
          >
            {loading ? (
              <div className="p-8 text-sm text-[#765F55]">
                Loading student feedback…
              </div>
            ) : data.feedback?.length ? (
              <div>
                {data.feedback.map((item) => (
                  <article
                    key={item._id}
                    className="border-b border-[#2D2E30]/10 p-4 last:border-0 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              badgeClasses[item.publication?.status]
                            }`}
                          >
                            {labels[item.publication?.status] || "Private"}
                          </span>
                          <span className="text-xs font-semibold text-[#765F55]">
                            {item.publicationConsent?.status === "permitted"
                              ? "Permission granted"
                              : item.publicationConsent?.status === "withdrawn"
                              ? "Sharing withdrawn"
                              : "Private feedback"}
                          </span>
                        </div>
                        <h2 className="mt-3 text-base font-bold text-[#2D2E30]">
                          {item.student?.name || "Student unavailable"}
                        </h2>
                        <p className="mt-1 text-sm text-[#765F55]">
                          {item.course?.title || "Course unavailable"} ·
                          Submitted {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openDetail(item._id)}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E58C1A]/30 bg-[#FFFDF8] px-4 text-sm font-bold text-[#9A5816] hover:bg-[#FFF1D0] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15"
                      >
                        <Eye size={16} />
                        Review
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center">
                <FileText className="mx-auto h-8 w-8 text-[#C97112]" />
                <h2 className="mt-4 text-lg font-bold text-[#2D2E30]">
                  No {emptyLabel} feedback
                </h2>
                <p className="mt-2 text-sm text-[#765F55]">
                  There is nothing to review in this view right now.
                </p>
              </div>
            )}
            <Pagination pagination={data.pagination} onPage={setPage} />
          </section>
          <FeedbackDetail
            feedback={selected}
            loading={detailLoading}
            error={detailError}
            actionError={actionError}
            onDecision={setDecision}
          />
        </div>
      )}
      <ConfirmationModal
        isOpen={Boolean(decision)}
        title={decision === "published" ? "Publish this student story?" : decision === "remove" ? "Remove this student story from the website?" : "Keep this feedback private?"}
        message={
          decision === "published" ? "The student's feedback will become eligible for display on the public Arun Thai website." : decision === "remove" ? "It will no longer appear publicly. The student's sharing permission will remain unchanged." : "The feedback will remain available internally, but it will not be selected for the public website."
        }
        cancelText="Cancel"
        confirmText={
          decision === "published" ? "Publish on Website" : decision === "remove" ? "Remove from Website" : "Keep Private"
        }
        onCancel={() => setDecision("")}
        onConfirm={submitDecision}
        isSaving={saving}
      />
    </main>
  );
}

function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#2D2E30]/10 p-4 text-sm text-[#765F55]">
      <span>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#2D2E30]/10 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#2D2E30]/10 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function FeedbackDetail({ feedback, loading, error, actionError, onDecision }) {
  if (loading)
    return (
      <aside className="rounded-3xl border border-[#2D2E30]/10 bg-white p-6 text-sm text-[#765F55]">
        Loading feedback details…
      </aside>
    );
  if (error)
    return (
      <aside className="rounded-3xl border border-red-200 bg-red-50 p-6">
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      </aside>
    );
  if (!feedback)
    return (
      <aside className="rounded-3xl border border-dashed border-[#D9CEBE] bg-[#FFFDF8] p-8 text-center text-sm leading-6 text-[#765F55]">
        Choose feedback to review its details and sharing status.
      </aside>
    );
  const permitted = feedback.publicationConsent?.status === "permitted";
  const status = feedback.publication?.status;
  return (
    <aside className="rounded-3xl border border-[#2D2E30]/10 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">
        Student feedback
      </p>
      <dl className="mt-5 space-y-3 text-sm">
        <Info label="Student" value={feedback.student?.name} />
        <Info label="Email" value={feedback.student?.email} />
        <Info label="Course" value={feedback.course?.title} />
        <Info label="Submitted" value={formatDate(feedback.createdAt)} />
      </dl>
      <section className="mt-6 border-t border-[#2D2E30]/10 pt-5">
        <h2 className="font-bold text-[#2D2E30]">Feedback</h2>
        <blockquote className="mt-3 whitespace-pre-wrap rounded-2xl bg-[#FFF9EA] p-4 text-sm leading-6 text-[#2D2E30]">
          “{feedback.originalFeedback}”
        </blockquote>
      </section>
      <section className="mt-6 border-t border-[#2D2E30]/10 pt-5">
        <h2 className="font-bold text-[#2D2E30]">Public sharing</h2>
        {feedback.publicationConsent?.status === "permitted" ? (
          <p className="mt-2 text-sm leading-6 text-[#246B35]">
            <ShieldCheck className="mr-1 inline h-4 w-4" />
            Permission granted · Display as:{" "}
            <strong>{feedback.publicNamePreview}</strong>
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[#765F55]">
            Private feedback. Student has not granted permission for public
            sharing.
          </p>
        )}
        {permitted ? <p className="mt-2 text-sm text-[#765F55]">Profile photo: <strong>{feedback.publicationConsent?.allowProfileImage === true ? "Allowed" : "Not allowed"}</strong></p> : null}
        {feedback.student?.profileImage ? <img src={feedback.student.profileImage} alt="" className="mt-3 h-12 w-12 rounded-full object-cover" /> : null}
        <p className="mt-2 text-sm text-[#765F55]">
          Publication status:{" "}
          <strong>{labels[feedback.publication?.status] || "Private"}</strong>
        </p>
      </section>
      {actionError ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          {actionError}
        </p>
      ) : null}
      {permitted && status === "awaiting_review" ? (
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onDecision("not_selected")}
            className="min-h-11 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm font-bold text-[#765F55] hover:bg-[#FFF4D8]"
          >
            Keep Private
          </button>
          <button
            type="button"
            onClick={() => onDecision("published")}
            className="min-h-11 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]"
          >
            Publish on Website
          </button>
        </div>
      ) : null}
      {permitted && status === "published" ? <div className="mt-6"><button type="button" onClick={() => onDecision("remove")} className="min-h-11 rounded-xl border border-[#A34D45]/35 bg-white px-4 py-3 text-sm font-bold text-[#A34D45] hover:bg-[#FDE8E5]">Remove from Website</button></div> : null}
      {permitted && status === "not_selected" ? <div className="mt-6"><button type="button" onClick={() => onDecision("published")} className="min-h-11 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]">Publish on Website</button></div> : null}
    </aside>
  );
}
function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#9A8775]">
        {label}
      </dt>
      <dd className="mt-1 break-words font-semibold text-[#2D2E30]">
        {value || "—"}
      </dd>
    </div>
  );
}

export default StudentFeedback;
