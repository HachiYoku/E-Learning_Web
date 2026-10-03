import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, Clock3, FileSearch, Hourglass, ReceiptText, Send, XCircle } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'
import { emailPaymentReceipt, fetchMyPayments } from '../services/paymentService'

function MyCourseOrder() {
  const navigate = useNavigate()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [receiptPayment, setReceiptPayment] = useState(null)
  const [receiptState, setReceiptState] = useState('')
  const [receiptMessage, setReceiptMessage] = useState('')

  const receiptErrorMessage = (sendError) => ({
    receipt_limit_reached: 'Receipt email limit reached. Contact support if you need another copy.',
    receipt_processing: 'A receipt request is already being processed. Please try again shortly.',
    receipt_temporarily_unavailable: 'Receipt is temporarily unavailable. Please try again or contact support.',
    receipt_uncertain: 'Receipt delivery is temporarily being confirmed. Please contact support before trying again.',
  }[sendError?.code] || sendError?.message || 'Receipt is temporarily unavailable. Please contact support if you need help.')

  const sendReceipt = async () => {
    if (!receiptPayment) return
    setReceiptState('sending')
    setReceiptMessage('')
    try {
      await emailPaymentReceipt(receiptPayment.id)
      setReceiptState('success')
      setReceiptMessage('')
    } catch (sendError) {
      setReceiptState(sendError?.code === 'receipt_limit_reached' ? 'limit' : sendError?.code === 'receipt_uncertain' ? 'uncertain' : 'failure')
      setReceiptMessage(receiptErrorMessage(sendError))
    }
  }

  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true)
        setError('')
        setPayments(await fetchMyPayments())
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }
    loadPayments()
  }, [])

  const getStatusDetails = (payment) => {
    const derived = payment.coursePaymentState
    if (payment.status === 'rejected' && derived?.kind === 'enrolled') return { label: 'Issue resolved', detail: 'Your updated payment was approved.', Icon: CircleCheck, classes: 'border-[#7EAF85]/30 bg-[#F1F8F1] text-[#4D7C57]', action: 'start' }
    if (payment.status === 'rejected' && derived?.kind === 'newer_pending') return { label: 'New payment submitted', detail: 'Your updated payment is waiting for review.', Icon: Clock3, classes: 'border-[#E7B85E]/30 bg-[#FFF8E8] text-[#A66B12]', action: 'current', currentPaymentId: derived.currentPaymentId }
    if (payment.status === 'rejected' && derived?.kind === 'newer_rejected') return { label: 'Newer payment needs attention', detail: 'Review your latest payment attempt.', Icon: XCircle, classes: 'border-[#D78A86]/30 bg-[#FFF3F1] text-[#A34D45]', action: 'current', currentPaymentId: derived.currentPaymentId }
    if (payment.status === 'approved') return { label: 'Approved', detail: 'Your course access is ready.', Icon: CircleCheck, classes: 'border-[#7EAF85]/30 bg-[#F1F8F1] text-[#4D7C57]', action: 'start' }
    if (payment.status === 'rejected') return { label: 'Needs attention', detail: 'Please review the payment details.', Icon: XCircle, classes: 'border-[#D78A86]/30 bg-[#FFF3F1] text-[#A34D45]', action: 'details' }
    return { label: 'Under review', detail: 'We are checking your receipt.', Icon: Clock3, classes: 'border-[#E7B85E]/30 bg-[#FFF8E8] text-[#A66B12]' }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF8]">
      <Navbar />

      <div className="hidden bg-[#FFF9EA] px-4 pb-12 pt-10 sm:px-6 sm:pb-14 sm:pt-12 md:block md:px-10 md:pb-16 md:pt-14">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Payment centre</p>
          <h1 className="mt-3 text-[clamp(2rem,6vw,3.3rem)] font-bold leading-[1.08] tracking-tight text-[#2D2E30]">Your course <span className="text-[#B96128]">orders.</span></h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#765F55] sm:text-base">Keep track of each payment and see when your course access is ready.</p>
        </div>
      </div>

      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-12 md:px-10 md:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:mb-8 sm:flex-row sm:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Order history</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl">Payments &amp; enrollments</h2></div>
            {!loading && !error ? <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#E58C1A]/20 bg-[#FFF4D8] px-3 py-2 text-xs font-bold text-[#9A5816]"><ReceiptText className="h-4 w-4" aria-hidden="true" />{payments.length} {payments.length === 1 ? 'order' : 'orders'}</div> : null}
          </div>

          {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          {loading ? <LoadingSpinner message="Loading payments..." /> : payments.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-[#D9CEBE] bg-[#FFF9EA] px-5 py-12 text-center sm:px-8 sm:py-16">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#C97112] shadow-sm"><ReceiptText className="h-6 w-6" aria-hidden="true" /></div>
              <h3 className="text-lg font-bold text-[#2D2E30]">No course orders yet</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#765F55]">You have not submitted any course payments yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
              {payments.map((payment) => {
                const course = payment.course
                const status = payment.courseUnavailable
                  ? { label: 'Course unavailable', detail: 'This course has been removed from the catalogue.', Icon: XCircle, classes: 'border-[#D78A86]/30 bg-[#FFF3F1] text-[#A34D45]' }
                  : getStatusDetails(payment)
                const StatusIcon = status.Icon

                return (
                  <article key={payment.id} className="group overflow-hidden rounded-[1.5rem] border border-[#2D2E30]/10 bg-white shadow-[0_18px_45px_-32px_rgba(80,48,19,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_55px_-32px_rgba(80,48,19,0.45)]">
                    <div className="relative h-40 overflow-hidden bg-[#E7DCCE] sm:h-44">
                      {course?.image ? <img src={course.image} alt={course.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-sm font-semibold text-[#765F55]">No image</div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#2D2E30]/50 via-transparent to-transparent" aria-hidden="true" />
                      <div className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] shadow-sm backdrop-blur-sm ${status.classes}`}><StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />{status.label}</div>
                    </div>

                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C97112]">Course order</p><h3 className="mt-1 truncate text-xl font-bold leading-tight tracking-tight text-[#2D2E30]">{course?.title}</h3></div>
                        <span className="shrink-0 text-lg font-bold text-[#B96128]">{course?.price}</span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[#765F55]">{course?.description}</p>
                      <p className="mt-2 text-xs text-[#765F55]">{payment.paymentMethod ? `${payment.paymentMethod.name} · ${payment.paymentMethod.type}` : 'Legacy payment method details unavailable'}</p>
                      {payment.paymentReference ? <p className="mt-2 text-xs text-[#765F55]"><span className="font-semibold text-[#2D2E30]">Payment Reference:</span> {payment.paymentReference}</p> : null}
                      {payment.status === 'approved' && payment.paymentReference ? <div className="mt-3"><button type="button" onClick={() => { setReceiptPayment(payment); setReceiptState('confirm'); setReceiptMessage('') }} className="rounded-lg border border-[#2D2E30]/15 bg-white px-3 py-2 text-xs font-bold text-[#2D2E30] transition hover:border-[#E58C1A] hover:bg-[#FFF4D8]">Email receipt</button></div> : null}

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#2D2E30]/10 pt-3">
                        <p className="min-w-0 text-xs text-[#765F55]"><span className="font-bold text-[#2D2E30]">{status.detail}</span><span className="hidden sm:inline"> · Submitted {new Date(payment.createdAt).toLocaleDateString()}</span></p>
                        <span className="shrink-0 text-xs font-semibold text-[#765F55] sm:hidden">{new Date(payment.createdAt).toLocaleDateString()}</span>
                      </div>

                      <button
                        onClick={() => navigate(payment.courseUnavailable ? '/app/support' : status.action === 'start' ? `/app/learn/${course.id}` : status.action === 'current' ? `/app/orders/${status.currentPaymentId}` : `/app/orders/${payment.id}`)}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-[#FFF9EA] px-4 py-3 text-sm font-bold text-[#2D2E30] transition-colors hover:border-[#E58C1A] hover:bg-[#FFF4D8]"
                      >
                        {payment.courseUnavailable ? <FileSearch className="h-4 w-4 text-[#A34D45]" aria-hidden="true" /> : status.action === 'start' ? <CircleCheck className="h-4 w-4 text-[#4D7C57]" aria-hidden="true" /> : <FileSearch className="h-4 w-4 text-[#C97112]" aria-hidden="true" />}
                        {payment.courseUnavailable ? 'Contact support' : status.action === 'start' ? 'Start learning' : status.action === 'current' ? 'View latest payment' : 'View order details'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {receiptPayment ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/60 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title" className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-[#E58C1A]/20 bg-[#FFFDF8] shadow-[0_28px_80px_-24px_rgba(45,46,48,0.55)]"><div className="border-b border-[#E58C1A]/15 bg-[#FFF4D8] px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112]">Payment receipt</p><h2 id="receipt-dialog-title" className="mt-1 text-xl font-bold tracking-tight text-[#2D2E30]">{receiptState === 'sending' ? 'Sending your receipt…' : receiptState === 'success' ? 'Receipt sent' : receiptState === 'limit' ? 'Receipt email limit reached' : receiptState === 'uncertain' ? 'Receipt delivery being confirmed' : receiptState === 'failure' ? 'Receipt temporarily unavailable' : 'Email payment receipt?'}</h2></div><div className="px-6 py-6">{receiptState === 'sending' ? <div className="flex flex-col items-center py-3 text-center"><div className="mb-4 rounded-2xl bg-[#FFF4D8] p-4 text-[#C97112]"><Hourglass className="h-8 w-8 animate-[spin_1.6s_ease-in-out_infinite] motion-reduce:animate-none" aria-hidden="true" /></div><p className="text-sm leading-6 text-[#765F55]">We’re generating your payment receipt and sending it to your registered email.</p></div> : receiptState === 'success' ? <div className="text-center"><CircleCheck className="mx-auto mb-4 h-10 w-10 text-[#4D7C57]" aria-hidden="true" /><p className="text-sm leading-6 text-[#765F55]">Your payment receipt has been sent to your registered email address.</p></div> : receiptState === 'limit' || receiptState === 'uncertain' ? <div className="text-center"><ReceiptText className="mx-auto mb-4 h-10 w-10 text-[#C97112]" aria-hidden="true" /><p className="text-sm leading-6 text-[#765F55]">{receiptMessage}</p></div> : <p className="text-sm leading-6 text-[#765F55]">{receiptState === 'failure' ? receiptMessage : 'We’ll generate your payment receipt and send it to your registered email address. A limited number of copies are available through self-service; contact support if you need more.'}</p>}<div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{receiptState === 'confirm' ? <><button type="button" onClick={() => setReceiptPayment(null)} className="rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30]">Cancel</button><button type="button" onClick={sendReceipt} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A]"><Send className="h-4 w-4" aria-hidden="true" />Send receipt</button></> : null}{receiptState === 'success' ? <button type="button" onClick={() => setReceiptPayment(null)} className="rounded-xl bg-[#2D2E30] px-5 py-2.5 text-sm font-bold text-white">Close</button> : null}{receiptState === 'limit' || receiptState === 'uncertain' ? <><button type="button" onClick={() => setReceiptPayment(null)} className="rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30]">Close</button><button type="button" onClick={() => navigate('/app/support')} className="rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white">Contact support</button></> : null}{receiptState === 'failure' ? <><button type="button" onClick={() => setReceiptPayment(null)} className="rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30]">Close</button><button type="button" onClick={() => { setReceiptState('confirm'); setReceiptMessage('') }} className="rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white">Try again</button></> : null}</div></div></section></div> : null}
      <Footer />
    </div>
  )
}

export default MyCourseOrder
