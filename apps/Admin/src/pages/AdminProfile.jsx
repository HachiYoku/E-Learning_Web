import { Camera, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { validateFileSize } from '../utils/fileValidation'

function AdminProfile() {
  const { user, updateProfile } = useAuth()
  const adminEmail = user?.email || 'admin@example.com'
  const adminName = user?.name || 'Administrator'
  const [name, setName] = useState(adminName)
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setName(adminName)
    setAvatarPreview(user?.avatar || '')
    setAvatarFile(null)
  }, [adminName, user?.avatar])

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const sizeError = validateFileSize(file, 'Profile photo')
    if (sizeError) {
      setError(sizeError)
      setSuccessMessage('')
      event.target.value = ''
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    setAvatarFile(file)
    setError('')
    setSuccessMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!name.trim()) {
      setError('Admin name is required.')
      setSuccessMessage('')
      return
    }

    try {
      setIsSaving(true)
      setError('')
      setSuccessMessage('')

      await updateProfile({
        name: name.trim(),
        avatarFile,
      })

      setSuccessMessage('Admin profile updated successfully.')
      setAvatarFile(null)
    } catch (saveError) {
      setError(saveError.message || 'Failed to update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Admin Profile</h1>

      <form onSubmit={handleSubmit} className="max-w-3xl rounded-3xl bg-white p-6 shadow-md sm:p-8">
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="md:w-72">
            <label className="mb-3 block text-sm font-semibold text-gray-900">
              Profile photo
            </label>

            <label className="group relative flex min-h-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-pink-300 hover:bg-pink-50">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />

              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={name || adminName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-rose-400 text-3xl font-bold text-white">
                  {(name || adminName).charAt(0).toUpperCase()}
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gray-900/70 px-4 py-3 text-sm font-medium text-white opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                <Camera size={16} />
                Change photo
              </div>
            </label>

            <p className="mt-3 text-xs text-gray-500">Image must be 5 MB or smaller.</p>
          </div>

          <div className="flex-1 space-y-5">
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Admin name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError('')
                  setSuccessMessage('')
                }}
                placeholder="Enter admin name"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Email
              </label>
              <input
                type="email"
                value={adminEmail}
                disabled
                className="w-full cursor-not-allowed rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#F8B2C0] px-5 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-[#F8C2C0] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AdminProfile
