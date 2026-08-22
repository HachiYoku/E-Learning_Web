import { Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getToken } from '../../api/tokenStorage'
import { validateFileSize } from '../../utils/fileValidation'
import { fetchPaymentSettings, updatePaymentSettings } from '../../services/paymentSettingsService'

function GeneralSettings() {
  const [paymentQr, setPaymentQr] = useState('')
  const [paymentQrFile, setPaymentQrFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementMessage, setAnnouncementMessage] = useState('')
  const [announcementLink, setAnnouncementLink] = useState('')
  const [announcementType, setAnnouncementType] = useState('system')
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false)
  const [announcementStatus, setAnnouncementStatus] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  // modal states for admin password confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [modalPassword, setModalPassword] = useState('')
  const [modalError, setModalError] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalSuccess, setModalSuccess] = useState('')

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true)
        setError('')
        const settings = await fetchPaymentSettings()
        setPaymentQr(settings.paymentQr)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handlePaymentQrUpload = (e) => {
    const file = e.target.files[0]
    if (!file) {
      return
    }

    const sizeError = validateFileSize(file, 'Global payment QR')
    if (sizeError) {
      setError(sizeError)
      e.target.value = ''
      return
    }

    setPaymentQr(URL.createObjectURL(file))
    setPaymentQrFile(file)
    setError('')
    setSuccessMessage('')
  }

  const handleSave = async () => {
    if (!paymentQr && !paymentQrFile) {
      setError('Please upload a payment QR before saving.')
      return
    }

    // open confirmation modal to ask for admin password
    setModalPassword('')
    setModalError('')
    setModalSuccess('')
    setShowConfirmModal(true)
  }

  const handleConfirmSave = async () => {
    if (!modalPassword || !modalPassword.trim()) {
      setModalError('Please enter your admin password to confirm.')
      return
    }

    try {
      setModalLoading(true)
      setModalError('')
      setModalSuccess('')

      const settings = await updatePaymentSettings({
        paymentQr,
        paymentQrFile,
        adminPassword: modalPassword,
      })

      setPaymentQr(settings.paymentQr)
      setPaymentQrFile(null)
      setSuccessMessage('Payment QR updated successfully.')
      setModalSuccess('Payment QR updated successfully.')

      // close modal after a short delay so user can see success
      setTimeout(() => {
        setShowConfirmModal(false)
        setModalPassword('')
        setModalError('')
        setModalSuccess('')
      }, 1100)
    } catch (saveError) {
      const msg = saveError && saveError.message ? String(saveError.message) : ''
      if (msg.toLowerCase().includes('invalid admin password') || msg.toLowerCase().includes('incorrect admin password')) {
        setModalError('Incorrect admin password. Please try again.')
      } else {
        setModalError(msg || 'Failed to update payment settings')
      }
    } finally {
      setModalLoading(false)
    }
  }

  const handleSendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setAnnouncementStatus('Please provide both a title and message before sending.')
      return
    }

    try {
      setSendingAnnouncement(true)
      setAnnouncementStatus('')
      const token = getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/notifications/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          title: announcementTitle.trim(),
          message: announcementMessage.trim(),
          link: announcementLink.trim(),
          type: announcementType,
        }),
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || 'Failed to send announcement');
        }
        return data;
      });

      setAnnouncementTitle('')
      setAnnouncementMessage('')
      setAnnouncementLink('')
      setAnnouncementType('system')
      setAnnouncementStatus(`Announcement sent to ${response.sentCount || 0} users.`)
    } catch (announcementError) {
      setAnnouncementStatus(announcementError.message)
    } finally {
      setSendingAnnouncement(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">Settings</h1>

      <div className="max-w-3xl rounded-2xl bg-white p-6 shadow-md sm:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Global Payment QR</h2>
          <p className="mt-2 text-sm text-gray-600">
            This QR is used for all courses by default. A course-specific QR will override it when one is uploaded in course management.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="py-8 text-sm text-gray-500">Loading payment settings...</div>
        ) : (
          <>
            <div className="relative flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:bg-gray-100">
              <input
                type="file"
                accept="image/*"
                onChange={handlePaymentQrUpload}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              {paymentQr ? (
                <img
                  src={paymentQr}
                  alt="Global payment QR"
                  className="max-h-80 w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <Upload size={32} />
                  <span className="text-sm font-medium">Upload payment QR</span>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Recommended: upload a clear square QR image. File must be 5 MB or smaller.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-pink-300 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-pink-400 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Payment QR'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 max-w-3xl rounded-2xl bg-white p-6 shadow-md sm:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Send User Announcement</h2>
          <p className="mt-2 text-sm text-gray-600">
            Create a system notification that will be delivered to all student users.
          </p>
        </div>

        {announcementStatus ? (
          <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${announcementStatus.includes('sent') ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {announcementStatus}
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-pink-400 focus:outline-none"
              placeholder="New course available"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={announcementMessage}
              onChange={(e) => setAnnouncementMessage(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-pink-400 focus:outline-none"
              placeholder="Share an update with your students..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Link (optional)</label>
            <input
              type="text"
              value={announcementLink}
              onChange={(e) => setAnnouncementLink(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-pink-400 focus:outline-none"
              placeholder="/my-courses"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Type</label>
            <select
              value={announcementType}
              onChange={(e) => setAnnouncementType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-pink-400 focus:outline-none"
            >
              <option value="system">System</option>
              <option value="info">Info</option>
              <option value="course">Course</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSendAnnouncement}
              disabled={sendingAnnouncement}
              className="rounded-lg bg-pink-300 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-pink-400 disabled:opacity-60"
            >
              {sendingAnnouncement ? 'Sending...' : 'Send to all users'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal for admin password */}
      {showConfirmModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="text-lg font-semibold mb-2">Confirm admin password</h3>
            <p className="text-sm text-gray-600 mb-4">Enter your admin password to confirm saving the Global Payment QR.</p>

            {modalError ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {modalError}
              </div>
            ) : null}

            {modalSuccess ? (
              <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                {modalSuccess}
              </div>
            ) : null}

            <input
              type="password"
              value={modalPassword}
              onChange={(e) => setModalPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 mb-4 text-sm text-gray-900 focus:border-pink-400 focus:outline-none"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowConfirmModal(false); setModalPassword(''); setModalError(''); setModalSuccess('') }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={modalLoading}
                className="rounded-lg bg-pink-300 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-pink-400 disabled:opacity-60"
              >
                {modalLoading ? 'Saving...' : 'Confirm and Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}


export default GeneralSettings
