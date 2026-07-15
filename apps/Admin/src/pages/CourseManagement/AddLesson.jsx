import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { fetchCourseById } from '../../services/courseService'
import { createLesson, fetchLessonsByCourse } from '../../services/lessonService'

function AddLesson() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [course, setCourse] = useState(null)
  const [formData, setFormData] = useState({ title: '', videoUrl: '', order: 1 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadCourseData() {
      try {
        setLoading(true)
        setError('')
        const [courseResponse, lessonsResponse] = await Promise.all([
          fetchCourseById(id),
          fetchLessonsByCourse(id),
        ])
        const nextOrder = lessonsResponse.length
          ? Math.max(...lessonsResponse.map((l) => l.order)) + 1
          : 1
        setCourse(courseResponse)
        setFormData((prev) => ({ ...prev, order: nextOrder }))
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }
    loadCourseData()
  }, [id])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.videoUrl) {
      setError('Please fill in all required fields.')
      return
    }
    try {
      setSaving(true)
      setError('')
      await createLesson(id, {
        title: formData.title,
        videoUrl: formData.videoUrl,
        order: Number(formData.order),
      })
      navigate(`/courses/${id}`)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Loading course...</p>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">{error || 'Course not found'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 md:px-8">
        <div className="flex items-center justify-between gap-4">

          {/* Back */}
          <button
            onClick={() => navigate(`/courses/${id}`)}
            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 shrink-0"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Title — centered */}
          <h1 className="flex-1 text-center text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900">
            Add Lesson
          </h1>

          {/* Save Button */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="shrink-0 rounded-lg bg-pink-300 px-4 sm:px-6 py-2 text-sm sm:text-base font-medium text-gray-800 transition-colors hover:bg-pink-400 disabled:opacity-60"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 md:p-8">
        <form onSubmit={handleSubmit}>

          {/*
            Layout:
            - mobile/tablet (<lg): course card on top, form below (stacked)
            - lg+: course card in left sidebar (1/3), form on right (2/3)
          */}
          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-8 items-start">

            {/* Course Card — horizontal on md, sidebar on lg+ */}
            <div className="w-full lg:col-span-1 lg:sticky lg:top-8">
              <div className="overflow-hidden rounded-lg bg-white shadow-md flex flex-row lg:flex-col">
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
                  <h2 className="mb-1 text-sm sm:text-base lg:text-lg font-bold text-gray-900 truncate">
                    {course.title}
                  </h2>
                  <p className="text-xs text-gray-600 line-clamp-2 lg:line-clamp-3">
                    {course.description}
                  </p>
                  <p className="text-sm font-bold text-gray-900 mt-2">{course.price}</p>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="w-full lg:col-span-2 space-y-4 sm:space-y-6">
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                  Lesson Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter lesson title"
                  className="w-full rounded-lg border border-gray-300 px-3 sm:px-4 py-2 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-pink-300"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                  Video URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  name="videoUrl"
                  value={formData.videoUrl}
                  onChange={handleInputChange}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full rounded-lg border border-gray-300 px-3 sm:px-4 py-2 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-pink-300"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                  Lesson Order <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="order"
                  min="1"
                  value={formData.order}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-3 sm:px-4 py-2 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-pink-300"
                />
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  )
}

export default AddLesson