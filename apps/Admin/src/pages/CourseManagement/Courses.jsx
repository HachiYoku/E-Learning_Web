import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import CourseCard from '../../components/CourseCard'
import ConfirmationModal from '../../components/ConfirmationModal'
import { deleteCourse, fetchCourses } from '../../services/courseService'

function Courses() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState(null)

  useEffect(() => {
    async function loadCourses() {
      try {
        setLoading(true)
        setError('')
        const response = await fetchCourses()
        setCourses(response)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadCourses()
  }, [])

  const handleDeleteClick = (id) => {
    const selectedCourse = courses.find((course) => course.id === id) || null
    setCourseToDelete(selectedCourse)
    setShowConfirmation(true)
  }

  const handleConfirmDelete = async () => {
    if (!courseToDelete?.id) {
      return
    }

    try {
      await deleteCourse(courseToDelete.id)
      setCourses((currentCourses) =>
        currentCourses.filter((course) => course.id !== courseToDelete.id)
      )
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setShowConfirmation(false)
      setCourseToDelete(null)
    }
  }

  const handleCancelDelete = () => {
    setShowConfirmation(false)
    setCourseToDelete(null)
  }

  const handleEdit = (id) => {
    navigate(`/courses/edit/${id}`)
  }

  return (
    <div className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112] sm:text-xs">Learning catalogue</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl md:text-4xl">Manage courses</h1>
          <p className="mt-2 text-sm text-[#765F55] sm:text-base">Create, update, and organise your Thai learning courses.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/courses/add')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#2D2E30]/15 transition-all hover:-translate-y-0.5 hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2 sm:w-auto sm:text-base"
        >
          <Plus size={18} className="sm:w-5 sm:h-5" />
          Add Course
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[#2D2E30]/10 bg-white p-8 text-center text-[#765F55] shadow-sm">
          Loading courses...
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] p-8 text-center text-[#765F55] sm:p-12">
          <p className="text-lg font-bold text-[#2D2E30]">No courses yet</p>
          <p className="mt-2 text-sm">Create your first course to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={showConfirmation}
        title="Delete Course"
        message={
          courseToDelete?.enrollmentCount > 0
            ? (
              <p>
                This course currently has{" "}
                <span className="font-bold">{courseToDelete.enrollmentCount}</span>{" "}
                enrolled user{courseToDelete.enrollmentCount > 1 ? 's' : ''}. Are you sure you want to delete it? This action cannot be undone.
              </p>
            )
            : "Are you sure you want to delete this course? This action cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDangerous={true}
      />
    </div>
  )
}

export default Courses
