import { LogIn, ShieldAlert } from "lucide-react";

function SessionExpiredModal({ isOpen, message, onContinue }) {
  if (!isOpen) return null;

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2D2E30]/65 p-4 backdrop-blur-sm"><div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#E58C1A]/20 bg-[#FFFDF8] shadow-[0_28px_70px_-26px_rgba(45,46,48,.65)]" role="dialog" aria-modal="true" aria-labelledby="admin-session-expired-title"><div className="h-1.5 bg-gradient-to-r from-[#E58C1A] via-[#F8C56A] to-[#FFF1CE]" /><div className="relative px-6 pb-6 pt-7 sm:px-8 sm:pb-8"><div className="absolute -right-16 -top-10 h-40 w-40 rounded-full bg-[#F8C56A]/20 blur-3xl" aria-hidden="true" /><div className="relative"><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E58C1A]/20 bg-[#FFF1CE] text-[#C97112] shadow-sm"><ShieldAlert size={27} aria-hidden="true" /></div><p className="mt-6 text-[10px] font-bold uppercase tracking-[.2em] text-[#C97112]">Admin session security</p><h2 id="admin-session-expired-title" className="mt-2 text-3xl font-bold tracking-tight text-[#2D2E30]">Please sign in again</h2><p className="mt-3 text-sm leading-6 text-[#765F55]">{message}</p><div className="mt-5 rounded-2xl border border-[#E58C1A]/15 bg-[#FFF9EA] px-4 py-3 text-sm leading-6 text-[#765F55]">For your protection, this admin workspace is locked until you authenticate again.</div><button type="button" onClick={onContinue} className="button-primary mt-6 w-full py-3.5"><LogIn size={17} /> Continue to admin sign in</button></div></div></div></div>;
}

export default SessionExpiredModal;
