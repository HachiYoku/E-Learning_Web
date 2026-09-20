import { CreditCard, Upload, X } from 'lucide-react'
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

  return (
    <main className="min-h-full bg-[#FFFDF8] p-4 sm:p-6 md:p-8">
      <header className="mx-auto max-w-5xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#C97112]">Platform controls</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">Settings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#765F55]">Manage shared settings that support every learner and course.</p></header>

      <section className="mx-auto mt-7 max-w-5xl overflow-hidden rounded-3xl border border-[#2D2E30]/10 bg-white shadow-[0_18px_45px_-34px_rgba(45,46,48,.55)]">
        <div className="flex flex-col gap-4 border-b border-[#E58C1A]/15 bg-gradient-to-r from-[#FFF9EA] to-[#FFFDF8] p-5 sm:flex-row sm:items-center sm:p-6"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1CE] text-[#C97112]"><CreditCard size={22} /></div><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#C97112]">Payments</p><h2 className="mt-1 text-xl font-bold text-[#2D2E30]">Global payment QR</h2><p className="mt-1 text-sm text-[#765F55]">Used by default unless a course has its own payment QR.</p></div></div>
        <div className="p-5 sm:p-6">

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
          <div className="rounded-2xl bg-[#FFF9EA] py-12 text-center text-sm text-[#765F55]">Loading payment settings...</div>
        ) : (
          <>
            <div className="relative flex min-h-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#E58C1A]/35 bg-[radial-gradient(circle_at_top,#FFF1CE,transparent_60%),#FFF9EA] p-5 transition hover:border-[#E58C1A] hover:bg-[#FFF4D8] sm:p-6">
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
                  className="max-h-80 w-full rounded-xl bg-white object-contain p-2 shadow-sm"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-[#765F55]">
                  <span className="rounded-2xl bg-white p-4 text-[#C97112] shadow-sm"><Upload size={28} /></span>
                  <span className="text-sm font-bold text-[#2D2E30]">Upload payment QR</span><span className="text-xs">Click or drop an image here</span>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs leading-5 text-[#765F55]">
              Recommended: upload a clear square QR image. File must be 5 MB or smaller.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#2D2E30]/10 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#9B867C]">Changes require your admin password.</p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="button-primary w-full px-5 py-3 sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save Payment QR'}
              </button>
            </div>
          </>
        )}
        </div>
      </section>

      {/* Confirmation modal for admin password */}
      {showConfirmModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-2xl shadow-[#2D2E30]/25" role="dialog" aria-modal="true" aria-labelledby="payment-confirmation-title">
            <div className="flex items-center justify-between border-b border-[#E58C1A]/15 bg-[#FFF9EA] p-4 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#C97112]">Protected action</p><h3 id="payment-confirmation-title" className="mt-1 text-base font-bold text-[#2D2E30] sm:text-lg">Save payment QR</h3></div><button type="button" onClick={() => { setShowConfirmModal(false); setModalPassword(''); setModalError(''); setModalSuccess('') }} disabled={modalLoading} className="shrink-0 rounded-lg p-1 text-[#765F55] transition hover:bg-white hover:text-[#2D2E30]" aria-label="Close"><X size={20} className="sm:h-6 sm:w-6" /></button></div>
            <div className="p-4 sm:p-6"><p className="mb-4 text-sm leading-6 text-[#765F55]">Enter your admin password to save the new global payment QR.</p>{modalError ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{modalError}</div> : null}{modalSuccess ? <div className="mb-3 rounded-xl border border-[#7AB589]/30 bg-[#EDF8EE] px-3 py-2.5 text-sm text-[#246B35]">{modalSuccess}</div> : null}<label className="mb-2 block text-xs font-bold text-[#2D2E30] sm:text-sm">Confirm admin password</label><input autoFocus type="password" value={modalPassword} onChange={(e) => setModalPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSave() }} placeholder="Enter your admin password to confirm" className="w-full rounded-xl border border-[#2D2E30]/15 px-3 py-3 text-sm outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" disabled={modalLoading} autoComplete="current-password" /></div>
            <div className="flex flex-col-reverse gap-2 border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:flex-row sm:gap-3 sm:p-6"><button type="button" onClick={() => { setShowConfirmModal(false); setModalPassword(''); setModalError(''); setModalSuccess('') }} disabled={modalLoading} className="flex-1 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D2E30] transition hover:bg-[#FFF4D8]">Cancel</button><button type="button" onClick={handleConfirmSave} disabled={modalLoading} className="flex-1 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-60">{modalLoading ? 'Saving...' : 'Confirm and save'}</button></div>
          </div>
        </div>
      ) : null}

    </main>
  )
}


export default GeneralSettings
