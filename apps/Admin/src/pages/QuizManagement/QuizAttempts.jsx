import { ArrowLeft, BarChart3, ChevronDown, ChevronUp, Search, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchQuizAttempts } from "../../services/quizService";

const percentage = (attempt) => attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;

function QuizAttempts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  useEffect(() => {
    fetchQuizAttempts(id).then(setData).catch((err) => setError(err.message));
  }, [id]);

  const students = useMemo(() => {
    if (!data) return [];
    const grouped = new Map();
    data.attempts.forEach((attempt) => {
      const studentId = attempt.user?._id || attempt.user?.email || `deleted-${attempt._id}`;
      if (!grouped.has(studentId)) grouped.set(studentId, { id: studentId, name: attempt.user?.name || "Deleted user", email: attempt.user?.email || "", attempts: [] });
      grouped.get(studentId).attempts.push(attempt);
    });
    return [...grouped.values()].map((student) => {
      const attempts = [...student.attempts].sort((a, b) => a.attemptNumber - b.attemptNumber || new Date(a.createdAt) - new Date(b.createdAt));
      const bestAttempt = attempts.reduce((best, attempt) => !best || percentage(attempt) > percentage(best) ? attempt : best, null);
      const latestAttempt = attempts.reduce((latest, attempt) => !latest || new Date(attempt.createdAt) > new Date(latest.createdAt) ? attempt : latest, null);
      return { ...student, attempts, bestAttempt, latestAttempt };
    });
  }, [data]);

  const visibleStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return students
      .filter((student) => !query || student.name.toLowerCase().includes(query) || student.email.toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortBy === "best-high") return percentage(b.bestAttempt) - percentage(a.bestAttempt);
        if (sortBy === "best-low") return percentage(a.bestAttempt) - percentage(b.bestAttempt);
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return new Date(b.latestAttempt.createdAt) - new Date(a.latestAttempt.createdAt);
      });
  }, [students, searchQuery, sortBy]);

  if (error) return <PageMessage title="Error loading quiz scoreboard" message={error} error navigate={navigate} />;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><p className="text-slate-600">Loading quiz scoreboard...</p></div>;

  const totalAttempts = data.attempts.length;
  const average = totalAttempts ? Math.round(data.attempts.reduce((sum, attempt) => sum + percentage(attempt), 0) / totalAttempts) : 0;

  return <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8"><div className="mx-auto max-w-6xl">
    <button onClick={() => navigate("/quizzes")} className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-200"><ArrowLeft size={18} /><span className="font-medium">Back to quizzes</span></button>
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wider text-pink-600">Student scoreboard</p><h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">{data.quiz.title}</h1><p className="mt-2 text-sm text-slate-600">Attempt limit: <span className="font-semibold text-slate-900">{data.quiz.maxAttempts || "Unlimited"}</span></p></div><div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 divide-x divide-slate-200"><Stat icon={<Users size={16} />} label="Students" value={students.length} /><Stat icon={<TrendingUp size={16} />} label="Average" value={`${average}%`} /><Stat icon={<BarChart3 size={16} />} label="Attempts" value={totalAttempts} /></div></div></header>
    <section className="mt-8">
      {students.length === 0 ? <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-12 text-center"><Users size={30} className="mx-auto text-slate-400" /><h2 className="mt-4 text-lg font-bold text-slate-800">No submissions yet</h2><p className="mt-2 text-sm text-slate-600">Students will appear here after completing the quiz.</p></div> : <>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search student name or email..." className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100" /></div><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"><option value="recent">Recent activity</option><option value="best-high">Best score: high to low</option><option value="best-low">Best score: low to high</option><option value="name">Name: A to Z</option></select></div>
        <p className="mb-3 text-sm text-slate-600">Showing {visibleStudents.length} of {students.length} student{students.length === 1 ? "" : "s"}. Select a student to view their attempts.</p>
        {visibleStudents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No students match your search.</div> : <div className="space-y-3">{visibleStudents.map((student) => <StudentRow key={student.id} student={student} expanded={expandedStudentId === student.id} onToggle={() => setExpandedStudentId((current) => current === student.id ? null : student.id)} />)}</div>}
      </>}
    </section>
  </div></div>;
}

function StudentRow({ student, expanded, onToggle }) {
  const best = percentage(student.bestAttempt);
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 sm:p-5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-100 font-bold text-pink-700">{student.name.charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-bold text-slate-900">{student.name}</p><p className="truncate text-sm text-slate-500">{student.email || "No email available"}</p></div><div className="hidden text-right sm:block"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Best score</p><p className="mt-1 font-bold text-pink-700">{student.bestAttempt.score} / {student.bestAttempt.total} · {best}%</p></div><div className="hidden w-32 text-right md:block"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attempts</p><p className="mt-1 font-semibold text-slate-700">{student.attempts.length}</p></div><span className="ml-1 rounded-lg p-2 text-slate-500">{expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</span></button>{expanded && <div className="border-t border-slate-100 bg-slate-50 p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-900">Attempt history</h3><span className="text-sm font-semibold text-pink-700">Best: {best}%</span></div><div className="space-y-2">{student.attempts.map((attempt) => <div key={attempt._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm shadow-sm"><div><span className="font-semibold text-slate-900">Attempt {attempt.attemptNumber}</span><span className="ml-2 text-slate-500">{new Date(attempt.createdAt).toLocaleString()}</span></div><span className="rounded-lg bg-pink-50 px-3 py-1 font-bold text-pink-700">{attempt.score} / {attempt.total} · {percentage(attempt)}%</span></div>)}</div></div>}</article>;
}

function Stat({ icon, label, value }) { return <div className="min-w-[92px] px-3 py-3 text-center sm:px-5"><span className="mx-auto flex w-fit items-center gap-1 text-xs font-medium text-slate-500">{icon}{label}</span><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>; }
function PageMessage({ title, message, error, navigate }) { return <div className={`min-h-screen p-6 sm:p-8 ${error ? "bg-red-50" : "bg-slate-50"}`}><button onClick={() => navigate("/quizzes")} className="mb-6 inline-flex items-center gap-2 text-slate-700"><ArrowLeft size={18} />Back to quizzes</button><div className="rounded-2xl bg-white p-6 shadow-sm"><h1 className="font-bold text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-600">{message}</p></div></div>; }

export default QuizAttempts;
