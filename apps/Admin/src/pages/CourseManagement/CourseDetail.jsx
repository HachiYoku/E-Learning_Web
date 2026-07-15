import { ArrowLeft, Plus, Trash2, Edit2 } from "lucide-react";
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
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Loading course...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">{error || "Course not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 md:px-8 py-4 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/courses")}
            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 shrink-0"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>

          <h1 className="flex-1 text-center text-lg sm:text-2xl md:text-3xl font-bold text-gray-900">
            Course Lessons
          </h1>

          <button
            onClick={handleAddLesson}
            className="shrink-0 flex items-center gap-1.5 bg-pink-300 text-gray-800 px-3 sm:px-5 py-2 rounded-lg hover:bg-pink-400 transition-colors font-medium text-sm sm:text-base"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Lesson</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 md:p-8">
        {error ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/*
          Layout:
          - mobile: stacked (course card on top, lessons below)
          - lg+: sidebar (course card left 1/3, lessons right 2/3)
        */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
          {/* Course Info Card */}
          <div className="w-full lg:col-span-1 lg:sticky lg:top-8">
            <div className="bg-white rounded-lg overflow-hidden shadow-md flex flex-row lg:flex-col">
              {course.image ? (
                <img
                  src={course.image}
                  alt={course.title}
                  className="w-28 sm:w-40 md:w-48 lg:w-full h-28 sm:h-40 md:h-48 lg:h-52 object-cover shrink-0"
                />
              ) : (
                <div className="flex w-28 sm:w-40 lg:w-full h-28 sm:h-40 lg:h-52 items-center justify-center bg-gray-100 text-gray-500 text-sm shrink-0">
                  No image
                </div>
              )}

              <div className="p-3 sm:p-4 lg:p-5 flex flex-col justify-center min-w-0">
                <h2 className="text-sm sm:text-base lg:text-xl font-bold text-gray-900 mb-1 truncate">
                  {course.title}
                </h2>
                <p className="text-xs text-gray-600 mb-2 line-clamp-2 lg:line-clamp-none">
                  {course.description}
                </p>
                <p className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 mb-1">
                  {course.price}
                </p>
                <p
                  className={`mb-0 text-xs font-semibold uppercase tracking-wide lg:mb-4 ${
                    course.isPublished ? "text-pink-400" : "text-gray-500"
                  }`}
                >
                  {course.isPublished
                    ? "Published on frontend"
                    : "Hidden from frontend"}
                </p>

                {/* What you'll learn — only show on lg+ in sidebar; hide on mobile to keep card compact */}
                {learnings.length > 0 && (
                  <div className="hidden lg:block mt-2">
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                      What you'll learn:
                    </h3>
                    <ul className="space-y-1.5">
                      {learnings.map((learning, index) => (
                        <li
                          key={index}
                          className="flex gap-2 text-xs text-gray-700"
                        >
                          <span className="text-gray-400 shrink-0">•</span>
                          <span>{learning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* What you'll learn on mobile — shown below the card */}
            {learnings.length > 0 && (
              <div className="lg:hidden mt-4 bg-white rounded-lg shadow-md p-4">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                  What you'll learn:
                </h3>
                <ul className="space-y-1.5">
                  {learnings.map((learning, index) => (
                    <li
                      key={index}
                      className="flex gap-2 text-xs text-gray-700"
                    >
                      <span className="text-gray-400 shrink-0">•</span>
                      <span>{learning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Lessons List */}
          <div className="w-full lg:col-span-2">
            {lessons.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 sm:p-12 text-center">
                <p className="text-gray-500 mb-1 text-sm sm:text-base">
                  No lessons in the course.
                </p>
                <p className="text-gray-500 text-sm sm:text-base">
                  Click add to create a new lesson.
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="bg-white rounded-xl shadow-md p-4 sm:p-5 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    {/* LEFT CONTENT */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-sm sm:text-base font-bold text-gray-900 whitespace-nowrap">
                          Lesson {lesson.order}
                        </span>

                        <span className="text-xs sm:text-sm font-medium bg-blue-100 text-blue-900 px-2.5 py-1 rounded-full truncate max-w-[180px] sm:max-w-[250px] md:max-w-full">
                          {lesson.title}
                        </span>
                      </div>

                      {lesson.videoUrl && (
                        <a
                          href={lesson.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs sm:text-sm text-blue-600 hover:underline break-all"
                        >
                          {lesson.videoUrl}
                        </a>
                      )}
                    </div>

                    {/* RIGHT BUTTONS */}
                    <div className="flex items-center justify-end sm:justify-start gap-2">
                      <button
                        onClick={() => handleEditLesson(lesson.id)}
                        className="flex items-center justify-center bg-gray-100 text-gray-700 p-2.5 rounded-lg hover:bg-gray-200 transition-colors"
                        title="Edit lesson"
                      >
                        <Edit2 size={18} />
                      </button>

                      <button
                        onClick={() => handleDeleteClick(lesson.id)}
                        className="flex items-center justify-center bg-gray-200 text-gray-700 p-2.5 rounded-lg hover:bg-gray-300 transition-colors"
                        title="Delete lesson"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
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
