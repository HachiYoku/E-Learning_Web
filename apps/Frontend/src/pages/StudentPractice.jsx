import { createElement } from "react"
import { BookOpenText, ChevronRight, GalleryVerticalEnd, Languages, ListChecks } from "lucide-react"
import { Link } from "react-router-dom"

const activities = [
  { title: "Thai consonants", description: "Learn all 44 consonants, their sounds, and classes.", to: "/app/practice/thai-consonants", icon: Languages, color: "bg-[#FFF1D0] text-[#C97112]" },
  { title: "Thai vowels", description: "Practice short, long, and special Thai vowel sounds.", to: "/app/practice/thai-vowels", icon: BookOpenText, color: "bg-[#E8F3FA] text-[#367599]" },
  { title: "Flashcards", description: "Build useful vocabulary through quick recall practice.", to: "/app/practice/flashcards", icon: GalleryVerticalEnd, color: "bg-[#E9F4EA] text-[#4D7C57]" },
  { title: "General Practice", description: "Explore short Thai quizzes and choose what to practice next.", to: "/app/practice/general", icon: ListChecks, color: "bg-[#FFF1D0] text-[#C97112]" },
]

function StudentPractice() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Learning tools</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Practice Thai your way.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base">Choose a focused activity to strengthen your reading, pronunciation, and vocabulary.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {activities.map(({ title, description, to, icon, color }) => (
          <Link key={to} to={to} className="group rounded-2xl border border-[#2D2E30]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#E58C1A]/35 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]">
            <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>{createElement(icon, { className: "h-6 w-6", "aria-hidden": true })}</span>
            <h2 className="mt-5 text-lg font-bold">{title}</h2>
            <p className="mt-2 min-h-12 text-sm leading-relaxed text-[#765F55]">{description}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#C97112]">{to === "/app/practice/general" ? "Explore quizzes" : "Start practice"} <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" /></span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default StudentPractice
