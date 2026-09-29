import { ArrowLeft, BookOpen, CheckCircle2, CircleDollarSign, ImagePlus, Plus, Star, Trash2, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { createCourse } from '../../services/courseService'
import { validateFileSize } from '../../utils/fileValidation'

function AddCourse() {
  const navigate = useNavigate()
  const titleRef = useRef(null)
  const initialFormRef = useRef('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    discountPrice: '',
    thbEnabled: true,
    mmkPrice: '',
    mmkOriginalPrice: '',
    mmkEnabled: false,
    rating: 4,
    learnings: [''],
    image: '',
    imageFile: null,
    paymentQr: '',
    paymentQrFile: null,
    isPublished: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)

  const getFormSnapshot = ({ imageFile, paymentQrFile, ...values }) =>
    JSON.stringify({ ...values, hasImageFile: Boolean(imageFile), hasPaymentQrFile: Boolean(paymentQrFile) })

  if (!initialFormRef.current) {
    initialFormRef.current = getFormSnapshot(formData)
  }

  useEffect(() => {
    const titleField = titleRef.current
    if (!titleField) return

    titleField.style.height = 'auto'
    titleField.style.height = `${Math.min(titleField.scrollHeight, 144)}px`
  }, [formData.title])

  const hasUnsavedChanges = getFormSnapshot(formData) !== initialFormRef.current

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const setCurrencyEnabled = (currency, enabled) => {
    setFormData((prev) => currency === 'THB'
      ? { ...prev, thbEnabled: enabled, ...(enabled ? {} : { price: '', discountPrice: '' }) }
      : { ...prev, mmkEnabled: enabled, ...(enabled ? {} : { mmkPrice: '', mmkOriginalPrice: '' }) })
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) {
      return
    }

    const sizeError = validateFileSize(file, 'Course image')
    if (sizeError) {
      setError(sizeError)
      e.target.value = ''
      return
    }

    const previewUrl = URL.createObjectURL(file)

    setFormData((prev) => ({
      ...prev,
      image: previewUrl,
      imageFile: file
    }))
    setError('')
  }

  const handleLearningChange = (index, value) => {
    const newLearnings = [...formData.learnings]
    newLearnings[index] = value
    setFormData((prev) => ({
      ...prev,
      learnings: newLearnings
    }))
  }

  const handlePaymentQrUpload = (e) => {
    const file = e.target.files[0]
    if (!file) {
      return
    }

    const sizeError = validateFileSize(file, 'Payment QR')
    if (sizeError) {
      setError(sizeError)
      e.target.value = ''
      return
    }

    const previewUrl = URL.createObjectURL(file)

    setFormData((prev) => ({
      ...prev,
      paymentQr: previewUrl,
      paymentQrFile: file
    }))
    setError('')
  }

  const addLearning = () => {
    setFormData((prev) => ({
      ...prev,
      learnings: [...prev.learnings, '']
    }))
  }

  const removeLearning = (index) => {
    setFormData((prev) => ({
      ...prev,
      learnings: prev.learnings.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title || !formData.imageFile) {
      setError('Please fill in all required fields: title and image.')
      return
    }

    try {
      setLoading(true)
      setError('')

      const prices = {}
      const addPrice = (currency, sellingValue, originalValue) => {
        if (sellingValue === '' && originalValue === '') return true
        const price = Number(sellingValue)
        const originalPrice = originalValue === '' ? price : Number(originalValue)
        if (!Number.isFinite(price) || !Number.isFinite(originalPrice) || price < 0 || originalPrice < price) return false
        prices[currency] = { price, originalPrice }
        return true
      }
      if (!addPrice('THB', formData.discountPrice === '' ? formData.price : formData.discountPrice, formData.price)
        || !addPrice('MMK', formData.mmkPrice, formData.mmkOriginalPrice)) {
        setError('Each available currency needs a non-negative price and an original price at least as high as its price.')
        return
      }
      if (!Object.keys(prices).length && formData.isPublished) {
        setError('A published course must have at least one available currency price.')
        return
      }
      const thb = prices.THB
      await createCourse({
        ...formData,
        ...(thb ? { price: thb.price, originalPrice: thb.originalPrice } : {}),
        prices,
      })

      initialFormRef.current = getFormSnapshot(formData)
      navigate('/courses')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setIsDiscardDialogOpen(true)
      return
    }

    navigate('/courses')
  }

  return (
    <div className="min-h-screen bg-[#FFF9EA] pb-10">
      <header className="border-b border-[#2D2E30]/10 bg-[#FFFDF8] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <button onClick={handleBackClick} className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1CE] hover:text-[#2D2E30]"><ArrowLeft size={18} />Back to courses</button>
          <button type="submit" form="create-course-form" disabled={loading} className="inline-flex items-center justify-center rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2D2E30]/15 transition hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-60 sm:px-6">{loading ? 'Creating…' : 'Create course'}</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8 max-w-2xl"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C97112]">Learning catalogue</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">Build a course students want to start.</h1><p className="mt-3 text-sm leading-6 text-[#765F55] sm:text-base">Set the story, cover, learning outcomes and independent currency pricing in one focused workspace.</p></div>

        <form id="create-course-form" onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="order-2 space-y-6 xl:order-1">
            {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

            <section className="overflow-hidden rounded-3xl border border-[#2D2E30]/10 bg-white shadow-[0_18px_44px_-32px_rgba(45,46,48,0.5)]"><div className="border-b border-[#2D2E30]/10 px-5 py-5 sm:px-7"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1CE] text-[#C97112]"><BookOpen size={20} /></span><div><h2 className="font-bold text-[#2D2E30]">Course essentials</h2><p className="mt-0.5 text-sm text-[#765F55]">The information learners see first.</p></div></div></div><div className="space-y-5 p-5 sm:p-7"><label className="block text-sm font-bold text-[#2D2E30]">Course title <span className="text-[#C97112]">*</span><textarea ref={titleRef} name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g. English for everyday conversations" rows={1} className="mt-2 min-h-[3rem] max-h-36 w-full resize-none overflow-y-auto rounded-xl border border-[#2D2E30]/15 px-4 py-3 text-base font-semibold text-[#2D2E30] outline-none transition placeholder:font-normal placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" /></label><label className="block text-sm font-bold text-[#2D2E30]">Course description <span className="font-normal text-[#9E887C]">(optional)</span><textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Explain the transformation, format and who this course is for." rows="6" className="mt-2 w-full resize-y rounded-xl border border-[#2D2E30]/15 px-4 py-3 text-sm leading-6 text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" /></label></div></section>

            <section className="rounded-3xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_18px_44px_-32px_rgba(45,46,48,0.5)] sm:p-7"><div className="mb-6 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1CE] text-[#C97112]"><CircleDollarSign size={20} /></span><div><h2 className="font-bold text-[#2D2E30]">Pricing & availability</h2><p className="mt-0.5 text-sm leading-5 text-[#765F55]">Enable each currency independently. A blank currency stays unavailable; zero is a valid price.</p></div></div><div className="grid gap-4 lg:grid-cols-2">
              <div className={`rounded-2xl border p-4 transition ${formData.thbEnabled ? 'border-[#E58C1A]/40 bg-[#FFFDF8]' : 'border-[#2D2E30]/10 bg-[#FAF8F5]'}`}><div className="mb-5 flex items-center justify-between gap-3"><div><span className="rounded-lg bg-[#FFF1CE] px-2 py-1 text-xs font-bold text-[#9A5816]">THB</span><p className="mt-2 text-sm font-bold text-[#2D2E30]">Thai baht</p></div><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#765F55]"><input type="checkbox" checked={formData.thbEnabled} onChange={(e) => setCurrencyEnabled('THB', e.target.checked)} className="h-4 w-4 accent-[#E58C1A]" />Available</label></div><div className="space-y-3"><label className="block text-xs font-bold text-[#765F55]">Original price<div className="relative mt-1.5"><input disabled={!formData.thbEnabled} type="number" name="price" value={formData.price} onChange={handleInputChange} placeholder="4,500" min="0" className="w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition placeholder:text-[#9B867C] disabled:cursor-not-allowed disabled:bg-[#F3E9D9] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" /><span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-[#C97112]">฿</span></div></label><label className="block text-xs font-bold text-[#765F55]">Selling price <span className="font-normal">(optional)</span><div className="relative mt-1.5"><input disabled={!formData.thbEnabled} type="number" name="discountPrice" value={formData.discountPrice} onChange={handleInputChange} placeholder="Same as original" min="0" className="w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition placeholder:text-[#9B867C] disabled:cursor-not-allowed disabled:bg-[#F3E9D9] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" /><span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-[#C97112]">฿</span></div></label></div></div>
              <div className={`rounded-2xl border p-4 transition ${formData.mmkEnabled ? 'border-[#E58C1A]/40 bg-[#FFFDF8]' : 'border-[#2D2E30]/10 bg-[#FAF8F5]'}`}><div className="mb-5 flex items-center justify-between gap-3"><div><span className="rounded-lg bg-[#F3E9D9] px-2 py-1 text-xs font-bold text-[#765F55]">MMK</span><p className="mt-2 text-sm font-bold text-[#2D2E30]">Myanmar kyat</p></div><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#765F55]"><input type="checkbox" checked={formData.mmkEnabled} onChange={(e) => setCurrencyEnabled('MMK', e.target.checked)} className="h-4 w-4 accent-[#E58C1A]" />Available</label></div><div className="space-y-3"><label className="block text-xs font-bold text-[#765F55]">Original price <span className="font-normal">(optional)</span><input disabled={!formData.mmkEnabled} type="number" name="mmkOriginalPrice" value={formData.mmkOriginalPrice} onChange={handleInputChange} placeholder="Same as selling" min="0" className="mt-1.5 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-[#9B867C] disabled:cursor-not-allowed disabled:bg-[#F3E9D9] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" /></label><label className="block text-xs font-bold text-[#765F55]">Selling price<input disabled={!formData.mmkEnabled} type="number" name="mmkPrice" value={formData.mmkPrice} onChange={handleInputChange} placeholder="120,000" min="0" className="mt-1.5 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-[#9B867C] disabled:cursor-not-allowed disabled:bg-[#F3E9D9] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" /></label></div></div>
            </div><div className="mt-5 flex flex-col gap-4 rounded-2xl bg-[#FFF9EA] p-4 sm:flex-row sm:items-center sm:justify-between"><div><label className="text-sm font-bold text-[#2D2E30]">Course rating</label><p className="mt-1 text-xs text-[#765F55]">Shown on course catalogue cards.</p></div><div className="flex items-center gap-3"><input type="number" name="rating" value={formData.rating} onChange={handleInputChange} min="0" max="5" step="0.5" className="w-16 rounded-xl border border-[#2D2E30]/15 bg-white px-2 py-2.5 text-sm outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" /><div className="flex gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} size={18} className={i < Math.floor(formData.rating) ? 'fill-[#F8C56A] text-[#F8C56A]' : 'text-[#D8CFC3]'} />)}</div></div></div><label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#E58C1A]/20 bg-[#FFF1CE]/50 p-4 text-sm text-[#2D2E30]"><input type="checkbox" name="isPublished" checked={formData.isPublished} onChange={handleInputChange} className="mt-0.5 h-4 w-4 accent-[#E58C1A]" /><span><strong className="block">Publish this course</strong><span className="mt-0.5 block text-xs leading-5 text-[#765F55]">Students can discover and enroll after you create it.</span></span></label></section>

            <section className="rounded-3xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_18px_44px_-32px_rgba(45,46,48,0.5)] sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1CE] text-[#C97112]"><CheckCircle2 size={20} /></span><div><h2 className="font-bold text-[#2D2E30]">Learning outcomes</h2><p className="mt-0.5 text-sm text-[#765F55]">Add the skills or knowledge learners will gain.</p></div></div><div className="space-y-3">{formData.learnings.map((learning, index) => <div key={index} className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF1CE] text-xs font-bold text-[#C97112]">{index + 1}</span><input type="text" value={learning} onChange={(e) => handleLearningChange(index, e.target.value)} placeholder="What students will get from this course" className="min-w-0 flex-1 rounded-xl border border-[#2D2E30]/15 px-3 py-2.5 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" />{formData.learnings.length > 1 ? <button type="button" aria-label={`Remove learning outcome ${index + 1}`} onClick={() => removeLearning(index)} className="rounded-xl p-2.5 text-[#A34D45] transition hover:bg-[#FFF0EE]"><Trash2 size={18} /></button> : null}</div>)}<button type="button" onClick={addLearning} className="inline-flex items-center gap-2 rounded-xl border border-[#E58C1A]/30 px-3 py-2.5 text-sm font-bold text-[#C97112] transition hover:bg-[#FFF1CE]"><Plus size={17} />Add outcome</button></div></section>
          </div>

          <aside className="order-1 xl:order-2 xl:sticky xl:top-6"><section className="overflow-hidden rounded-3xl border border-[#2D2E30]/10 bg-white shadow-[0_18px_44px_-32px_rgba(45,46,48,0.5)]"><div className="p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1CE] text-[#C97112]"><ImagePlus size={20} /></span><div><h2 className="font-bold text-[#2D2E30]">Course cover</h2><p className="mt-0.5 text-sm text-[#765F55]">A clear landscape image works best.</p></div></div></div><label className="relative mx-5 mb-5 flex aspect-[16/10] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] transition hover:border-[#E58C1A] hover:bg-[#FFF1CE]"><input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 cursor-pointer opacity-0" />{formData.image ? <><img src={formData.image} alt="Course preview" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10 text-center text-sm font-bold text-white">Change image</span></> : <span className="flex flex-col items-center gap-2 text-center text-[#765F55]"><span className="rounded-xl bg-white p-3 text-[#C97112] shadow-sm"><Upload size={22} /></span><strong className="text-sm text-[#2D2E30]">Upload course image</strong><span className="text-xs">PNG, JPG or WEBP · up to 5 MB</span></span>}</label></section><div className="mt-4 rounded-2xl border border-[#2D2E30]/10 bg-[#2D2E30] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F8C56A]">Course status</p><p className="mt-2 text-lg font-bold">{formData.isPublished ? 'Ready for learners' : 'Saved as a draft'}</p><p className="mt-1 text-sm leading-5 text-white/65">{formData.isPublished ? 'The course will be visible after it is created.' : 'You can finish the details and publish later.'}</p></div></aside>
        </form>
      </main>

      {isDiscardDialogOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#2D2E30]">Discard unsaved changes?</h2>
            <p className="mt-2 text-sm text-[#765F55]">Your course draft has changes that have not been created. If you leave now, they will be lost.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsDiscardDialogOpen(false)} className="rounded-xl border border-[#2D2E30]/15 px-4 py-2 text-sm font-semibold text-[#2D2E30] hover:bg-[#FFF4D8]">Keep editing</button>
              <button type="button" onClick={() => navigate('/courses')} className="rounded-xl bg-[#A34D45] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8D4039]">Discard changes</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default AddCourse
