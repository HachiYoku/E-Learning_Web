import { useEffect, useRef, useState } from 'react'
import { Maximize2, Volume2, X } from 'lucide-react'

let activeAudio = null

function QuestionAudio({ src, label }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio && !audio.paused) audio.pause()
      if (activeAudio === audio) activeAudio = null
    }
  }, [src])
  const replay = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (activeAudio && activeAudio !== audio) {
      activeAudio.pause()
      activeAudio.currentTime = 0
    }
    audio.currentTime = 0
    activeAudio = audio
    try { await audio.play(); setFailed(false) } catch { setFailed(true); setPlaying(false) }
  }
  return <div className="mt-5 text-center"><audio ref={audioRef} src={src} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setFailed(true)} />
    <button type="button" onClick={replay} aria-label={label ? `Play question audio: ${label}` : 'Play question audio'} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] ${playing ? 'border-[#E58C1A] bg-[#E58C1A] text-white' : 'border-[#E58C1A]/25 bg-[#FFF1D0] text-[#C97112] hover:bg-[#F8C56A]'}`}><Volume2 className="h-5 w-5" aria-hidden="true" />Tap to listen</button>
    {failed ? <p role="status" className="mt-2 text-sm text-[#A84646]">Audio could not be played. Try again.</p> : null}
  </div>
}

export default function GeneralPracticeQuestionMedia({ question, index }) {
  const [largeImage, setLargeImage] = useState(false)
  const origin = useRef(null)
  const close = () => { setLargeImage(false); requestAnimationFrame(() => origin.current?.focus()) }
  useEffect(() => {
    if (!largeImage) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') { event.preventDefault(); close() } }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [largeImage])
  const alt = question.imageDecorative ? '' : question.imageAlt || 'Question illustration'

  return <>
    {question.image ? <div className="mx-auto mt-7 max-w-xl rounded-[1.5rem] bg-[#FFF9EA] p-2 shadow-inner sm:p-3"><button ref={origin} type="button" onClick={() => setLargeImage(true)} aria-label={`View question ${index + 1} image larger`} className="group relative block w-full cursor-zoom-in rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><img src={question.image} alt={alt} className="mx-auto aspect-video w-full rounded-2xl object-contain shadow-md sm:h-80" /><span aria-hidden="true" className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-[#2D2E30]/85 px-3 py-1.5 text-xs font-semibold text-white"><Maximize2 size={14} />View larger</span></button></div> : null}
    {question.audio ? <QuestionAudio key={question.audio} src={question.audio} label={question.audioLabel} /> : null}
    {largeImage && question.image ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#252527]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Enlarged question image" onClick={close}><section className="relative w-full max-w-2xl rounded-2xl bg-[#FFFDF8] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}><button type="button" autoFocus className="absolute right-3 top-3 rounded-lg bg-white p-2 text-[#765F55] shadow-sm hover:bg-[#FFF4D8]" aria-label="Close" onClick={close}><X size={20} /></button><p className="mb-3 text-sm font-bold text-[#2D2E30]">Question image</p><img src={question.image} alt={alt} className="max-h-[75dvh] w-full rounded-xl object-contain" /></section></div> : null}
  </>
}
