import { Loader2, Maximize2, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { fetchPaymentProofBlob } from '../services/paymentService'

function PaymentCard({ payment, onApprove, onDeny, status = 'review' }) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [proofUrl, setProofUrl] = useState('')
  const [proofError, setProofError] = useState('')
  const [loadingProof, setLoadingProof] = useState(false)
  const approved = status === 'approved'
  const denied = status === 'denied'
  const statusStyle = approved ? 'bg-[#EDF8EE] text-[#246B35]' : denied ? 'bg-[#FFF0EE] text-[#A34D45]' : 'bg-[#FFF1CE] text-[#A86710]'
  const statusLabel = approved ? 'Approved' : denied ? 'Denied' : 'Awaiting review'

  const loadProof = async () => {
    if (!payment.hasPaymentProof) return
    if (proofUrl) URL.revokeObjectURL(proofUrl)
    setProofUrl('')
    setProofError('')
    setLoadingProof(true)
    try {
      setProofUrl(await fetchPaymentProofBlob(payment.id))
    } catch (error) {
      setProofError(error.message || 'Unable to securely load this payment proof.')
    } finally {
      setLoadingProof(false)
    }
  }

  const openProof = () => {
    if (!payment.hasPaymentProof) return
    setViewerOpen(true)
    loadProof()
  }

  const closeProof = () => {
    setViewerOpen(false)
    if (proofUrl) URL.revokeObjectURL(proofUrl)
    setProofUrl('')
    setProofError('')
  }

  return <>
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_14px_34px_-28px_rgba(45,46,48,.6)]">
      <div className="flex items-center justify-between border-b border-[#2D2E30]/10 bg-[#FFFDF8] px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyle}`}>{statusLabel}</span><span className="text-xs text-[#9B867C]">{payment.date || payment.userDate}</span></div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <button type="button" onClick={openProof} disabled={!payment.hasPaymentProof || loadingProof} title={payment.hasPaymentProof ? 'Open secure payment receipt' : 'No payment receipt available'} className="group relative block w-full overflow-hidden rounded-xl border border-[#2D2E30]/10 bg-[#F5F1EA] text-left transition hover:border-[#E58C1A]/45 hover:bg-[#FFF9EA] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]/50 disabled:cursor-not-allowed">
          <div className="flex h-44 flex-col items-center justify-center gap-2 px-4 text-center text-[#765F55]">
            {loadingProof ? <><Loader2 className="h-5 w-5 animate-spin text-[#C97112]" /><span className="text-sm font-semibold">Loading secure receipt…</span></> : payment.hasPaymentProof ? <><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#C97112] shadow-sm"><ShieldCheck size={20} /></span><span className="text-sm font-semibold">View secure payment receipt</span><span className="text-xs text-[#9B867C]">Opens in a private viewer</span></> : 'No receipt image'}
          </div>
          <span className="absolute right-3 top-3 rounded-lg bg-white p-2 text-[#2D2E30] shadow-sm transition group-hover:bg-[#FFF1CE]"><Maximize2 size={15} /></span>
        </button>
        {proofError ? <p className="mt-2 text-xs text-[#A34D45]">{proofError}</p> : null}
        <div className="mt-4 flex items-center gap-3"><img src={payment.userAvatar} alt="" className="h-10 w-10 rounded-full object-cover" /><div className="min-w-0"><h3 className="truncate font-bold">{payment.userName}</h3><p className="truncate text-xs text-[#765F55]">{payment.userEmail}</p></div></div>
        <section className="mt-4 min-h-40 rounded-xl border border-[#2D2E30]/8 bg-[#FFFDF8] p-3" aria-label="Payment summary"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mt-1 truncate text-sm font-semibold text-[#2D2E30]">{payment.courseName}</p></div>{payment.promoCode ? <span className="shrink-0 rounded-full bg-[#E9F4EA] px-2 py-1 text-[10px] font-bold text-[#246B35]">Promo applied</span> : null}</div><div className="mt-3 space-y-2 border-t border-[#2D2E30]/10 pt-3 text-xs"><div className="flex items-center justify-between gap-3 text-[#765F55]"><span>Original price</span><span className={payment.promoCode ? 'line-through' : 'font-medium text-[#2D2E30]'}>฿{payment.originalAmountValue.toLocaleString()}</span></div><div className="flex items-end justify-between gap-3 border-t border-[#2D2E30]/10 pt-2"><span className="text-xs font-bold uppercase tracking-wide text-[#765F55]">Amount due</span><span className="text-lg font-bold text-[#C97112]">{payment.coursePrice}</span></div></div></section>
        {denied && payment.denialReason ? <div className="mt-4 rounded-xl bg-[#FFF0EE] p-3 text-sm"><b>Reason for denial:</b> {payment.denialReason}</div> : null}
        {status === 'review' ? <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => onDeny(payment.id)} className="rounded-xl border border-[#A34D45]/25 px-3 py-2.5 text-sm font-bold text-[#A34D45] hover:bg-[#FFF0EE]">Deny</button><button type="button" onClick={() => onApprove(payment.id)} className="rounded-xl bg-[#2D2E30] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A]">Approve</button></div> : null}
      </div>
    </article>

    {viewerOpen ? <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2D2E30]/70 p-2 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby={`payment-proof-title-${payment.id}`}>
      <div className="flex min-h-full items-center justify-center">
        <section className="flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#FFFDF8] shadow-2xl sm:h-[calc(100dvh-2.5rem)]">
          <header className="flex shrink-0 items-center justify-between border-b border-[#2D2E30]/10 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#C97112]">Secure payment receipt</p><h2 id={`payment-proof-title-${payment.id}`} className="mt-1 truncate text-base font-bold text-[#2D2E30] sm:text-lg">Receipt from {payment.userName}</h2></div>
            <button type="button" onClick={closeProof} className="ml-4 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2D2E30]/10 bg-[#FFFDF8] text-[#765F55] transition hover:border-[#A34D45]/25 hover:bg-[#FFF0EE] hover:text-[#A34D45] focus:outline-none focus:ring-2 focus:ring-[#A34D45]/30" aria-label="Close payment receipt"><X size={22} /></button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto bg-[#EFE8DC] p-3 sm:p-6">
            {loadingProof ? <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center text-[#765F55]"><Loader2 className="h-7 w-7 animate-spin text-[#C97112]" /><div><p className="font-semibold">Loading secure receipt…</p><p className="mt-1 text-sm">The image is retrieved only after you open it.</p></div></div> : null}
            {!loadingProof && proofError ? <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 text-center"><div><p className="font-bold text-[#A34D45]">Unable to load this receipt</p><p className="mt-1 max-w-md text-sm text-[#765F55]">{proofError}</p></div><button type="button" onClick={loadProof} className="inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A]"><RotateCcw size={16} />Retry</button></div> : null}
            {!loadingProof && !proofError && proofUrl ? <div className="flex min-h-full items-center justify-center"><img src={proofUrl} alt={`Payment receipt submitted by ${payment.userName}`} style={{ width: 'min(100%, 620px)', height: 'auto', maxHeight: '62dvh', objectFit: 'contain' }} className="block rounded-lg bg-white shadow-[0_12px_30px_-20px_rgba(45,46,48,.55)]" /></div> : null}
          </div>
        </section>
      </div>
    </div> : null}
  </>
}

export default PaymentCard
