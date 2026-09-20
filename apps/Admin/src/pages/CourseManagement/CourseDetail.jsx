import { ArrowLeft, BookOpen, CheckCircle2, Edit2, ExternalLink, ListVideo, PlayCircle, Plus, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import ConfirmationModal from "../../components/ConfirmationModal";
import { fetchCourseById } from "../../services/courseService";
import {
  deleteLesson,
  fetchLessonsByCourse,
} from "../../services/lessonService";

function CourseDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState(null);
  const [learnings, setLearnings] = useState([]);

  useEffect(() => {
    async function loadCourseData() {
      try {
        setLoading(true);
        setError("");
        const [courseResponse, lessonsResponse] = await Promise.all([
          fetchCourseById(id),
          fetchLessonsByCourse(id),
        ]);
        setCourse(courseResponse);
        setLearnings(courseResponse.learnings || []);
        setLessons(lessonsResponse);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadCourseData();
  }, [id]);

  const handleAddLesson = () => navigate(`/courses/${id}/add-lesson`);
  const handleEditLesson = (lessonId) =>
    navigate(`/courses/${id}/edit-lesson/${lessonId}`);

  const handleDeleteClick = (lessonId) => {
    setLessonToDelete(lessonId);
    setShowConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (!lessonToDelete) return;
    try {
      await deleteLesson(lessonToDelete);
      setLessons((curr) => curr.filter((l) => l.id !== lessonToDelete));
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setShowConfirmation(false);
      setLessonToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmation(false);
    setLessonToDelete(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFDF8] p-6">
        <div className="rounded-2xl border border-[#2D2E30]/10 bg-white px-6 py-5 text-sm font-semibold text-[#765F55] shadow-sm">Loading course details...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFDF8] p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-sm font-semibold text-red-700">{error || "Course not found"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={() => navigate("/courses")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#765F55] transition hover:text-[#C97112]"
        >
          <ArrowLeft size={17} /> Back to courses
        </button>

        <header className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112] sm:text-xs">Course curriculum</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl md:text-4xl">Manage lessons</h1>
            <p className="mt-2 text-sm text-[#765F55] sm:text-base">Build a clear learning journey for <span className="font-semibold text-[#2D2E30]">{course.title}</span>.</p>
          </div>
          <button
            type="button"
            onClick={handleAddLesson}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#2D2E30]/15 transition-all hover:-translate-y-0.5 hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2 sm:w-auto"
          >
            <Plus size={18} /> Add lesson
          </button>
        </header>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.7fr)] lg:gap-8">
          <div className="w-full lg:col-span-1 lg:sticky lg:top-8">
            <div className="overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_16px_35px_-28px_rgba(45,46,48,0.5)]">
              {course.image ? (
                <img
                  src={course.image}
                  alt={course.title}
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center bg-[#FFF1CE] text-[#9A5816]">
                  <BookOpen size={28} />
                </div>
              )}
              <div className="p-5">
                <div className="mb-3 flex items-center justify-between gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${course.isPublished ? "bg-[#EDF8EE] text-[#246B35]" : "bg-[#FFF1CE] text-[#9A5816]"}`}>{course.isPublished ? "Published" : "Draft"}</span><span className="text-sm font-bold text-[#C97112]">{course.price}</span></div>
                <h2 className="text-lg font-bold text-[#2D2E30]">{course.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#765F55]">{course.description || "No course description yet."}</p>
                <div className="mt-5 flex items-center gap-2 border-t border-[#2D2E30]/10 pt-4 text-sm font-semibold text-[#765F55]"><ListVideo size={17} className="text-[#C97112]" /> {lessons.length} lesson{lessons.length === 1 ? "" : "s"}</div>
                {learnings.length > 0 && (
                  <div className="mt-5 border-t border-[#2D2E30]/10 pt-4">
                    <h3 className="text-sm font-bold text-[#2D2E30]">What students will learn</h3>
                    <ul className="mt-3 space-y-2">
                      {learnings.map((learning, index) => (
                        <li key={index} className="flex gap-2 text-xs leading-5 text-[#765F55]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#7EAF85]" />{learning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-full">
            {lessons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] p-8 text-center sm:p-12">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1CE] text-[#C97112]"><ListVideo size={23} /></span>
                <p className="mt-4 text-lg font-bold text-[#2D2E30]">No lessons yet</p>
                <p className="mt-2 text-sm text-[#765F55]">Create the first lesson to start building this course.</p>
                <button type="button" onClick={handleAddLesson} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E58C1A]"><Plus size={16} /> Add first lesson</button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_16px_35px_-28px_rgba(45,46,48,0.45)]">
                <div className="flex items-center justify-between border-b border-[#2D2E30]/10 px-4 py-4 sm:px-5"><div><h2 className="font-bold text-[#2D2E30]">Lesson sequence</h2><p className="mt-0.5 text-xs text-[#765F55]">Students see these lessons in order.</p></div><span className="rounded-full bg-[#FFF9EA] px-3 py-1 text-xs font-bold text-[#9A5816]">{lessons.length} total</span></div>
                <div className="divide-y divide-[#2D2E30]/8">
                {lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="group flex flex-col gap-4 p-4 transition hover:bg-[#FFFDF8] sm:flex-row sm:items-center sm:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1CE] text-sm font-bold text-[#9A5816]">{lesson.order}</span>
                      <div className="min-w-0"><h3 className="truncate font-bold text-[#2D2E30]">{lesson.title}</h3>{lesson.videoUrl ? <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-[#765F55] transition hover:text-[#C97112]"><PlayCircle size={14} className="shrink-0 text-[#C97112]" /><span className="truncate">Video lesson</span><ExternalLink size={12} className="shrink-0" /></a> : <p className="mt-1 text-xs text-[#9B867C]">No video link added</p>}</div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleEditLesson(lesson.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#2D2E30]/12 bg-white px-3 py-2 text-xs font-bold text-[#2D2E30] transition hover:border-[#E58C1A]/40 hover:bg-[#FFF9EA]"
                        title="Edit lesson"
                      >
                        <Edit2 size={15} /> <span className="hidden sm:inline">Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteClick(lesson.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-[#A34D45]/20 bg-[#FFF0EE] p-2 text-[#A34D45] transition hover:bg-[#FFE1DD]"
                        title="Delete lesson"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmation}
        title="Delete Lesson"
        message="Are you sure you want to delete this lesson? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDangerous={true}
      />
    </div>
  );
}

export default CourseDetail;
