import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, CircleCheck } from 'lucide-react'

function MyCourseCard({ id, image, title, description, progress, buttonText = "Learn Now" }) {
  const navigate = useNavigate()

  const handleLearnNow = () => {
    navigate(`/course-lessons/${id}`)
  }

  const completedLessons = progress?.completedLessons || 0
  const totalLessons = progress?.totalLessons || 0
  const percentage = progress?.percentage || 0
  const lastLesson = progress?.lastOpenedLesson

  return (
    <article className="group relative flex flex-col gap-4 overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-[#FFFDF8] p-3 shadow-[0_18px_45px_-32px_rgba(80,48,19,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_55px_-32px_rgba(80,48,19,0.45)] md:flex-row md:gap-5 md:p-4">
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#E58C1A]/65 to-transparent" aria-hidden="true" />

      <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-[1.75rem] bg-[#E7DCCE] md:h-[300px] md:w-[250px]">
        {image ? (
          <img 
            src={image} 
            alt={title} 
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-[#765F55]">
            No image
          </div>
        )}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#2D2E30]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
          <CircleCheck className="h-3 w-3 text-[#F8C56A]" aria-hidden="true" />
          Enrolled
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-1 md:py-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Enrolled course</p>
          <h3 className="mt-2 text-xl font-bold leading-tight tracking-tight text-[#2D2E30] sm:text-2xl">{title}</h3>
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[#765F55]">{description}</p>
        </div>

        <div className="mt-5 border-t border-[#2D2E30]/10 pt-4">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#765F55]">
            <span className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF4D8] text-[#C97112]"><BookOpen className="h-4 w-4" aria-hidden="true" /></span>{completedLessons} of {totalLessons} lessons</span>
            <span className="text-[#C97112]">{percentage}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F0E7DC]" aria-label={`${percentage}% complete`}>
            <div className="h-full rounded-full bg-[#E58C1A] transition-all duration-300" style={{ width: `${percentage}%` }} />
          </div>
          <p className="mt-3 truncate text-xs text-[#765F55]">{lastLesson ? `Continue: ${lastLesson.order}. ${lastLesson.title}` : 'Start with your first lesson'}</p>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleLearnNow}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D2E30] px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-[#2D2E30]/15 transition-colors hover:bg-[#E58C1A] sm:px-4 sm:text-sm"
          >
            {buttonText}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}

export default MyCourseCard
