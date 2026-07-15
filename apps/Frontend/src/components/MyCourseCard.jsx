import { useNavigate } from 'react-router-dom'

function MyCourseCard({ id, image, title, description, lessons, buttonText = "Learn Now" }) {
  const navigate = useNavigate()

  const handleLearnNow = () => {
    navigate(`/course-lessons/${id}`)
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-lg transition-shadow hover:shadow-xl sm:flex-row sm:gap-6">
      <div className="relative h-52 w-full shrink-0 overflow-hidden rounded-xl bg-gray-300 sm:h-auto sm:w-56">
        {image ? (
          <img 
            src={image} 
            alt={title} 
            className="h-64  w-full object-full scale-100"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-gray-500">
            No image
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="mb-3 inline-block w-full rounded-full bg-blue-100 px-4 py-2 text-center text-xs font-semibold text-gray-900">
            Enrolled Course
          </div>

          <p className="mb-2 text-lg font-semibold text-gray-900">
            {title}
          </p>

          <p className="mb-2 text-gray-600 text-sm leading-relaxed mb-3">
            {description}
          </p>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">📄</span>
          <span className="text-sm font-semibold text-gray-700 sm:text-base">
            {lessons} lessons
          </span>
        </div>

        <button 
          onClick={handleLearnNow}
          className="w-full rounded-full bg-[#F8B2C0] px-4 py-2 text-sm font-bold text-gray-900 transition-colors hover:bg-[#F8C2C0]"
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}

export default MyCourseCard
