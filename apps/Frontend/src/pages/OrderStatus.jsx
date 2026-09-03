import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, CircleCheck, Clock3, ReceiptText, XCircle } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'
import { fetchMyPayments } from '../services/paymentService'

const orderSteps = ['Payment', 'Receipt uploaded', 'Verification']

function OrderStatus() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPayment() {
      try {
        setLoading(true)
        setError('')
        const payments = await fetchMyPayments()
        const matchedPayment = payments.find((item) => item.id === orderId)
        if (!matchedPayment) throw new Error('Order not found')
        setPayment(matchedPayment)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }
    loadPayment()
  }, [orderId])

  if (loading) {
    return <div className="min-h-screen bg-[#FFFDF8]"><Navbar /><div className="flex h-screen items-center justify-center bg-[#FFF9EA]"><LoadingSpinner message="Loading order..." /></div></div>
  }

  if (!payment || !payment.course) {
    return <div className="min-h-screen bg-[#FFFDF8]"><Navbar /><div className="flex h-screen items-center justify-center bg-[#FFF9EA] px-4 text-center"><p className="text-lg text-[#765F55] sm:text-2xl">{error || 'Order not found'}</p></div></div>
  }

  const course = payment.course
  const isApproved = payment.status === 'approved'
  const isRejected = payment.status === 'rejected'
  const status = isApproved
    ? { eyebrow: 'Verified payment', title: 'Enrollment confirmed', description: 'Your payment has been verified and your course is ready to explore.', Icon: CircleCheck, iconClasses: 'bg-[#E9F4EA] text-[#4D7C57]', buttonLabel: 'Start learning', onClick: () => navigate(`/course-lessons/${course.id}`), buttonClasses: 'bg-[#F8C56A] text-[#2D2E30] hover:bg-[#E58C1A]' }
    : isRejected
      ? { eyebrow: 'Action needed', title: 'Payment needs attention', description: payment.rejectReason || 'We could not verify this receipt. Please upload a new one to continue.', Icon: XCircle, iconClasses: 'bg-[#FFF0EE] text-[#A34D45]', buttonLabel: 'Resubmit receipt', onClick: () => navigate(`/payment/${course.id}`), buttonClasses: 'bg-[#2D2E30] text-white hover:bg-[#E58C1A]' }
      : { eyebrow: 'Verification in progress', title: 'Payment under review', description: 'Your receipt was submitted successfully. Our team is reviewing it now.', Icon: Clock3, iconClasses: 'bg-[#FFF4D8] text-[#C97112]', buttonLabel: 'Back to orders', onClick: () => navigate('/my-course-order'), buttonClasses: 'bg-[#2D2E30] text-white hover:bg-[#E58C1A]' }
  const StatusIcon = status.Icon

  const stepState = (index) => {
    if (index < 2) return 'complete'
    if (isApproved) return 'complete'
    if (isRejected) return 'rejected'
    return 'active'
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF8]">
      <Navbar />

      <div className="bg-[#FFF9EA] px-4 pt-6 sm:px-6 sm:pt-8 md:px-10">
        <div className="mx-auto max-w-7xl"><button onClick={() => navigate('/my-course-order')} className="inline-flex items-center gap-2 text-sm font-bold text-[#765F55] transition hover:text-[#C97112]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to orders</button></div>
      </div>

      <main className="flex-1 bg-[#FFF9EA] px-4 pb-14 pt-8 sm:px-6 sm:pb-16 md:px-10 md:pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10 md:mb-12"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Order status</p><h1 className="mt-3 text-[clamp(1.85rem,5vw,3rem)] font-bold leading-[1.1] tracking-tight text-[#2D2E30]">Follow your <span className="font-serif font-normal italic text-[#B96128]">enrollment.</span></h1><p className="mt-4 text-sm leading-relaxed text-[#765F55] sm:text-base">We’ll keep this page updated as your payment moves through verification.</p></div>

          <div className="grid grid-cols-1 items-start gap-6 md:gap-8 lg:grid-cols-5">
            <aside className="lg:col-span-2"><div className="overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-4 shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] sm:p-6 lg:sticky lg:top-20">
              <div className="h-48 overflow-hidden rounded-[1.3rem] bg-[#E7DCCE] sm:h-56 md:h-64">{course.image ? <img src={course.image} alt={course.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-[#765F55]">No image</div>}</div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#C97112]">Your course</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30]">{course.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#765F55]">{course.description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-[#2D2E30]/10 pt-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#765F55]">Amount paid</p><p className="mt-1 text-xl font-bold text-[#B96128]">{course.price}</p></div><div className="flex items-center gap-2 text-xs font-semibold text-[#765F55]"><CalendarDays className="h-4 w-4 text-[#C97112]" aria-hidden="true" />{new Date(payment.createdAt).toLocaleDateString()}</div></div>
            </div></aside>

            <section className="overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-white shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] lg:col-span-3">
              <div className="bg-[#2D2E30] px-5 py-6 sm:px-7 sm:py-8 md:px-8"><div className="flex items-start gap-4"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${status.iconClasses}`}><StatusIcon className="h-6 w-6" aria-hidden="true" /></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F8C56A]">{status.eyebrow}</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{status.title}</h2>{!isRejected ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">{status.description}</p> : null}</div></div></div>

              <div className="p-5 sm:p-7 md:p-8">
                <div className="rounded-2xl border border-[#2D2E30]/10 bg-[#FFF9EA] p-2"><div className="grid grid-cols-3 gap-2">{orderSteps.map((step, index) => {
                  const state = stepState(index)
                  const stateClasses = state === 'complete' ? 'bg-[#FFF1CE] text-[#9A5816]' : state === 'rejected' ? 'bg-[#FFF0EE] text-[#A34D45]' : state === 'active' ? 'bg-[#2D2E30] text-white shadow-[0_8px_18px_-10px_rgba(45,46,48,0.8)]' : 'bg-white text-[#9A8775]'
                  return <div key={step} className={`rounded-xl px-2 py-3 text-center sm:px-3 ${stateClasses}`}><div className={`mx-auto mb-2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${state === 'complete' ? 'bg-[#E58C1A] text-white' : state === 'rejected' ? 'bg-[#A34D45] text-white' : state === 'active' ? 'bg-[#F8C56A] text-[#2D2E30]' : 'bg-[#F1E8DC] text-[#9A8775]'}`}>{state === 'complete' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : state === 'rejected' ? '!' : index + 1}</div><p className="text-[10px] font-bold leading-tight sm:text-xs">{step}</p></div>
                })}</div></div>

                {isRejected ? (
                  <div className="mt-6 rounded-2xl border border-[#D78A86]/35 bg-[#FFF3F1] p-4 sm:p-5">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#8E4039]"><XCircle className="h-4 w-4" aria-hidden="true" />Reason from our team</div>
                    <p className="mt-2 text-sm leading-relaxed text-[#7D514C]">{payment.rejectReason || 'Please upload a clear payment receipt or contact support for assistance.'}</p>
                  </div>
                ) : null}

                <div className="mt-6 rounded-2xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:p-5"><div className="flex items-center gap-2 text-sm font-bold text-[#2D2E30]"><ReceiptText className="h-4 w-4 text-[#C97112]" aria-hidden="true" />Payment receipt</div><p className="mt-2 text-xs leading-relaxed text-[#765F55]">{isApproved ? 'Payment confirmed. You can begin learning now.' : isRejected ? 'Your receipt needs to be replaced before your enrollment can be approved.' : 'Your receipt is safely submitted and waiting for verification.'}</p></div>
                <button onClick={status.onClick} className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold transition sm:text-base ${status.buttonClasses}`}>{status.buttonLabel}</button>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default OrderStatus
