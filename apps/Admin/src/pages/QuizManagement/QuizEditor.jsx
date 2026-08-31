import { ArrowLeft, BookOpenText, CheckCircle2, ImagePlus, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
      <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-700">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-lg font-medium">Loading quiz details...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-pink-100 via-rose-50 to-indigo-50 p-5 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/quizzes")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 sm:block">
              {editing ? "Update quiz" : "New quiz"}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-pink-300 to-rose-300 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : editing ? "Save quiz" : "Create quiz"}
            </button>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-white p-3 text-pink-600 shadow-sm ring-1 ring-slate-200">
            <BookOpenText size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {editing ? "Edit Quiz" : "Create Quiz"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Build a polished quiz with visual prompts and answer choices for your learners.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-pink-100 p-2 text-pink-700">
              <Sparkles size={18} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Quiz details</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-800">
              Course
              <select
                required
                value={form.courseId}
                onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value, lessonId: "" }))}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none transition focus:border-pink-300 focus:bg-white focus:ring-2 focus:ring-pink-100"
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-800">
              Quiz type
              <select
                required
                value={form.quizType}
                onChange={(e) => setForm((f) => ({ ...f, quizType: e.target.value, lessonId: "" }))}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none transition focus:border-pink-300 focus:bg-white focus:ring-2 focus:ring-pink-100"
              >
                <option value="lesson">Lesson quiz</option>
                <option value="course">Course quiz</option>
              </select>
            </label>

            {form.quizType === "lesson" && (
              <label className="text-sm font-semibold text-slate-800 sm:col-span-2">
                Lesson
                <select
                  required
                  disabled={!form.courseId}
                  value={form.lessonId}
                  onChange={(e) => setForm((f) => ({ ...f, lessonId: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none transition focus:border-pink-300 focus:bg-white focus:ring-2 focus:ring-pink-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">Select lesson</option>
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      Lesson {lesson.order}: {lesson.title}
                    </option>
                  ))}
                </select>
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
              <section key={index} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-sm font-bold text-pink-700">
                      {index + 1}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Question {index + 1}</h2>
                  </div>

                  {form.questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }))}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
                  <label className="relative flex min-h-[180px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-pink-300 hover:bg-pink-50">
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
                      <span className="flex flex-col items-center gap-2 text-sm font-medium text-slate-500">
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
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-pink-200 hover:bg-pink-50"
                          >
                            <input
                              type="radio"
                              name={`correct-${index}`}
                              checked={question.correctAnswer === optionIndex}
                              onChange={() => updateQuestion(index, { correctAnswer: optionIndex })}
                              className="h-4 w-4 accent-pink-500"
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
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-4 py-2.5 text-sm font-semibold text-pink-700 transition hover:bg-pink-100"
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
