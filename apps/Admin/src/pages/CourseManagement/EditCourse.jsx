import { ArrowLeft, Upload, Star, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { fetchCourseById, updateCourse } from '../../services/courseService'
import { validateFileSize } from '../../utils/fileValidation'

function EditCourse() {
  const navigate = useNavigate()
  const { id } = useParams()
  const initialFormRef = useRef('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    rating: 4,
    learnings: [''],
    image: '',
    imageFile: null,
    paymentQr: '',
    paymentQrFile: null,
    isPublished: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)

  const getFormSnapshot = ({ imageFile, paymentQrFile, ...values }) =>
    JSON.stringify({ ...values, hasImageFile: Boolean(imageFile), hasPaymentQrFile: Boolean(paymentQrFile) })

  useEffect(() => {
    async function loadCourse() {
      try {
        setLoading(true)
        setError('')
        const course = await fetchCourseById(id)

        const loadedFormData = {
          title: course.title,
          description: course.description,
          price: String(course.priceValue),
          rating: course.rating,
          learnings: course.learnings.length ? course.learnings : [''],
          image: course.image,
          imageFile: null,
          paymentQr: course.paymentQr,
          paymentQrFile: null,
          isPublished: course.isPublished,
        }
        setFormData(loadedFormData)
        initialFormRef.current = getFormSnapshot(loadedFormData)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadCourse()
  }, [id])

  const hasUnsavedChanges = Boolean(initialFormRef.current) && getFormSnapshot(formData) !== initialFormRef.current

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) {
      return
    }

    const sizeError = validateFileSize(file, 'Course image')
    if (sizeError) {
      setError(sizeError)
      e.target.value = ''
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setFormData((prev) => ({
      ...prev,
      image: previewUrl,
      imageFile: file
    }))
    setError('')
  }

  const handleLearningChange = (index, value) => {
    const newLearnings = [...formData.learnings]
    newLearnings[index] = value
    setFormData((prev) => ({
      ...prev,
      learnings: newLearnings
    }))
  }



  const addLearning = () => {
    setFormData((prev) => ({
      ...prev,
      learnings: [...prev.learnings, '']
    }))
  }

  const removeLearning = (index) => {
    setFormData((prev) => ({
      ...prev,
      learnings: prev.learnings.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title || !formData.price) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      setSaving(true)
      setError('')

      await updateCourse(id, {
        ...formData,
        price: Number(formData.price),
      })

      initialFormRef.current = getFormSnapshot(formData)
      navigate('/courses')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setIsDiscardDialogOpen(true)
      return
    }

    navigate('/courses')
  }

  if (loading) {
    return <div className="min-h-screen bg-[#FFFDF8] p-4 text-[#765F55] sm:p-6 md:p-8">Loading course...</div>
  }

  return (
    <div className="min-h-screen bg-[#FFFDF8]">
      <div className="border-b border-[#E58C1A]/15 bg-[#FFFDF8] px-4 py-4 sm:px-6 sm:py-5 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-[#765F55] transition-colors hover:bg-[#FFF1CE] hover:text-[#2D2E30] sm:text-base"
          >
            <ArrowLeft size={18} className="sm:h-5 sm:w-5" />
            <span>Back</span>
          </button>
          <div className="w-full flex-1 sm:text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112]">Learning catalogue</p>
            <h1 className="mt-1 text-left text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-center sm:text-3xl">Edit course</h1>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#2D2E30]/15 transition-all hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6 sm:text-base"
          >
            {saving ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8">
        <form onSubmit={handleSubmit} className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:gap-8 lg:grid-cols-3">
          <div className="col-span-1 space-y-6">
            <section className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)]">
            <label className="mb-2 block text-sm font-bold text-[#2D2E30]">
              Course image
            </label>
            <p className="mb-4 text-xs leading-5 text-[#765F55]">Use a clear landscape image that represents the course.</p>
            <div className="group relative flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] p-6 transition-colors hover:border-[#E58C1A] hover:bg-[#FFF1CE] sm:min-h-80 sm:p-8">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {formData.image ? (
                <div className="flex h-full w-full flex-col items-center justify-center">
                  <img
                    src={formData.image}
                    alt="Course preview"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 pb-4 pt-10 text-sm font-semibold text-white">
                    <Upload size={16} />
                    <span className="text-xs font-medium">Update</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#765F55] sm:gap-3">
                  <Upload size={28} className="sm:h-8 sm:w-8" />
                  <span className="text-xs font-medium sm:text-sm">Upload</span>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-[#765F55]">PNG, JPG or WEBP &middot; maximum 5 MB</p>
            </section>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            
          </div>

          <div className="col-span-1 space-y-6 lg:col-span-2">

            <section className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6">
              <div className="mb-5"><h2 className="text-lg font-bold text-[#2D2E30]">Course details</h2><p className="mt-1 text-sm text-[#765F55]">Update the details students see before enrolling.</p></div>
            <div>
              <label className="mb-2 block text-xs font-bold text-[#2D2E30] sm:text-sm">
                Course Title
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Add short course title"
                className="w-full rounded-xl border border-[#2D2E30]/15 px-3 py-2.5 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 sm:px-4"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-[#2D2E30] sm:text-sm">
                Course description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your course"
                rows="4"
                className="w-full rounded-xl border border-[#2D2E30]/15 px-3 py-2.5 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 sm:px-4"
              />
            </div></section>

            <section className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6"><div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold text-[#2D2E30] sm:text-sm">
                  Set price
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="4500"
                    className="flex-1 rounded-xl border border-[#2D2E30]/15 px-3 py-2.5 text-sm text-[#2D2E30] outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 sm:px-4"
                  />
                  <span className="font-bold text-[#C97112]">฿</span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-[#2D2E30] sm:text-sm">
                  Set rating
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="rating"
                    value={formData.rating}
                    onChange={handleInputChange}
                    min="0"
                    max="5"
                    step="0.5"
                    className="w-16 rounded-xl border border-[#2D2E30]/15 px-2 py-2.5 text-sm text-[#2D2E30] outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 sm:w-20"
                  />
                  <span className="font-semibold text-[#765F55]">/5</span>
                  <div className="ml-1 flex gap-1 sm:ml-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={`sm:w-[18px] sm:h-[18px] ${i < Math.floor(formData.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <label className="mt-6 flex items-start gap-3 rounded-xl bg-[#FFF9EA] p-4 text-sm font-medium text-[#2D2E30] sm:items-center">
              <input
                type="checkbox"
                name="isPublished"
                checked={formData.isPublished}
                onChange={handleInputChange}
                className="mt-0.5 h-4 w-4 rounded border-[#2D2E30]/20 text-[#E58C1A] focus:ring-[#E58C1A]/30 sm:mt-0"
              />
              Publish this course to the student frontend
            </label></section>

            <section className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6">
              <div className="mb-4"><h2 className="text-lg font-bold text-[#2D2E30]">Learning outcomes</h2><p className="mt-1 text-sm text-[#765F55]">Keep the student benefits clear and specific.</p></div>
            <div>
              <label className="mb-2 block text-xs font-bold text-[#2D2E30] sm:text-sm">
                What you'll learn
              </label>
              <div className="space-y-2">
                {formData.learnings.map((learning, index) => (
                  <div key={index} className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFF1CE] text-xs font-bold text-[#C97112]">{index + 1}</span>
                    <input
                      type="text"
                      value={learning}
                      onChange={(e) => handleLearningChange(index, e.target.value)}
                      placeholder="what students will get from this course"
                      className="flex-1 rounded-xl border border-[#2D2E30]/15 px-3 py-2.5 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 sm:px-4"
                    />
                    {formData.learnings.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLearning(index)}
                        className="flex shrink-0 items-center justify-center rounded-xl bg-[#FFF0EE] p-2.5 text-[#A34D45] transition-colors hover:bg-[#FFE1DD]"
                        title="Remove"
                      >
                        <X size={18} />
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLearning}
                  className="mt-2 rounded-xl border border-[#E58C1A]/30 px-3 py-2 text-xs font-bold text-[#C97112] transition-colors hover:bg-[#FFF1CE] sm:text-sm"
                >
                  + Add another
                </button>
              </div>
            </div></section>
          </div>
        </form>
      </div>

      {isDiscardDialogOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#2D2E30]">Discard unsaved changes?</h2>
            <p className="mt-2 text-sm text-[#765F55]">Your course edits have not been saved. If you leave now, they will be lost.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsDiscardDialogOpen(false)} className="rounded-xl border border-[#2D2E30]/15 px-4 py-2 text-sm font-semibold text-[#2D2E30] hover:bg-[#FFF4D8]">Keep editing</button>
              <button type="button" onClick={() => navigate('/courses')} className="rounded-xl bg-[#A34D45] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8D4039]">Discard changes</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default EditCourse
