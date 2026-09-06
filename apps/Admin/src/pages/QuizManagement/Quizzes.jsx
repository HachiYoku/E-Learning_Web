import { BarChart3, BookOpen, Check, ChevronDown, Edit2, Filter, GraduationCap, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteQuiz, fetchQuizzes } from "../../services/quizService";
import ConfirmationModal from "../../components/ConfirmationModal";

const getId = (value) => String(value?._id || value?.id || value || "");

function FilterSelect({ value, onChange, options, disabled = false, ariaLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return <div className="relative"><button type="button" disabled={disabled} onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 text-left text-sm font-medium text-[#2D2E30] shadow-sm transition hover:border-[#E58C1A]/45 focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/10 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-[#9B867C]" aria-label={ariaLabel} aria-expanded={isOpen} aria-haspopup="listbox"><span className="truncate">{selected?.label}</span><ChevronDown size={18} className={`ml-3 shrink-0 text-[#C97112] transition-transform ${isOpen ? "rotate-180" : ""}`} /></button>{isOpen && !disabled ? <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#E58C1A]/25 bg-white p-1.5 shadow-xl shadow-[#2D2E30]/15" role="listbox" aria-label={ariaLabel}>{options.map((option) => { const isSelected = option.value === value; return <button key={option.value} type="button" role="option" aria-selected={isSelected} onClick={() => { onChange(option.value); setIsOpen(false); }} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${isSelected ? "bg-[#FFF1CE] font-bold text-[#C97112]" : "font-medium text-[#2D2E30] hover:bg-[#FFF9EA]"}`}><span className="truncate">{option.label}</span>{isSelected ? <Check size={16} className="shrink-0" /> : null}</button>; })}</div> : null}</div>;
}

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
    <div className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8"><div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112] sm:text-xs">Assessment library</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">Quiz management</h1><p className="mt-2 text-[#765F55]">Find and manage quizzes by course, lesson, or type.</p></div>
        <button onClick={() => navigate("/quizzes/new")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 font-bold text-white shadow-md shadow-[#2D2E30]/15 transition hover:-translate-y-0.5 hover:bg-[#E58C1A]"><Plus size={19} /> Create quiz</button>
      </header>
      <section className="mb-6 overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)]">
        <div className="border-b border-[#E58C1A]/15 bg-[#FFF9EA] px-5 py-4"><h2 className="font-bold text-[#2D2E30]">Quiz overview</h2></div>
        <div className="grid grid-cols-3 divide-x divide-[#2D2E30]/10">
          <SummaryCard label="All quizzes" value={quizzes.length} icon={<BookOpen size={20} />} iconClass="bg-[#FFF1CE] text-[#C97112]" />
          <SummaryCard label="Lesson quizzes" value={quizzes.filter((quiz) => quiz.quizType === "lesson").length} icon={<BookOpen size={20} />} iconClass="bg-[#EDF8EE] text-[#246B35]" />
          <SummaryCard label="Course quizzes" value={quizzes.filter((quiz) => quiz.quizType === "course").length} icon={<GraduationCap size={20} />} iconClass="bg-[#FFF4D8] text-[#9A5816]" />
        </div>
      </section>
      <section className="mb-7 rounded-2xl border border-[#2D2E30]/10 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-5">
        <div className="mb-4 flex items-center justify-between"><span className="flex items-center gap-2 font-bold text-[#2D2E30]"><Filter size={18} className="text-[#C97112]" /> Filter quizzes</span>{hasActiveFilters && <button onClick={clearFilters} className="inline-flex items-center gap-1 text-sm font-semibold text-[#765F55] hover:text-[#C97112]"><X size={15} /> Clear filters</button>}</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#C97112]" /><input aria-label="Search quizzes" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search quiz, course, lesson..." className="w-full rounded-xl border border-[#2D2E30]/15 py-2.5 pl-10 pr-3 text-sm text-[#2D2E30] outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" /></div>
          <FilterSelect ariaLabel="Quiz type" value={quizType} onChange={setQuizType} options={[{ value: "all", label: "All quiz types" }, { value: "lesson", label: "Lesson quizzes" }, { value: "course", label: "Course quizzes" }]} />
          <FilterSelect ariaLabel="Course" value={courseFilter} onChange={(value) => { setCourseFilter(value); setLessonFilter("all"); }} options={[{ value: "all", label: "All courses" }, ...courses.map((course) => ({ value: course.id, label: course.title }))]} />
          <FilterSelect ariaLabel="Lesson" disabled={!lessons.length} value={lessonFilter} onChange={setLessonFilter} options={[{ value: "all", label: "All lessons" }, ...lessons.map((lesson) => ({ value: lesson.id, label: lesson.label }))]} />
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
  return <article className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.55)] transition-all hover:-translate-y-1 hover:border-[#E58C1A]/35 hover:shadow-[0_20px_38px_-24px_rgba(201,113,18,0.4)]"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${isLesson ? "bg-[#EDF8EE] text-[#246B35]" : "bg-[#FFF1CE] text-[#9A5816]"}`}>{isLesson ? <BookOpen size={13} /> : <GraduationCap size={13} />}{isLesson ? "Lesson quiz" : "Course quiz"}</span><span className="text-xs text-[#765F55]">{quiz.maxAttempts ? `${quiz.maxAttempts} attempts` : "Unlimited attempts"}</span></div><h3 className="mt-3 truncate text-lg font-bold text-[#2D2E30]" title={quiz.title}>{quiz.title}</h3><p className="mt-1 truncate text-sm font-semibold text-[#2D2E30]" title={quiz.course?.title}>{quiz.course?.title || "Course unavailable"}</p><p className="mt-1 truncate text-sm text-[#765F55]" title={lessonLabel}>{lessonLabel}</p></div><div className="flex shrink-0 gap-1.5"><button onClick={() => navigate(`/quizzes/${quiz.id}/attempts`)} className="rounded-lg bg-[#FFF1CE] p-2.5 text-[#C97112] hover:bg-[#F8C56A]" title="View student scores"><BarChart3 size={18} /></button><button onClick={() => navigate(`/quizzes/${quiz.id}/edit`)} className="rounded-lg bg-[#FFF9EA] p-2.5 text-[#2D2E30] hover:bg-[#FFF1CE]" title="Edit quiz"><Edit2 size={18} /></button><button onClick={() => onDelete(quiz)} className="rounded-lg bg-[#FFF0EE] p-2.5 text-[#A34D45] hover:bg-[#FFE1DD]" title="Delete quiz"><Trash2 size={18} /></button></div></div><div className="mt-5 flex items-center justify-between border-t border-[#2D2E30]/10 pt-4 text-sm"><span className="font-bold text-[#C97112]">{quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}</span><button onClick={() => navigate(`/quizzes/${quiz.id}/attempts`)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D2E30] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#E58C1A]">View results <span aria-hidden="true">→</span></button></div></article>;
}

function EmptyState({ icon, title, message, action, actionText }) {
  return <div className="rounded-2xl border border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] p-10 text-center"><div className="mx-auto w-fit text-[#C97112]">{icon}</div><h2 className="mt-4 text-xl font-bold text-[#2D2E30]">{title}</h2><p className="mt-2 text-[#765F55]">{message}</p><button onClick={action} className="mt-5 rounded-xl bg-[#2D2E30] px-5 py-2.5 font-bold text-white hover:bg-[#E58C1A]">{actionText}</button></div>;
}

function SummaryCard({ label, value, icon, iconClass }) {
  return <div className="flex min-w-0 flex-col items-center justify-center gap-2 px-2 py-4 text-center sm:flex-row sm:justify-start sm:gap-3 sm:px-6 sm:text-left"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${iconClass}`}>{icon}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#765F55] sm:text-sm">{label}</p><p className="mt-0.5 text-xl font-bold text-[#2D2E30] sm:text-2xl">{value}</p></div></div>;
}

export default Quizzes;
