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
    <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow flex flex-col md:flex-row gap-3 md:gap-4 p-3 md:p-4">
      {/* Image Container - Left */}
      <div className="relative w-full md:w-40 lg:w-48 h-40 md:h-44 lg:h-48 bg-gray-300 overflow-hidden shrink-0 rounded-lg">
        {resolvedImage ? (
          <img 
            src={resolvedImage} 
            alt={title} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-gray-500">
            No image
          </div>
        )}
      </div>

      {/* Content Container - Right */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        {/* Title as Badge */}
        <div className="inline-block bg-[#CDEAFA] text-black-700 text-xs md:text-sm font-semibold px-2 py-1 rounded-full mb-2 w-full text-center flex-shrink-0">
          {title}
        </div>

        {/* Description */}
        <p className="text-gray-600 text-xs md:text-sm mb-2 line-clamp-2">
          {description}
        </p>

        {/* Price */}
        <div className="text-base md:text-lg font-bold text-gray-900 mb-2">
          {price}
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-3">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <span key={i} className={i < Math.floor(rating) ? "text-yellow-400 text-xs" : "text-gray-300 text-xs"}>
                ★
              </span>
            ))}
          </div>
          <span className="text-gray-600 text-xs">({rating}/5)</span>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 flex-col md:flex-row">
          <button 
            onClick={handleViewDetails}
            className="flex-1 px-3 py-2 md:py-2.5 border-2 border-[#F8B2C0] text-gray-700 font-semibold text-xs md:text-sm rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            ดูรายละเอียด
          </button>
          <button 
            onClick={() => navigate(`/enroll/${id}`)}
            className="flex-1 px-3 py-2 md:py-2.5 bg-[#F8B2C0] text-gray-900 font-semibold text-xs md:text-sm rounded-lg hover:bg-[#F8C2C0] transition-colors"
          >
            สมัครเรียนเลย
          </button>
        </div>
      </div>
    </div>
  )
}

export default CourseCard
