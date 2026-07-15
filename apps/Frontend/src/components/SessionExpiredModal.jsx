function SessionExpiredModal({ isOpen, message, onLoginClick }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-r from-rose-50 via-pink-50 to-blue-50 px-6 pb-5 pt-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8B2C0] text-gray-900 shadow-sm">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm0 20c-4.962 0-9-4.038-9-9s4.038-9 9-9 9 4.038 9 9-4.038 9-9 9zm.5-13H11v6h1.5V8zm0 8H11v1.5h1.5V16z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Session Expired
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {message}
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <svg className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <p className="text-sm text-amber-800">
              For your security, your session was closed. Please sign in again to continue.
            </p>
          </div>

          <button
            type="button"
            onClick={onLoginClick}
            className="w-full rounded-2xl bg-[#F8B2C0] px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-[#F8C2C0]"
          >
            Continue to Login
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionExpiredModal
