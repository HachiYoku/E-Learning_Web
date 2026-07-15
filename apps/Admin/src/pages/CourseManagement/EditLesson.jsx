import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { fetchCourseById } from '../../services/courseService'
import { fetchLessonsByCourse, updateLesson } from '../../services/lessonService'

function EditLesson() {
  const navigate = useNavigate()
  const { id, lessonId } = useParams()
  
  const [course, setCourse] = useState(null)
  const [lesson, setLesson] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    videoUrl: '',
    order: 1,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadLessonData() {
      try {
        setLoading(true)
        setError('')

        const [courseResponse, lessonsResponse] = await Promise.all([
          fetchCourseById(id),
          fetchLessonsByCourse(id),
        ])

        const foundLesson = lessonsResponse.find((item) => item.id === lessonId)

        if (!foundLesson) {
          throw new Error('Lesson not found')
        }

        setCourse(courseResponse)
        setLesson(foundLesson)
        setFormData({
          title: foundLesson.title,
          videoUrl: foundLesson.videoUrl,
          order: foundLesson.order,
        })
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadLessonData()
  }, [id, lessonId])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
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

      await updateLesson(lesson.id, {
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
        <p className="text-gray-600">Loading lesson...</p>
      </div>
    )
  }

  if (!course || !lesson) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">{error || 'Lesson not found'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/courses/${id}`)}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 flex-1 text-center">Edit Lesson</h1>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 bg-pink-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-pink-400 transition-colors font-medium disabled:opacity-60"
          >
            {saving ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>

      <div className="p-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-8">
          <div className="col-span-1">
            <div className="bg-white rounded-lg overflow-hidden shadow-md sticky top-8">
              {course.image ? (
                <img
                  src={course.image}
                  alt={course.title}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center bg-gray-100 text-gray-500">
                  No image
                </div>
              )}
              <div className="p-4">
                <h2 className="text-lg font-bold text-gray-900 mb-2">{course.title}</h2>
                <p className="text-xs text-gray-600">{course.description}</p>
                <p className="text-sm font-bold text-gray-900 mt-3">{course.price}</p>
              </div>
            </div>
          </div>

          <div className="col-span-2 space-y-6">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Lesson Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter lesson title"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Video URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                name="videoUrl"
                value={formData.videoUrl}
                onChange={handleInputChange}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Lesson Order <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="order"
                min="1"
                value={formData.order}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditLesson
