import { BookOpen, ChevronRight, Headphones, Newspaper, ReceiptText } from "lucide-react"
import { createElement } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

const destinations = [
  { title: "Explore courses", description: "Browse every Arun Thai course", to: "/app/explore", icon: BookOpen, color: "bg-[#FFF1D0] text-[#C97112]" },
  { title: "Blog", description: "Read Thai learning stories and tips", to: "/app/blog", icon: Newspaper, color: "bg-[#E8F3FA] text-[#367599]" },
  { title: "Course orders", description: "View payments and enrollment status", to: "/app/orders", icon: ReceiptText, color: "bg-[#E9F4EA] text-[#4D7C57]" },
  { title: "Help & support", description: "Send a question to the Arun Thai team", to: "/app/support", icon: Headphones, color: "bg-[#FFF1D0] text-[#C97112]" },
]

function StudentMore() {
  const { user } = useAuth()
  const profileImage = user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || "student"}`

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Student app</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">More</h1>
      <Link to="/app/profile" className="mt-6 flex items-center gap-4 rounded-2xl border border-[#2D2E30]/10 bg-white p-4 shadow-sm">
        <img src={profileImage} alt="" className="h-12 w-12 rounded-full border-2 border-[#E58C1A]/20 object-cover" />
        <span className="min-w-0 flex-1"><span className="block truncate font-bold">{user?.name || "Student"}</span><span className="block truncate text-sm text-[#765F55]">View profile</span></span><ChevronRight className="h-5 w-5 text-[#9A8775]" />
      </Link>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white">
        {destinations.map(({ title, description, to, icon, color }, index) => (
          <Link key={to} to={to} className={`flex items-center gap-4 p-4 transition hover:bg-[#FFF9EA] ${index ? "border-t border-[#2D2E30]/10" : ""}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>{createElement(icon, { className: "h-5 w-5" })}</span>
            <span className="min-w-0 flex-1"><span className="block font-bold text-[#2D2E30]">{title}</span><span className="block truncate text-sm text-[#765F55]">{description}</span></span>
            <ChevronRight className="h-5 w-5 text-[#9A8775]" />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default StudentMore
