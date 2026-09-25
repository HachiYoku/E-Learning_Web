import { ArrowRight, CreditCard, Loader2, Maximize2, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchPaymentProofBlob, formatPaymentAmount } from '../services/paymentService'

function Detail({ label, children, full = false }) {
  return (
    <div className={`rounded-xl border border-[#2D2E30]/10 bg-[#FFFDF8] px-3.5 py-3 ${full ? 'sm:col-span-2' : ''}`}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9E887C]">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-[#2D2E30]" title={typeof children === 'string' ? children : undefined}>{children}</dd>
    </div>
  )
}

function SecureProofViewer({ payment, proofUrl, loading, error, onRetry, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#252527]/75 p-2 backdrop-blur-sm sm:p-5">
      <section className="flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#FFFDF8] shadow-2xl sm:h-[calc(100dvh-2.5rem)]">
        <header className="flex shrink-0 items-center justify-between border-b border-[#2D2E30]/10 bg-[#FFF9EA] px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C97112]">Private receipt</p>
            <h2 className="truncate text-base font-bold text-[#2D2E30] sm:text-lg">Payment proof — {payment.userName}</h2>
          </div>
          <button type="button" onClick={onClose} className="ml-4 rounded-lg p-2 text-[#765F55] transition hover:bg-white hover:text-[#2D2E30]" aria-label="Close receipt viewer">
            <X size={22} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-[#EFE9E0] p-3 sm:p-6">
          {loading ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-sm font-medium text-[#765F55]"><Loader2 className="animate-spin text-[#E58C1A]" size={28} /> Loading secure receipt…</div>
          ) : error ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-center"><p className="max-w-sm text-sm font-medium text-[#A34D45]">{error}</p><button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A]"><RotateCcw size={16} /> Try again</button></div>
          ) : proofUrl ? (
            <div className="flex min-h-full items-center justify-center">
              <img src={proofUrl} alt={`Payment receipt submitted by ${payment.userName}`} className="block rounded-lg bg-white shadow-xl" style={{ width: 'min(100%, 620px)', height: 'auto', maxHeight: '62dvh', objectFit: 'contain' }} />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default function PaymentCard({ payment, onApprove, onDeny, status = 'review' }) {
  const [reviewOpen, setReviewOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [proofUrl, setProofUrl] = useState('')
  const [proofError, setProofError] = useState('')
  const [loadingProof, setLoadingProof] = useState(false)
  const isApproved = status === 'approved'
  const isDenied = status === 'denied'
  const statusLabel = isApproved ? 'Approved' : isDenied ? 'Denied' : 'Awaiting review'
  const statusClass = isApproved ? 'bg-[#EDF8EE] text-[#246B35]' : isDenied ? 'bg-[#FFF0EE] text-[#A34D45]' : 'bg-[#FFF1CE] text-[#A86710]'

  useEffect(() => () => { if (proofUrl) URL.revokeObjectURL(proofUrl) }, [proofUrl])

  const loadProof = async () => {
    if (!payment.hasPaymentProof) {
      setProofError('No secure payment proof is available for this payment.')
      return
    }
    if (proofUrl) URL.revokeObjectURL(proofUrl)
    setProofUrl('')
    setProofError('')
    setLoadingProof(true)
    try {
      setProofUrl(await fetchPaymentProofBlob(payment.id))
    } catch (error) {
      setProofError(error?.message || 'Payment proof is temporarily unavailable.')
    } finally {
      setLoadingProof(false)
    }
  }

  const openViewer = () => {
    setViewerOpen(true)
    loadProof()
  }

  const closeViewer = () => {
    setViewerOpen(false)
    if (proofUrl) URL.revokeObjectURL(proofUrl)
    setProofUrl('')
    setProofError('')
  }

  const closeReview = () => setReviewOpen(false)

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_14px_30px_-24px_rgba(45,46,48,0.45)]">
        <div className="flex items-center justify-between border-b border-[#2D2E30]/10 px-5 py-4">
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${statusClass}`}>{statusLabel}</span>
          <span className="text-xs text-[#9E887C]">{payment.date}</span>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3"><img src={payment.userAvatar} alt="" className="h-10 w-10 rounded-full object-cover" /><div className="min-w-0"><p className="truncate font-bold text-[#2D2E30]">{payment.userName}</p><p className="truncate text-xs text-[#765F55]">{payment.userEmail}</p></div></div>
          <div className="mt-5 rounded-xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#C97112]">Course order</p><p className="mt-2 font-bold text-[#2D2E30]">{payment.courseName}</p><div className="mt-3 flex items-end justify-between border-t border-[#2D2E30]/10 pt-3"><span className="text-xs font-semibold uppercase tracking-wide text-[#765F55]">Amount due</span><strong className="text-lg text-[#D97910]">{payment.amount}</strong></div></div>
          {isDenied && payment.denialReason ? <p className="mt-4 rounded-xl bg-[#FFF0EE] px-3 py-2 text-xs text-[#A34D45]">{payment.denialReason}</p> : null}
          {status === 'review' ? <button type="button" onClick={() => setReviewOpen(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A]">Review payment <ArrowRight size={17} /></button> : null}
        </div>
      </article>

      {reviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252527]/60 p-3 backdrop-blur-sm sm:p-6">
          <section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl overflow-auto rounded-2xl border border-[#2D2E30]/10 bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
            <header className="flex items-start justify-between border-b border-[#E58C1A]/20 bg-[#FFF9EA] px-5 py-4 sm:px-7 sm:py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112]">Finance operations</p><h2 className="mt-1 text-xl font-bold text-[#2D2E30] sm:text-2xl">Review payment</h2><p className="mt-1 text-sm text-[#765F55]">Submitted by {payment.userName}</p></div><button type="button" onClick={closeReview} className="rounded-lg p-2 text-[#765F55] transition hover:bg-white hover:text-[#2D2E30]" aria-label="Close payment review"><X size={23} /></button></header>

            <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2">
              <button type="button" onClick={openViewer} className="group flex min-h-52 flex-col items-center justify-center rounded-2xl border border-[#E58C1A]/45 bg-[#F5F0E9] p-5 text-center transition hover:border-[#E58C1A] hover:bg-[#FFF9EA] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15">
                <span className="mb-3 rounded-xl bg-white p-3 text-[#D97910] shadow-sm"><ShieldCheck size={24} /></span><strong className="text-base text-[#765F55]">View secure payment receipt</strong><span className="mt-1 text-sm text-[#9E887C]">Open private viewer</span><span className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#C97112]">View receipt <Maximize2 size={15} /></span>
              </button>

              <div className="rounded-2xl border border-[#2D2E30]/10 bg-white p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C97112]">Payment summary</p><h3 className="mt-1 text-lg font-bold text-[#2D2E30]">{payment.courseName}</h3></div><span className="shrink-0 rounded-full bg-[#FFF1CE] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#A86710]">Awaiting review</span></div>
                <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><Detail label="Learner">{payment.userName}</Detail><Detail label="Email">{payment.userEmail || '—'}</Detail><Detail label="Course" full>{payment.courseName}</Detail><Detail label="Payment method">{payment.paymentMethod}{payment.paymentMethodType ? ` · ${payment.paymentMethodType}` : ''}</Detail><Detail label="Submitted">{payment.date || '—'}</Detail><Detail label="Promo code">{payment.promoCode ? <span className="font-bold text-[#C97112]">{payment.promoCode}</span> : <span className="font-medium text-[#9E887C]">No promo code applied</span>}</Detail></dl>
                <div className="mt-4 flex items-end justify-between rounded-xl bg-[#2D2E30] px-4 py-3 text-white"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Amount due</p><p className="mt-1 text-sm text-white/75">Original price {formatPaymentAmount(payment.originalAmountValue, payment.currency)}</p></div><strong className="text-xl text-[#FFD37F]">{payment.amount}</strong></div>
              </div>
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-[#2D2E30]/10 bg-[#FFFDF8] px-5 py-4 sm:flex-row sm:justify-end sm:px-7"><button type="button" onClick={() => { closeReview(); onDeny(payment.id) }} className="rounded-xl border border-[#E0B7B1] bg-white px-5 py-3 text-sm font-bold text-[#B4574C] transition hover:bg-[#FFF0EE]">Deny payment</button><button type="button" onClick={() => { closeReview(); onApprove(payment.id) }} className="rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A]">Approve payment</button></footer>
          </section>
        </div>
      ) : null}

      {viewerOpen ? <SecureProofViewer payment={payment} proofUrl={proofUrl} loading={loadingProof} error={proofError} onRetry={loadProof} onClose={closeViewer} /> : null}
    </>
  )
}
