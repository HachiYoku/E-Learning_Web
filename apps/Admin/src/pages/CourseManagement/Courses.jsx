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
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-6 md:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Manage Course</h1>
        <button
          onClick={() => navigate('/courses/add')}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-pink-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-pink-400 transition-colors font-medium text-sm sm:text-base"
        >
          <Plus size={18} className="sm:w-5 sm:h-5" />
          Add Course
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-sm">
          Loading courses...
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-sm">
          No courses found. Create your first course to get started.
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
