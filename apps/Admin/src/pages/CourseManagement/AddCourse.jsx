import { ArrowLeft, Upload, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { createCourse } from '../../services/courseService'
import { validateFileSize } from '../../utils/fileValidation'

function AddCourse() {
  const navigate = useNavigate()
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

      navigate('/courses')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-4">
          <button
            onClick={() => navigate('/courses')}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 text-sm sm:text-base"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
            <span>Back</span>
          </button>
          <h1 className="w-full flex-1 text-left text-2xl font-bold text-gray-900 sm:text-center sm:text-3xl md:text-4xl">Add Course</h1>
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
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="col-span-1 space-y-6">
            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-3">
              Upload course image:
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 flex flex-col items-center justify-center min-h-64 sm:min-h-80 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative group">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {formData.image ? (
                <img
                  src={formData.image}
                  alt="Course preview"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 sm:gap-3 text-gray-500">
                  <Upload size={28} className="sm:w-8 sm:h-8" />
                  <span className="text-xs sm:text-sm font-medium">Upload</span>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">Image must be 5 MB or smaller.</p>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>

          <div className="col-span-1 lg:col-span-2 space-y-4 sm:space-y-6">
            

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                Course Title
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Add short course title"
                className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                Course description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your course"
                rows="4"
                className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                  Set price
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="4500"
                    className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 text-sm"
                  />
                  <span className="text-gray-700 font-medium">฿</span>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
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
                    className="w-16 sm:w-20 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 text-sm"
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

            <label className="flex items-start gap-3 text-sm text-gray-700 sm:items-center">
              <input
                type="checkbox"
                name="isPublished"
                checked={formData.isPublished}
                onChange={handleInputChange}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-pink-400 focus:ring-pink-300 sm:mt-0"
              />
              Publish this course to the student frontend
            </label>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                What you'll learn
              </label>
              <div className="space-y-2">
                {formData.learnings.map((learning, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <input
                      type="text"
                      value={learning}
                      onChange={(e) => handleLearningChange(index, e.target.value)}
                      placeholder="what students will get from this course"
                      className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 text-sm"
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
                  className="text-blue-500 hover:text-blue-600 text-xs sm:text-sm font-medium mt-2"
                >
                  + Add another
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddCourse
