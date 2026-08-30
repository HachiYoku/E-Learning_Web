import { useNavigate } from 'react-router-dom'

function CourseCard({ id, image, title, description, price, rating }) {
  const navigate = useNavigate()

  const handleViewDetails = () => {
    navigate(`/courses/${id}`)
  }

  const resolvedImage = image && image.startsWith('/src/assets')
    ? new URL(image.replace('/src/assets/', '../assets/'), import.meta.url).href
    : image

  return (
    <article className="group relative flex flex-col gap-4 overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-[#FFFDF8] p-3 shadow-[0_18px_45px_-32px_rgba(80,48,19,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_55px_-32px_rgba(80,48,19,0.45)] md:flex-row md:gap-5 md:p-4">
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#E58C1A]/65 to-transparent" aria-hidden="true" />
      {/* Image Container - Left */}
      <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-[1.75rem] bg-[#E7DCCE] md:h-auto md:w-44 lg:w-48">
        {resolvedImage ? (
          <img 
            src={resolvedImage} 
            alt={title} 
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-gray-500">
            No image
          </div>
        )}
      </div>

      {/* Content Container - Right */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-1 md:py-2">
        {/* Title as Badge */}
        <div className="mb-5 flex w-full shrink-0 justify-center rounded-full border border-[#E58C1A]/20 bg-[#FFF4D8] px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">
          {title}
        </div>

        {/* Description */}
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-[#765F55] md:text-sm">
          {description}
        </p>

        {/* Price */}
        <div className="mb-3 text-lg font-bold text-[#C97112] md:text-xl">
          {price}
        </div>

        {/* Rating */}
        <div className="mb-4 flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <span key={i} className={i < Math.floor(rating) ? "text-[#F4B63F] text-xs" : "text-[#E7DCCE] text-xs"}>
                ★
              </span>
            ))}
          </div>
          <span className="text-xs text-[#765F55]">({rating}/5)</span>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 border-t border-[#2D2E30]/10 pt-4 md:flex-row">
          <button 
            onClick={handleViewDetails}
            className="flex-1 rounded-xl border border-[#2D2E30]/18 px-3 py-2.5 text-xs font-semibold text-[#2D2E30] transition-colors hover:border-[#E58C1A] hover:text-[#C97112] md:text-sm"
          >
            View details
          </button>
          <button 
            onClick={() => navigate(`/enroll/${id}`)}
            className="flex-1 rounded-xl bg-[#2D2E30] px-3 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#2D2E30]/15 transition-colors hover:bg-[#E58C1A] md:text-sm"
          >
            Enroll Now
          </button>
        </div>
      </div>
    </article>
  )
}

export default CourseCard
