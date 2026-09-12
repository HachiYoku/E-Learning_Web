import { Bell, BookOpen, ChevronRight, Headphones, ReceiptText } from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { useNotification } from "../contexts/NotificationContext"

const destinations = [
  { title: "Explore courses", description: "Browse every Arun Thai course", to: "/app/explore", icon: BookOpen, color: "bg-[#FFF1D0] text-[#C97112]" },
  { title: "Course orders", description: "View payments and enrollment status", to: "/app/orders", icon: ReceiptText, color: "bg-[#E9F4EA] text-[#4D7C57]" },
  { title: "Help & support", description: "Send a question to the Arun Thai team", to: "/app/support", icon: Headphones, color: "bg-[#FFF1D0] text-[#C97112]" },
  { title: "Notifications", description: "Course and payment updates", to: "/app/notifications", icon: Bell, color: "bg-[#F3EAFE] text-[#8055A6]" },
]

function StudentMore() {
  const { user } = useAuth()
  const { unreadCount } = useNotification()
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
        {destinations.map(({ title, description, to, icon: Icon, color }, index) => (
          <Link key={to} to={to} className={`flex items-center gap-4 p-4 transition hover:bg-[#FFF9EA] ${index ? "border-t border-[#2D2E30]/10" : ""}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-bold text-[#2D2E30]">{title}</span><span className="block truncate text-sm text-[#765F55]">{description}</span></span>
            {title === "Notifications" && unreadCount > 0 ? <span className="rounded-full bg-[#E58C1A] px-2 py-1 text-xs font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span> : <ChevronRight className="h-5 w-5 text-[#9A8775]" />}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default StudentMore
