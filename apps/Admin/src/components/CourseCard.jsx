import { Star, Trash2, Edit2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatCourseCardCurrency, getCourseCardPrices } from './courseCardPricing'

function CourseCard({ course, onEdit, onDelete }) {
  const navigate = useNavigate()
  const image = course.image || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=700&fit=crop'
  const prices = getCourseCardPrices(course)

  const handleAddLesson = () => {
    navigate(`/courses/${course.id}`)
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_12px_30px_-24px_rgba(45,46,48,0.55)] transition-all hover:-translate-y-1 hover:border-[#E58C1A]/35 hover:shadow-[0_20px_38px_-24px_rgba(201,113,18,0.4)]">
      <div className="relative h-48 w-full overflow-hidden bg-[#FFF1CE]">
        <img
          src={image}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#2D2E30]/45 to-transparent" aria-hidden="true" />
      </div>

      <div className="flex min-h-[20rem] flex-col p-4 sm:p-5">
        <div className="mb-3">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              course.isPublished
                ? 'bg-[#EDF8EE] text-[#246B35]'
                : 'bg-[#FFF1CE] text-[#9A5816]'
            }`}
          >
            {course.isPublished ? 'Published' : 'Draft'}
          </span>
        </div>

        <h3 className="mb-2 line-clamp-2 text-lg font-bold text-[#2D2E30]">{course.title}</h3>

        <p className="mb-4 line-clamp-3 text-sm leading-6 text-[#765F55]">
          {course.description || 'No course description yet.'}
        </p>

        <div className="mb-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {prices.map((price) => (
              <div
                className="rounded-xl border border-[#eadfd1] bg-[#fffdf8] px-3 py-2"
                key={price.currency}
              >
                <p className="text-[11px] font-bold tracking-[0.14em] text-[#8b776b]">
                  {price.currency}
                </p>
                {price.configured ? (
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    {price.hasDiscount && (
                      <>
                        <span className="text-xs text-[#9a8a7f] line-through">
                          {formatCourseCardCurrency(price.originalPrice, price.currency)}
                        </span>
                        <span aria-hidden="true" className="text-xs text-[#b19e90]">→</span>
                      </>
                    )}
                    <span className="text-base font-bold text-[#c96b17]">
                      {formatCourseCardCurrency(price.price, price.currency)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-[#9a8a7f]">Not configured</p>
                )}
              </div>
            ))}
          </div>
          <span className="mt-2 inline-flex rounded-full bg-[#FFF9EA] px-3 py-1 text-sm font-semibold text-[#765F55]">
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
          <span className="text-sm text-[#765F55]">({course.rating})</span>
        </div>

        <div className="mt-auto space-y-2">
          <button
            onClick={handleAddLesson}
            className="w-full rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2"
          >
            Add Lesson
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(course.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D2E30] transition-colors hover:border-[#E58C1A]/40 hover:bg-[#FFF9EA]"
              title="Edit course"
            >
              <Edit2 size={16} />
              Edit
            </button>
            <button
              onClick={() => onDelete(course.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#A34D45]/20 bg-[#FFF0EE] px-4 py-2.5 text-sm font-semibold text-[#A34D45] transition-colors hover:bg-[#FFE1DD]"
              title="Delete course"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default CourseCard
