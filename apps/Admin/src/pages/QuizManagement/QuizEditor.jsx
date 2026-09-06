import { ArrowLeft, BookOpenText, CheckCircle2, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchCourses } from "../../services/courseService";
import { fetchLessonsByCourse } from "../../services/lessonService";
import { createQuiz, fetchQuiz, updateQuiz } from "../../services/quizService";
import { validateFileSize } from "../../utils/fileValidation";

const newQuestion = () => ({
  prompt: "",
  image: "",
  imageFile: null,
  preview: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
});

function QuizSelect({ value, onChange, options, placeholder, disabled = false, ariaLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return <div className="relative mt-2"><button type="button" disabled={disabled} onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 text-left text-sm font-medium text-[#2D2E30] shadow-sm transition hover:border-[#E58C1A]/45 focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/10 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-[#9B867C]" aria-label={ariaLabel} aria-expanded={isOpen} aria-haspopup="listbox"><span className={selectedOption ? "truncate" : "truncate text-[#9B867C]"}>{selectedOption?.label || placeholder}</span><ChevronDown size={18} className={`ml-3 shrink-0 text-[#C97112] transition-transform ${isOpen ? "rotate-180" : ""}`} /></button>{isOpen && !disabled ? <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#E58C1A]/25 bg-white p-1.5 shadow-xl shadow-[#2D2E30]/15" role="listbox" aria-label={ariaLabel}>{options.map((option) => { const selected = option.value === value; return <button key={option.value} type="button" role="option" aria-selected={selected} onClick={() => { onChange(option.value); setIsOpen(false); }} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${selected ? "bg-[#FFF1CE] font-bold text-[#C97112]" : "font-medium text-[#2D2E30] hover:bg-[#FFF9EA]"}`}><span className="truncate">{option.label}</span>{selected ? <Check size={16} className="shrink-0" /> : null}</button>; })}</div> : null}</div>;
}

function QuizEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const [courses, setCourses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [form, setForm] = useState({
    courseId: "",
    lessonId: "",
    quizType: "lesson",
    title: "",
    maxAttempts: "",
    questions: [newQuestion()],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCourses().then(setCourses).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!form.courseId) {
      setLessons([]);
      return;
    }

    fetchLessonsByCourse(form.courseId)
      .then(setLessons)
      .catch((err) => setError(err.message));
  }, [form.courseId]);

  useEffect(() => {
    if (!editing) {
      setLoading(false);
      return;
    }

    fetchQuiz(id)
      .then((quiz) =>
        setForm({
          courseId: quiz.course?._id || quiz.course,
          lessonId: quiz.lesson?._id || quiz.lesson,
          quizType: quiz.quizType || "lesson",
          title: quiz.title,
          maxAttempts: quiz.maxAttempts || "",
          questions: quiz.questions.map((q) => ({ ...q, imageFile: null, preview: q.image })),
        })
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [editing, id]);

  const updateQuestion = (index, changes) =>
    setForm((current) => ({
      ...current,
      questions: current.questions.map((q, qIndex) => (qIndex === index ? { ...q, ...changes } : q)),
    }));

  const uploadImage = (index, file) => {
    if (!file) return;
    const sizeError = validateFileSize(file, "Question image");
    if (sizeError) return setError(sizeError);
    updateQuestion(index, { imageFile: file, preview: URL.createObjectURL(file), image: "" });
  };

  const submit = async (event) => {
    event.preventDefault();
    const { courseId, lessonId, quizType, title, questions } = form;

    if (!courseId || !title.trim()) return setError("Choose a course and enter a quiz title.");
    if (quizType === "lesson" && !lessonId) return setError("Select a lesson for lesson-type quizzes.");
    if (
      questions.some(
        (q) =>
          !(q.image || q.imageFile) ||
          q.options.filter(Boolean).length < 2 ||
          q.correctAnswer >= q.options.filter(Boolean).length
      )
    ) {
      return setError("Each question needs an image, at least two answers, and a valid correct answer.");
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...form,
        questions: form.questions.map((q) => ({
          ...q,
          options: q.options.map((option) => option.trim()).filter(Boolean),
        })),
      };

      if (editing) await updateQuiz(id, payload);
      else await createQuiz(payload);

      navigate("/quizzes");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF8] px-4 py-10 text-[#765F55]"><div className="mx-auto max-w-4xl rounded-2xl border border-[#2D2E30]/10 bg-white p-8 shadow-sm">
          <p className="text-lg font-medium">Loading quiz details...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="min-h-screen bg-[#FFFDF8] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[#E58C1A]/15 bg-[#FFF9EA] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/quizzes")}
              className="inline-flex items-center gap-2 rounded-full border border-[#2D2E30]/15 bg-white px-3 py-2 text-sm font-semibold text-[#765F55] transition hover:border-[#E58C1A]/35 hover:bg-[#FFF1CE] hover:text-[#2D2E30]"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-[#C97112] sm:block">{editing ? "Editing" : "New quiz"}</span>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#2D2E30]/15 transition hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : editing ? "Save quiz" : "Create quiz"}
            </button>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-[#FFF1CE] p-3 text-[#C97112] shadow-sm ring-1 ring-[#E58C1A]/20">
            <BookOpenText size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112]">Assessment library</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#2D2E30]">
              {editing ? "Edit Quiz" : "Create Quiz"}
            </h1>
            <p className="mt-1 text-sm text-[#765F55]">
              Build a polished quiz with visual prompts and answer choices for your learners.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6">
          <div className="mb-5"><h2 className="text-xl font-bold text-[#2D2E30]">Quiz details</h2><p className="mt-1 text-sm text-[#765F55]">Set the course, quiz type, and attempt limit.</p></div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-[#2D2E30]">
              Course
              <QuizSelect ariaLabel="Course" value={form.courseId} onChange={(courseId) => setForm((f) => ({ ...f, courseId, lessonId: "" }))} placeholder="Select course" options={courses.map((course) => ({ value: course.id, label: course.title }))} />
            </label>

            <label className="text-sm font-bold text-[#2D2E30]">
              Quiz type
              <QuizSelect ariaLabel="Quiz type" value={form.quizType} onChange={(quizType) => setForm((f) => ({ ...f, quizType, lessonId: "" }))} placeholder="Select quiz type" options={[{ value: "lesson", label: "Lesson quiz" }, { value: "course", label: "Course quiz" }]} />
            </label>

            {form.quizType === "lesson" && (
              <label className="text-sm font-bold text-[#2D2E30] sm:col-span-2">
                Lesson
                <QuizSelect ariaLabel="Lesson" disabled={!form.courseId} value={form.lessonId} onChange={(lessonId) => setForm((f) => ({ ...f, lessonId }))} placeholder="Select lesson" options={lessons.map((lesson) => ({ value: lesson.id, label: `Lesson ${lesson.order}: ${lesson.title}` }))} />
              </label>
            )}

            <label className="text-sm font-semibold text-slate-800 sm:col-span-2">
              Quiz title
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Grammar Review Quiz"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none transition focus:border-pink-300 focus:bg-white focus:ring-2 focus:ring-pink-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-800 sm:col-span-2">
              Maximum attempts
              <span className="ml-2 text-xs font-normal text-slate-500">Leave empty for unlimited attempts</span>
              <input
                type="number"
                min="1"
                value={form.maxAttempts}
                onChange={(e) => setForm((f) => ({ ...f, maxAttempts: e.target.value }))}
                placeholder="3"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none transition focus:border-pink-300 focus:bg-white focus:ring-2 focus:ring-pink-100"
              />
            </label>
          </div>
        </section>

        <div className="mt-7 space-y-6">
          {form.questions.map((question, index) => {
            const optionCount = question.options.filter(Boolean).length;

            return (
              <section key={index} className="rounded-3xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF1CE] text-sm font-bold text-[#C97112]">
                      {index + 1}
                    </div>
                    <h2 className="text-xl font-bold text-[#2D2E30]">Question {index + 1}</h2>
                  </div>

                  {form.questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }))}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#A34D45]/20 bg-[#FFF0EE] px-3 py-2 text-sm font-semibold text-[#A34D45] transition hover:bg-[#FFE1DD]"
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
                  <label className="relative flex min-h-[180px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] transition hover:border-[#E58C1A] hover:bg-[#FFF1CE]">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadImage(index, e.target.files?.[0])}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                    {question.preview || question.image ? (
                      <img
                        src={question.preview || question.image}
                        alt={`Question ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex flex-col items-center gap-2 text-sm font-semibold text-[#765F55]">
                        <ImagePlus size={24} />
                        Upload prompt image
                      </span>
                    )}
                  </label>

                  <div className="space-y-5">
                    <label className="block text-sm font-semibold text-slate-800">
                      Prompt text
                      <span className="ml-2 text-xs font-normal text-slate-500">optional</span>
                      <input
                        value={question.prompt || ""}
                        onChange={(e) => updateQuestion(index, { prompt: e.target.value })}
                        placeholder="What is this?"
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none transition focus:border-pink-300 focus:bg-white focus:ring-2 focus:ring-pink-100"
                      />
                    </label>

                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">Answer choices</p>
                        <span className="text-xs font-medium text-slate-500">{optionCount}/4 options filled</span>
                      </div>

                      <div className="space-y-2.5">
                        {question.options.map((option, optionIndex) => (
                          <label
                            key={optionIndex}
                            className="flex items-center gap-3 rounded-xl border border-[#2D2E30]/10 bg-[#FFFDF8] px-3 py-2.5 transition hover:border-[#E58C1A]/35 hover:bg-[#FFF9EA]"
                          >
                            <input
                              type="radio"
                              name={`correct-${index}`}
                              checked={question.correctAnswer === optionIndex}
                              onChange={() => updateQuestion(index, { correctAnswer: optionIndex })}
                              className="h-4 w-4 accent-[#E58C1A]"
                            />
                            <span className="w-6 text-center text-sm font-medium text-slate-500">{String.fromCharCode(65 + optionIndex)}</span>
                            <input
                              value={option}
                              onChange={(e) => {
                                const nextOptions = [...question.options];
                                nextOptions[optionIndex] = e.target.value;
                                updateQuestion(index, { options: nextOptions });
                              }}
                              placeholder={`Answer ${optionIndex + 1}`}
                              className="w-full border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, questions: [...f.questions, newQuestion()] }))}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E58C1A]/30 bg-[#FFF9EA] px-4 py-2.5 text-sm font-bold text-[#C97112] transition hover:bg-[#FFF1CE]"
          >
            <Plus size={16} />
            Add another question
          </button>

          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 size={14} />
            {form.questions.length} question{form.questions.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </form>
  );
}

export default QuizEditor;
