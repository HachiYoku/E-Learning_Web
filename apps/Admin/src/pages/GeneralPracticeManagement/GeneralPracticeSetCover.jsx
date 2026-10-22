import { useState } from 'react'
import { BookOpenText } from 'lucide-react'

export default function GeneralPracticeSetCover({ src, alt, className = '' }) {
  const [failedSrc, setFailedSrc] = useState('')
  const showImage = Boolean(src) && failedSrc !== src

  return <div className={`flex aspect-video w-full items-center justify-center overflow-hidden bg-[#FFF1D0] text-[#A94F00] ${className}`}>
    {showImage
      ? <img src={src} alt={alt} onError={() => setFailedSrc(src)} className="h-full w-full object-contain object-center" />
      : <div className="flex flex-col items-center gap-2" aria-hidden="true">
        <BookOpenText size={36} />
        <span className="text-xs font-bold uppercase tracking-wider">Thai Practice</span>
      </div>}
  </div>
}
