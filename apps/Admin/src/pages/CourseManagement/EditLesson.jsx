import { ArrowLeft, BookOpen, ListOrdered, Pencil, PlayCircle, Save } from 'lucide-react'
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
      <div className="flex min-h-screen items-center justify-center bg-[#FFFDF8] p-6">
        <div className="rounded-2xl border border-[#2D2E30]/10 bg-white px-6 py-5 text-sm font-semibold text-[#765F55] shadow-sm">Loading lesson details...</div>
      </div>
    )
  }

  if (!course || !lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFDF8] p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-sm font-semibold text-red-700">{error || 'Lesson not found'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8">
      <form onSubmit={handleSubmit} className="mx-auto max-w-6xl">
        <button type="button" onClick={() => navigate(`/courses/${id}`)} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#765F55] transition hover:text-[#C97112]"><ArrowLeft size={17} /> Back to lessons</button>
        <header className="mb-6 sm:mb-8"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112] sm:text-xs">Course curriculum</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl md:text-4xl">Edit lesson</h1><p className="mt-2 text-sm text-[#765F55] sm:text-base">Refine the lesson details your students will see.</p></header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(245px,0.78fr)_minmax(0,1.5fr)] lg:gap-8">
          <aside className="lg:sticky lg:top-8">
            <div className="overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_16px_35px_-28px_rgba(45,46,48,0.5)]">
              {course.image ? (
                <img
                  src={course.image}
                  alt={course.title}
                  className="h-44 w-full object-cover sm:h-52"
                />
              ) : (
                <div className="flex h-44 items-center justify-center bg-[#FFF1CE] text-[#9A5816] sm:h-52"><BookOpen size={28} />
                </div>
              )}
              <div className="p-5"><div className="mb-3 flex items-center justify-between gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${course.isPublished ? 'bg-[#EDF8EE] text-[#246B35]' : 'bg-[#FFF1CE] text-[#9A5816]'}`}>{course.isPublished ? 'Published' : 'Draft'}</span><span className="text-sm font-bold text-[#C97112]">{course.price}</span></div><h2 className="text-lg font-bold text-[#2D2E30]">{course.title}</h2><p className="mt-2 text-sm leading-6 text-[#765F55]">{course.description || 'No course description yet.'}</p></div>
            </div>
            <div className="mt-4 rounded-2xl border border-[#E58C1A]/18 bg-[#FFF9EA] p-4 text-sm text-[#765F55]"><p className="font-bold text-[#2D2E30]">Currently editing</p><p className="mt-1.5 flex items-center gap-2 leading-5"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-xs font-bold text-[#C97112]">{lesson.order}</span> {lesson.title}</p></div>
          </aside>

          <section className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_16px_35px_-28px_rgba(45,46,48,0.45)] sm:p-6">
            <div className="flex items-start gap-3 border-b border-[#2D2E30]/10 pb-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1CE] text-[#C97112]"><Pencil size={18} /></span><div><h2 className="font-bold text-[#2D2E30]">Lesson details</h2><p className="mt-1 text-sm text-[#765F55]">Update the title, video link, or position in the course.</p></div></div>
            {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <div className="mt-6 space-y-5">
              <label className="block"><span className="text-sm font-bold text-[#2D2E30]">Lesson title <span className="text-[#C97112]">*</span></span><input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g. Introduce yourself in Thai" className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-4 py-3 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:bg-white focus:ring-4 focus:ring-[#E58C1A]/10" /></label>
              <label className="block"><span className="text-sm font-bold text-[#2D2E30]">Video URL <span className="text-[#C97112]">*</span></span><span className="mt-1 block text-xs text-[#9B867C]">Use a secure YouTube, Google Drive, or hosted video link.</span><input type="url" name="videoUrl" value={formData.videoUrl} onChange={handleInputChange} placeholder="https://youtube.com/watch?v=..." className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-4 py-3 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:bg-white focus:ring-4 focus:ring-[#E58C1A]/10" /></label>
              <label className="block max-w-xs"><span className="flex items-center gap-2 text-sm font-bold text-[#2D2E30]"><ListOrdered size={16} className="text-[#C97112]" /> Lesson order <span className="text-[#C97112]">*</span></span><input type="number" name="order" min="1" value={formData.order} onChange={handleInputChange} className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-[#FFFDF8] px-4 py-3 text-sm text-[#2D2E30] outline-none transition focus:border-[#E58C1A] focus:bg-white focus:ring-4 focus:ring-[#E58C1A]/10" /></label>
            </div>
            {lesson.videoUrl ? <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#C97112] transition hover:text-[#9A5816]"><PlayCircle size={17} /> Preview current video</a> : null}
            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#2D2E30]/10 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => navigate(`/courses/${id}`)} className="rounded-xl px-4 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA] hover:text-[#2D2E30]">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-60"><Save size={17} /> {saving ? 'Updating...' : 'Save changes'}</button></div>
          </section>
        </div>
      </form>
    </div>
  )
}

export default EditLesson
