import { ArrowLeft, Upload, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { createCourse } from '../../services/courseService'
import { validateFileSize } from '../../utils/fileValidation'

function AddCourse() {
  const navigate = useNavigate()
  const titleRef = useRef(null)
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)

  const getFormSnapshot = ({ imageFile, paymentQrFile, ...values }) =>
    JSON.stringify({ ...values, hasImageFile: Boolean(imageFile), hasPaymentQrFile: Boolean(paymentQrFile) })

  if (!initialFormRef.current) {
    initialFormRef.current = getFormSnapshot(formData)
  }

  useEffect(() => {
    const titleField = titleRef.current
    if (!titleField) return

    titleField.style.height = 'auto'
    titleField.style.height = `${Math.min(titleField.scrollHeight, 144)}px`
  }, [formData.title])

  const hasUnsavedChanges = getFormSnapshot(formData) !== initialFormRef.current

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

  const handlePaymentQrUpload = (e) => {
    const file = e.target.files[0]
    if (!file) {
      return
    }

    const sizeError = validateFileSize(file, 'Payment QR')
    if (sizeError) {
      setError(sizeError)
      e.target.value = ''
      return
    }

    const previewUrl = URL.createObjectURL(file)

    setFormData((prev) => ({
      ...prev,
      paymentQr: previewUrl,
      paymentQrFile: file
    }))
    setError('')
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

    if (!formData.title || !formData.price || !formData.imageFile) {
      setError('Please fill in all required fields: title, price, and image.')
      return
    }

    try {
      setLoading(true)
      setError('')

      await createCourse({
        ...formData,
        price: Number(formData.price),
      })

      initialFormRef.current = getFormSnapshot(formData)
      navigate('/courses')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setIsDiscardDialogOpen(true)
      return
    }

    navigate('/courses')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 sm:py-5 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-4">
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 text-sm sm:text-base"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
            <span>Back</span>
          </button>
          <div className="flex-1 sm:text-center">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Create course</h1>
            <p className="mt-1 text-sm text-gray-500">Add the details students will see before enrolling.</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-pink-300 text-gray-800 px-4 sm:px-6 py-2 rounded-lg hover:bg-pink-400 transition-colors font-medium text-sm sm:text-base disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8">
        <form onSubmit={handleSubmit} className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Course image <span className="text-pink-500">*</span>
            </label>
            <p className="mb-4 text-xs leading-5 text-gray-500">Use a clear landscape image that represents the course.</p>
            <div className="relative flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:border-pink-300 hover:bg-pink-50 sm:min-h-72">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {formData.image ? (
                <>
                  <img
                    src={formData.image}
                    alt="Course preview"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-10 text-center text-sm font-medium text-white">Change image</div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 sm:gap-3 text-gray-500">
                  <Upload size={28} className="sm:w-8 sm:h-8" />
                  <span className="text-xs sm:text-sm font-medium">Upload</span>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-gray-500">PNG, JPG or WEBP &middot; maximum 5 MB</p>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>

          <div className="space-y-6 lg:col-span-2">
            

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Course details</h2>
                <p className="mt-1 text-sm text-gray-500">Start with a clear title and short description.</p>
              </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Course title <span className="text-pink-500">*</span>
              </label>
              <textarea
                ref={titleRef}
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g. English for everyday conversations"
                rows={1}
                className="w-full min-h-[2.75rem] max-h-36 resize-none overflow-y-auto rounded-lg border border-gray-300 px-3 py-2 text-base font-medium text-gray-900 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200 sm:px-4"
              />
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Course description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your course"
                rows="5"
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200 sm:px-4"
              />
            </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Price <span className="text-pink-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="4500"
                    min="0"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200 sm:px-4"
                  />
                  <span className="text-gray-700 font-medium">฿</span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Course rating
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
                    className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200 sm:w-20"
                  />
                  <span className="text-gray-700 font-medium">/5</span>
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

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-pink-50 p-4 text-sm text-gray-700 sm:items-center">
              <input
                type="checkbox"
                name="isPublished"
                checked={formData.isPublished}
                onChange={handleInputChange}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-pink-400 focus:ring-pink-300 sm:mt-0"
              />
              Publish this course to the student frontend
            </label>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Learning outcomes</h2>
                <p className="mt-1 text-sm text-gray-500">Add the skills or knowledge students will gain.</p>
              </div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                What you'll learn
              </label>
              <div className="space-y-3">
                {formData.learnings.map((learning, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-100 text-xs font-semibold text-pink-700">{index + 1}</span>
                    <input
                      type="text"
                      value={learning}
                      onChange={(e) => handleLearningChange(index, e.target.value)}
                      placeholder="what students will get from this course"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200 sm:px-4"
                    />
                    {formData.learnings.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLearning(index)}
                        className="shrink-0 rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-300 sm:text-base"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLearning}
                  className="mt-1 rounded-lg border border-pink-200 px-3 py-2 text-sm font-medium text-pink-700 transition-colors hover:bg-pink-50"
                >
                  + Add another
                </button>
              </div>
            </section>
          </div>
        </form>
      </div>

      {isDiscardDialogOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Discard unsaved changes?</h2>
            <p className="mt-2 text-sm text-gray-600">Your course draft has changes that have not been created. If you leave now, they will be lost.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsDiscardDialogOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Keep editing</button>
              <button type="button" onClick={() => navigate('/courses')} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Discard changes</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default AddCourse
