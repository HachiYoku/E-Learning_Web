import { BarChart3, BookOpen, Edit2, Filter, GraduationCap, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteQuiz, fetchQuizzes } from "../../services/quizService";
import ConfirmationModal from "../../components/ConfirmationModal";

const getId = (value) => String(value?._id || value?.id || value || "");

function Quizzes() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [quizType, setQuizType] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [lessonFilter, setLessonFilter] = useState("all");

  useEffect(() => {
    fetchQuizzes().then(setQuizzes).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const courses = useMemo(() => {
    const unique = new Map();
    quizzes.forEach((quiz) => unique.set(getId(quiz.course), quiz.course?.title || "Untitled course"));
    return [...unique.entries()].filter(([id]) => id).map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [quizzes]);

  const lessons = useMemo(() => {
    const unique = new Map();
    quizzes.forEach((quiz) => {
      if (quiz.quizType !== "lesson" || !quiz.lesson || (courseFilter !== "all" && getId(quiz.course) !== courseFilter)) return;
      const id = getId(quiz.lesson);
      unique.set(id, { id, label: `Lesson ${quiz.lesson.order || ""}${quiz.lesson.title ? `: ${quiz.lesson.title}` : ""}` });
    });
    return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [quizzes, courseFilter]);

  useEffect(() => {
    if (lessonFilter !== "all" && !lessons.some((lesson) => lesson.id === lessonFilter)) setLessonFilter("all");
  }, [lessons, lessonFilter]);

  const filteredQuizzes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return quizzes.filter((quiz) => {
      const matchesSearch = !query || [quiz.title, quiz.course?.title, quiz.lesson?.title].filter(Boolean).some((value) => value.toLowerCase().includes(query));
      return matchesSearch && (quizType === "all" || quiz.quizType === quizType) && (courseFilter === "all" || getId(quiz.course) === courseFilter) && (lessonFilter === "all" || getId(quiz.lesson) === lessonFilter);
    });
  }, [quizzes, searchTerm, quizType, courseFilter, lessonFilter]);

  const groupedQuizzes = useMemo(() => {
    const groups = new Map([
      ["lesson", { id: "lesson", title: "Lesson quizzes", description: "Quizzes attached to individual lessons", quizzes: [] }],
      ["course", { id: "course", title: "Course quizzes", description: "Quizzes that assess the whole course", quizzes: [] }],
    ]);
    filteredQuizzes.forEach((quiz) => {
      groups.get(quiz.quizType === "course" ? "course" : "lesson").quizzes.push(quiz);
    });
    return [...groups.values()].filter((group) => group.quizzes.length > 0);
  }, [filteredQuizzes]);

  const hasActiveFilters = Boolean(searchTerm || quizType !== "all" || courseFilter !== "all" || lessonFilter !== "all");
  const clearFilters = () => { setSearchTerm(""); setQuizType("all"); setCourseFilter("all"); setLessonFilter("all"); };
  const confirmDelete = async () => {
    try { await deleteQuiz(quizToDelete.id); setQuizzes((current) => current.filter((quiz) => quiz.id !== quizToDelete.id)); }
    catch (err) { setError(err.message); }
    finally { setQuizToDelete(null); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8"><div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-wider text-pink-600">Assessment library</p><h1 className="mt-1 text-3xl font-bold text-gray-900 sm:text-4xl">Quiz Management</h1><p className="mt-2 text-gray-600">Find and manage quizzes by course, lesson, or type.</p></div>
        <button onClick={() => navigate("/quizzes/new")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-300 px-5 py-3 font-semibold text-gray-900 shadow-sm transition hover:bg-pink-400"><Plus size={19} /> Create quiz</button>
      </header>
      <section className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4"><h2 className="font-semibold text-gray-900">Quiz overview</h2></div>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <SummaryCard label="All quizzes" value={quizzes.length} icon={<BookOpen size={20} />} iconClass="bg-pink-100 text-pink-700" />
          <SummaryCard label="Lesson quizzes" value={quizzes.filter((quiz) => quiz.quizType === "lesson").length} icon={<BookOpen size={20} />} iconClass="bg-emerald-100 text-emerald-700" />
          <SummaryCard label="Course quizzes" value={quizzes.filter((quiz) => quiz.quizType === "course").length} icon={<GraduationCap size={20} />} iconClass="bg-blue-100 text-blue-700" />
        </div>
      </section>
      <section className="mb-7 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between"><span className="flex items-center gap-2 font-semibold text-gray-900"><Filter size={18} className="text-pink-600" /> Filter quizzes</span>{hasActiveFilters && <button onClick={clearFilters} className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"><X size={15} /> Clear filters</button>}</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400" /><input aria-label="Search quizzes" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search quiz, course, lesson..." className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100" /></div>
          <select value={quizType} onChange={(event) => setQuizType(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"><option value="all">All quiz types</option><option value="lesson">Lesson quizzes</option><option value="course">Course quizzes</option></select>
          <select value={courseFilter} onChange={(event) => { setCourseFilter(event.target.value); setLessonFilter("all"); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"><option value="all">All courses</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select>
          <select value={lessonFilter} onChange={(event) => setLessonFilter(event.target.value)} disabled={!lessons.length} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 disabled:cursor-not-allowed disabled:bg-gray-50"><option value="all">All lessons</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.label}</option>)}</select>
        </div>
      </section>
      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}
      {loading ? <div className="rounded-2xl bg-white p-10 text-center text-gray-600 shadow-sm">Loading quizzes...</div> : quizzes.length === 0 ? <EmptyState icon={<BookOpen size={34} />} title="No quizzes yet" message="Create your first quiz to assess your students." action={() => navigate("/quizzes/new")} actionText="Create quiz" /> : groupedQuizzes.length === 0 ? <EmptyState icon={<Search size={34} />} title="No matching quizzes" message="Try changing or clearing your filters." action={clearFilters} actionText="Clear filters" /> : <div className="space-y-8">{groupedQuizzes.map((group) => <section key={group.id}><div className="mb-3 flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">{group.id === "lesson" ? <BookOpen className="text-emerald-600" size={20} /> : <GraduationCap className="text-blue-600" size={20} />}{group.title}</h2><p className="mt-1 text-sm text-gray-500">{group.description}</p></div><span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600">{group.quizzes.length} quiz{group.quizzes.length === 1 ? "" : "zes"}</span></div><div className="grid gap-4 lg:grid-cols-2">{group.quizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} navigate={navigate} onDelete={setQuizToDelete} />)}</div></section>)}</div>}
      <ConfirmationModal isOpen={Boolean(quizToDelete)} title="Delete Quiz" message={`Delete “${quizToDelete?.title || ""}” and all its questions? This cannot be undone.`} confirmText="Delete" cancelText="Cancel" onConfirm={confirmDelete} onCancel={() => setQuizToDelete(null)} isDangerous />
    </div></div>
  );
}

function QuizCard({ quiz, navigate, onDelete }) {
  const isLesson = quiz.quizType === "lesson";
  const lessonLabel = isLesson ? `Lesson ${quiz.lesson?.order || ""}${quiz.lesson?.title ? `: ${quiz.lesson.title}` : ""}` : "Course-wide quiz";
  return <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isLesson ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{isLesson ? <BookOpen size={13} /> : <GraduationCap size={13} />}{isLesson ? "Lesson quiz" : "Course quiz"}</span><span className="text-xs text-gray-500">{quiz.maxAttempts ? `${quiz.maxAttempts} attempts` : "Unlimited attempts"}</span></div><h3 className="mt-3 truncate text-lg font-bold text-gray-900" title={quiz.title}>{quiz.title}</h3><p className="mt-1 truncate text-sm font-medium text-gray-700" title={quiz.course?.title}>{quiz.course?.title || "Course unavailable"}</p><p className="mt-1 truncate text-sm text-gray-500" title={lessonLabel}>{lessonLabel}</p></div><div className="flex shrink-0 gap-1.5"><button onClick={() => navigate(`/quizzes/${quiz.id}/attempts`)} className="rounded-lg bg-blue-50 p-2.5 text-blue-700 hover:bg-blue-100" title="View student scores"><BarChart3 size={18} /></button><button onClick={() => navigate(`/quizzes/${quiz.id}/edit`)} className="rounded-lg bg-gray-100 p-2.5 text-gray-700 hover:bg-gray-200" title="Edit quiz"><Edit2 size={18} /></button><button onClick={() => onDelete(quiz)} className="rounded-lg bg-red-50 p-2.5 text-red-700 hover:bg-red-100" title="Delete quiz"><Trash2 size={18} /></button></div></div><div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm"><span className="font-medium text-pink-700">{quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}</span><button onClick={() => navigate(`/quizzes/${quiz.id}/attempts`)} className="font-semibold text-blue-700 hover:text-blue-900">View results →</button></div></article>;
}

function EmptyState({ icon, title, message, action, actionText }) {
  return <div className="rounded-2xl bg-white p-10 text-center shadow-sm"><div className="mx-auto w-fit text-pink-400">{icon}</div><h2 className="mt-4 text-xl font-bold text-gray-900">{title}</h2><p className="mt-2 text-gray-600">{message}</p><button onClick={action} className="mt-5 rounded-lg bg-pink-300 px-5 py-2.5 font-semibold text-gray-900 hover:bg-pink-400">{actionText}</button></div>;
}

function SummaryCard({ label, value, icon, iconClass }) {
  return <div className="flex min-w-0 flex-col items-center justify-center gap-2 px-2 py-4 text-center sm:flex-row sm:justify-start sm:gap-3 sm:px-6 sm:text-left"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${iconClass}`}>{icon}</div><div className="min-w-0"><p className="truncate text-xs font-medium text-gray-500 sm:text-sm">{label}</p><p className="mt-0.5 text-xl font-bold text-gray-900 sm:text-2xl">{value}</p></div></div>;
}

export default Quizzes;
