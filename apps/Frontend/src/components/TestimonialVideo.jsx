import { useMemo, useState } from "react"
import { Play, Star } from "lucide-react"

function getEmbedUrl(src) {
  if (!src) {
    return ""
  }

  try {
    const url = new URL(src)

    if (url.hostname.includes("youtu.be")) {
      const videoId = url.pathname.replace("/", "")
      const params = new URLSearchParams(url.search)
      params.set("autoplay", "1")
      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
    }

    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v")

      if (videoId) {
        const params = new URLSearchParams(url.search)
        params.delete("v")
        params.set("autoplay", "1")
        return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
      }
    }
  } catch {
    return ""
  }

  return ""
}

function TestimonialVideo({ image, src, backgroundColor }) {
  const [isOpen, setIsOpen] = useState(false)
  const embedUrl = useMemo(() => getEmbedUrl(src), [src])

  const content = (
    <>
      {/* Background Image */}
      <img 
        src={image} 
        alt="Student testimonial"
        className="w-full h-full object-cover"
      />

      {/* Play Button Overlay */}
      <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-all duration-300">
        <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg">
          <Play
            className="w-8 h-8 text-white ml-1 fill-current"
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* YouTube Badge */}
      <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-red-600 px-4 py-2 rounded-lg">
        <Star
          className="w-5 h-5 text-white fill-current"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="text-white font-semibold text-sm">WATCH IT ON</span>
      </div>
    </>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (embedUrl) {
            setIsOpen(true)
          }
        }}
        className={`${backgroundColor} relative h-80 w-full overflow-hidden rounded-3xl text-left group ${embedUrl ? "cursor-pointer" : "cursor-default"}`}
        aria-label="Open testimonial video"
      >
        {content}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-black shadow-2xl">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-gray-900 transition hover:bg-white"
              aria-label="Close video"
            >
              ×
            </button>

            <div className="aspect-video w-full">
              <iframe
                src={embedUrl}
                title="Student testimonial video"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default TestimonialVideo
