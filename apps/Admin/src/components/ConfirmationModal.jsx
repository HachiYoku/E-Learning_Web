import { AlertCircle, KeyRound, X } from 'lucide-react'

function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  onConfirm, 
  onCancel,
  isDangerous = false,
  password,
  onPasswordChange,
  error = '',
  isSaving = false,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/55 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-2xl shadow-[#2D2E30]/25" role="dialog" aria-modal="true" aria-labelledby="confirmation-modal-title">
        {/* Header */}
        <div className={`flex items-center gap-3 border-b p-4 sm:p-6 ${isDangerous ? 'border-[#A34D45]/15 bg-[#FFF0EE]' : 'border-[#E58C1A]/15 bg-[#FFF9EA]'}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDangerous ? 'bg-[#FFE1DD] text-[#A34D45]' : 'bg-[#FFF1CE] text-[#C97112]'}`}>
            <AlertCircle size={21} />
          </span>
          <h2 id="confirmation-modal-title" className="flex-1 text-lg font-bold text-[#2D2E30] sm:text-xl">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg p-1 text-[#765F55] transition-colors hover:bg-white/70 hover:text-[#2D2E30] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]/50"
            aria-label="Close confirmation dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          <div className="text-sm leading-6 text-[#765F55] sm:text-base">{message}</div>
          {onPasswordChange ? <label className="mt-5 block text-sm font-bold text-[#2D2E30]"><span className="mb-2 flex items-center gap-2"><KeyRound size={16} className="text-[#C97112]" />Confirm admin password</span><input autoFocus type="password" value={password || ''} onChange={(event) => onPasswordChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onConfirm() }} disabled={isSaving} autoComplete="current-password" placeholder="Enter your password" className="w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3.5 py-3 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 disabled:bg-[#F5F1EA]" /></label> : null}
          {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div> : null}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:flex-row sm:gap-3 sm:p-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D2E30] transition-colors hover:bg-[#FFF4D8] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]/50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDangerous ? 'bg-[#A34D45] hover:bg-[#8D4039] focus:ring-[#A34D45]' : 'bg-[#2D2E30] hover:bg-[#E58C1A] focus:ring-[#E58C1A]'
            }`}
          >
            {isSaving ? 'Confirming…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal
