import { ArrowLeft, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchCourses } from "../../services/courseService";
import { fetchLessonsByCourse } from "../../services/lessonService";
import { createQuiz, fetchQuiz, updateQuiz } from "../../services/quizService";
import { validateFileSize } from "../../utils/fileValidation";

const newQuestion = () => ({ prompt: "", image: "", imageFile: null, preview: "", options: ["", "", "", ""], correctAnswer: 0 });

function QuizEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const [courses, setCourses] = useState([]); const [lessons, setLessons] = useState([]);
  const [form, setForm] = useState({ courseId: "", lessonId: "", title: "", maxAttempts: "", questions: [newQuestion()] });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCourses().then(setCourses).catch((err) => setError(err.message)); }, []);
  useEffect(() => { if (!form.courseId) { setLessons([]); return; } fetchLessonsByCourse(form.courseId).then(setLessons).catch((err) => setError(err.message)); }, [form.courseId]);
  useEffect(() => { if (!editing) { setLoading(false); return; } fetchQuiz(id).then((quiz) => setForm({ courseId: quiz.course?._id || quiz.course, lessonId: quiz.lesson?._id || quiz.lesson, title: quiz.title, maxAttempts: quiz.maxAttempts || "", questions: quiz.questions.map((q) => ({ ...q, imageFile: null, preview: q.image })) })).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, [editing, id]);

  const updateQuestion = (index, changes) => setForm((current) => ({ ...current, questions: current.questions.map((q, qIndex) => qIndex === index ? { ...q, ...changes } : q) }));
  const uploadImage = (index, file) => { if (!file) return; const sizeError = validateFileSize(file, "Question image"); if (sizeError) return setError(sizeError); updateQuestion(index, { imageFile: file, preview: URL.createObjectURL(file), image: "" }); };
  const submit = async (event) => {
    event.preventDefault();
    if (!form.courseId || !form.lessonId || !form.title.trim()) return setError("Choose a course and lesson, then enter a quiz title.");
    if (form.questions.some((q) => !(q.image || q.imageFile) || q.options.filter(Boolean).length < 2 || q.correctAnswer >= q.options.filter(Boolean).length)) return setError("Each question needs an image, at least two answers, and a valid correct answer.");
    try {
      setSaving(true); setError("");
      const payload = { ...form, questions: form.questions.map((q) => ({ ...q, options: q.options.map((option) => option.trim()).filter(Boolean) })) };
      if (editing) await updateQuiz(id, payload); else await createQuiz(payload);
      navigate("/quizzes");
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-gray-600">Loading quiz...</div>;
  return <form onSubmit={submit} className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8"><div className="mb-8 flex items-center justify-between gap-3"><button type="button" onClick={() => navigate("/quizzes")} className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-950"><ArrowLeft size={18} /> Back</button><button disabled={saving} className="rounded-lg bg-pink-300 px-5 py-2.5 font-medium text-gray-900 hover:bg-pink-400 disabled:opacity-60">{saving ? "Saving..." : editing ? "Save quiz" : "Create quiz"}</button></div>
    <div className="mx-auto max-w-4xl"><h1 className="text-3xl font-bold text-gray-900">{editing ? "Edit Quiz" : "Create Quiz"}</h1><p className="mt-1 text-gray-600">Add as many picture-and-word questions as this quiz needs.</p>{error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}
      <section className="mt-6 grid gap-4 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-2"><label className="text-sm font-semibold text-gray-800">Course<select required value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value, lessonId: "" }))} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label className="text-sm font-semibold text-gray-800">Lesson<select required disabled={!form.courseId} value={form.lessonId} onChange={(e) => setForm((f) => ({ ...f, lessonId: e.target.value }))} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal disabled:bg-gray-100"><option value="">Select lesson</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>Lesson {lesson.order}: {lesson.title}</option>)}</select></label><label className="text-sm font-semibold text-gray-800 sm:col-span-2">Quiz title<input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Lesson 1 Vocabulary Quiz" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-gray-800 sm:col-span-2">Maximum attempts <span className="font-normal text-gray-500">(leave empty for unlimited attempts)</span><input type="number" min="1" value={form.maxAttempts} onChange={(e) => setForm((f) => ({ ...f, maxAttempts: e.target.value }))} placeholder="Unlimited" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label></section>
      <div className="mt-7 space-y-6">{form.questions.map((question, index) => <section key={index} className="rounded-xl bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Question {index + 1}</h2>{form.questions.length > 1 && <button type="button" onClick={() => setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }))} className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-800"><Trash2 size={16} /> Remove</button>}</div><label className="mb-5 block text-sm font-semibold text-gray-800">Question text <span className="font-normal text-gray-500">(optional)</span><input value={question.prompt || ""} onChange={(e) => updateQuestion(index, { prompt: e.target.value })} placeholder="What is this?" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label><div className="grid gap-6 md:grid-cols-[200px_1fr]"><label className="relative flex min-h-40 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100"><input type="file" accept="image/*" onChange={(e) => uploadImage(index, e.target.files?.[0])} className="absolute inset-0 cursor-pointer opacity-0" />{question.preview || question.image ? <img src={question.preview || question.image} alt={`Question ${index + 1}`} className="h-40 w-full object-cover" /> : <span className="flex flex-col items-center gap-2 text-sm text-gray-500"><ImagePlus size={25} /> Upload picture</span>}</label><div><p className="mb-3 text-sm font-semibold text-gray-800">Answer choices <span className="font-normal text-gray-500">(select the correct word)</span></p><div className="space-y-2">{question.options.map((option, optionIndex) => <label key={optionIndex} className="flex items-center gap-3"><input type="radio" name={`correct-${index}`} checked={question.correctAnswer === optionIndex} onChange={() => updateQuestion(index, { correctAnswer: optionIndex })} /><input value={option} onChange={(e) => updateQuestion(index, { options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? e.target.value : item) })} placeholder={`Option ${optionIndex + 1}`} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>)}</div></div></div></section>)}</div>
      <button type="button" onClick={() => setForm((f) => ({ ...f, questions: [...f.questions, newQuestion()] }))} className="mt-6 inline-flex items-center gap-2 rounded-lg border border-pink-300 bg-white px-4 py-2.5 font-medium text-pink-700 hover:bg-pink-50"><Plus size={18} /> Add another question</button>
    </div></form>;
}

export default QuizEditor;
