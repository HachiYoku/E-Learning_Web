import { LogOut } from "lucide-react"

function LogoutConfirmModal({ isOpen, onCancel, onConfirm }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2D2E30]/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-white shadow-[0_28px_70px_-30px_rgba(45,46,48,0.5)]" role="dialog" aria-modal="true" aria-labelledby="logout-confirmation-title">
        <div className="border-b border-[#2D2E30]/10 bg-[#FFF9EA] px-6 pb-6 pt-7 text-center sm:px-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#E58C1A]/25 bg-white text-[#C97112] shadow-sm">
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112]">Your account</p>
          <h2 id="logout-confirmation-title" className="mt-1.5 text-2xl font-bold tracking-tight text-[#2D2E30]">Sign out for now?</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#765F55]">You can sign back in whenever you’re ready to continue learning.</p>
        </div>
        <div className="flex gap-3 px-6 py-5 sm:px-8">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm font-bold text-[#2D2E30] transition hover:border-[#E58C1A] hover:bg-[#FFF4D8]">Cancel</button>
          <button type="button" onClick={onConfirm} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A]">Log out <LogOut className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  )
}

export default LogoutConfirmModal
