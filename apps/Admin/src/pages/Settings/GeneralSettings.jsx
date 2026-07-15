import { Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { validateFileSize } from '../../utils/fileValidation'
import { fetchPaymentSettings, updatePaymentSettings } from '../../services/paymentSettingsService'

function GeneralSettings() {
  const [paymentQr, setPaymentQr] = useState('')
  const [paymentQrFile, setPaymentQrFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

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

    try {
      setSaving(true)
      setError('')
      setSuccessMessage('')
      const settings = await updatePaymentSettings({
        paymentQr,
        paymentQrFile,
      })
      setPaymentQr(settings.paymentQr)
      setPaymentQrFile(null)
      setSuccessMessage('Payment QR updated successfully.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
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
    </div>
  )
}

export default GeneralSettings
