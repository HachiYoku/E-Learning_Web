import { LogIn, ShieldCheck } from "lucide-react"

function SessionExpiredModal({ isOpen, message, onLoginClick }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2D2E30]/55 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-[#2D2E30]/10 bg-[#FFFDF8] p-6 shadow-[0_28px_70px_-28px_rgba(45,46,48,0.55)] sm:p-8" role="dialog" aria-modal="true" aria-labelledby="session-expired-title">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#F8C56A]/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1CE] text-[#C97112] shadow-sm">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[#C97112]">Session security</p>
          <h2 id="session-expired-title" className="mt-2 font-serif text-3xl text-[#2D2E30]">Please sign in again</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#765F55]">{message}</p>
          <button
            type="button"
            onClick={onLoginClick}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-[#2D2E30]/15 transition hover:bg-[#E58C1A]"
          >
            Continue to sign in <LogIn className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionExpiredModal
