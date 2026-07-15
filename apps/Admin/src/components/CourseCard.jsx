import { Star, Trash2, Edit2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function CourseCard({ course, onEdit, onDelete }) {
  const navigate = useNavigate()
  const image = course.image || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=700&fit=crop'

  const handleAddLesson = () => {
    navigate(`/courses/${course.id}`)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="h-48 w-full overflow-hidden bg-gray-100">
        <img
          src={image}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </div>

      <div className="flex min-h-[20rem] flex-col p-4 sm:p-5">
        <div className="mb-3 ">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              course.isPublished
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {course.isPublished ? 'Published' : 'Draft'}
          </span>
        </div>

        <h3 className="mb-2 line-clamp-2 text-lg font-bold text-gray-900">{course.title}</h3>

        <p className="mb-4 line-clamp-3 text-sm leading-6 text-gray-600">
          {course.description || 'No course description yet.'}
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span className="text-lg font-bold text-gray-900">{course.price}</span>
          <span className="rounded-full bg-gray-100 px-3 py-1 font-medium">
            {course.lessons} lessons
          </span>
        </div>

        <div className="mb-5 flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={13}
                className={i < Math.floor(course.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
              />
            ))}
          </div>
          <span className="text-sm text-gray-600">({course.rating})</span>
        </div>

        <div className="mt-auto space-y-2">
          <button
            onClick={handleAddLesson}
            className="w-full rounded-xl bg-pink-300 px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-pink-400"
          >
            Add Lesson
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(course.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              title="Edit course"
            >
              <Edit2 size={16} />
              Edit
            </button>
            <button
              onClick={() => onDelete(course.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              title="Delete course"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CourseCard
