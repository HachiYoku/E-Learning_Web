import { createElement, useState } from "react"
import { Bell, BookOpen, ChevronLeft, ChevronRight, CircleUserRound, ClipboardCheck, GraduationCap, Headphones, LayoutDashboard, LogOut, MoreHorizontal, ReceiptText } from "lucide-react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { useNotification } from "../contexts/NotificationContext"

const logo = "/Nav/Arun-thai-web-logo.png"

const navigation = [
  { label: "Today", to: "/app", icon: LayoutDashboard, end: true },
  { label: "My courses", to: "/app/courses", icon: GraduationCap },
  { label: "Explore courses", to: "/app/explore", icon: BookOpen },
  { label: "Practice", to: "/app/practice", icon: ClipboardCheck },
  { label: "Blog", to: "/app/blog", icon: BookOpen },
  { label: "Course orders", to: "/app/orders", icon: ReceiptText },
  { label: "Help & support", to: "/app/support", icon: Headphones },
  { label: "Notifications", to: "/app/notifications", icon: Bell },
  { label: "Profile", to: "/app/profile", icon: CircleUserRound },
]

const mobileNavigation = [
  { label: "Today", to: "/app", icon: LayoutDashboard, end: true },
  { label: "Courses", to: "/app/courses", icon: GraduationCap },
  { label: "Practice", to: "/app/practice", icon: ClipboardCheck },
  { label: "Blog", to: "/app/blog", icon: BookOpen },
  { label: "More", to: "/app/more", icon: MoreHorizontal },
]

const practiceNavigation = [
  { label: "Overview", to: "/app/practice", end: true },
  { label: "Consonants", to: "/app/practice/thai-consonants" },
  { label: "Vowels", to: "/app/practice/thai-vowels" },
  { label: "Flashcards", to: "/app/practice/flashcards" },
]

function StudentLayout() {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotification()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false)
  const profileImage = user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || "student"}`
  const isPracticeArea = location.pathname === "/app/practice" || location.pathname.startsWith("/app/practice/")

  const handleLogout = () => {
    setIsMobileProfileOpen(false)
    logout()
    navigate("/")
  }

  return (
    <div className="min-h-screen bg-[#FFF9EA] text-[#2D2E30] lg:flex">
      <aside className={`sticky top-0 z-40 flex h-auto items-center justify-between border-b border-[#2D2E30]/10 bg-[#FFFDF8] px-4 py-3 transition-[width] duration-300 lg:h-screen lg:flex-col lg:items-stretch lg:border-b-0 lg:border-r lg:py-5 ${isSidebarExpanded ? "lg:w-56 lg:px-4" : "lg:w-20 lg:px-2"}`}>
        <div className={`flex items-center gap-3 ${isSidebarExpanded ? "lg:block" : "lg:flex lg:justify-center"}`}>
          <button type="button" onClick={() => navigate("/")} className="shrink-0" aria-label="Go to Arun Thai website">
            <img src={logo} alt="Arun Thai" className={`h-auto w-28 transition-all ${isSidebarExpanded ? "lg:w-[7.5rem]" : "lg:w-11"}`} />
          </button>
        </div>

        <div className="relative lg:hidden">
          <button type="button" onClick={() => setIsMobileProfileOpen((current) => !current)} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#F8C56A] bg-white p-1 shadow-sm shadow-[#E58C1A]/15 transition hover:-translate-y-0.5 hover:border-[#E58C1A] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15" aria-expanded={isMobileProfileOpen} aria-haspopup="menu" aria-label="Open account menu">
            <img src={profileImage} alt="" className="h-full w-full rounded-full object-cover" />
          </button>
          {isMobileProfileOpen ? <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-[1.5rem] border border-[#E58C1A]/20 bg-white shadow-[0_24px_55px_-25px_rgba(45,46,48,0.35)]" role="menu"><div className="bg-[#2D2E30] p-4 text-white"><div className="flex items-center gap-3"><img src={profileImage} alt="" className="h-11 w-11 rounded-xl border-2 border-[#F8C56A] object-cover" /><div className="min-w-0"><p className="truncate text-sm font-bold">{user?.name || "Student"}</p><p className="mt-0.5 truncate text-xs text-white/65">{user?.email}</p><span className="mt-2 inline-block rounded-full bg-[#F8C56A] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#2D2E30]">Student account</span></div></div></div><div className="p-2"><NavLink to="/app/profile" onClick={() => setIsMobileProfileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#FFF1D0]" role="menuitem"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF1D0] text-[#C97112]"><CircleUserRound className="h-4 w-4" /></span>View profile</NavLink><button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-[#A34D45] transition hover:bg-red-50" role="menuitem"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF0EE]"><LogOut className="h-4 w-4" /></span>Log out</button></div></div> : null}
        </div>

        <button type="button" onClick={() => setIsSidebarExpanded((current) => !current)} className="absolute -right-4 top-7 hidden h-8 w-8 items-center justify-center rounded-full border border-[#E58C1A]/20 bg-[#FFFDF8] text-[#765F55] shadow-sm transition hover:bg-[#FFF1D0] hover:text-[#C97112] lg:flex" aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"} title={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}>
          {isSidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <nav className="hidden flex-1 lg:mt-6 lg:block" aria-label="Student navigation">
          <div className="space-y-1">
            {navigation.map(({ label, to, icon, end }) => (
              <NavLink key={to} to={to} end={end} title={!isSidebarExpanded ? label : ""} className={({ isActive }) => `relative flex items-center rounded-xl py-2.5 text-[13px] font-bold transition ${isSidebarExpanded ? "gap-2.5 px-3" : "justify-center px-0"} ${isActive ? "bg-[#2D2E30] text-white shadow-md shadow-[#2D2E30]/10" : "text-[#765F55] hover:bg-[#FFF1D0] hover:text-[#9A5816]"}`}>
                {createElement(icon, { className: "h-4 w-4", "aria-hidden": true })}
                {isSidebarExpanded ? <span className="truncate">{label}</span> : null}
                {label === "Notifications" && unreadCount > 0 ? <span className={`${isSidebarExpanded ? "ml-auto px-1.5 py-0.5" : "absolute right-2 top-2 h-2 w-2 p-0"} rounded-full bg-[#E58C1A] text-[10px] text-white`}>{isSidebarExpanded ? (unreadCount > 9 ? "9+" : unreadCount) : null}</span> : null}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="hidden border-t border-[#2D2E30]/10 pt-4 lg:block">
          <NavLink to="/app/profile" title={!isSidebarExpanded ? "Profile" : ""} className={`flex items-center rounded-xl p-2 transition hover:bg-[#FFF1D0] ${isSidebarExpanded ? "gap-2.5" : "justify-center"}`}>
            <img src={profileImage} alt="" className="h-9 w-9 rounded-full border-2 border-[#E58C1A]/20 object-cover" />
            {isSidebarExpanded ? <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold">{user?.name || "Student"}</span><span className="block truncate text-[11px] text-[#765F55]">Student account</span></span> : null}
          </NavLink>
          <button type="button" onClick={handleLogout} title={!isSidebarExpanded ? "Log out" : ""} className={`mt-2 flex w-full items-center rounded-xl py-2 text-[13px] font-bold text-[#765F55] transition hover:bg-red-50 hover:text-red-700 ${isSidebarExpanded ? "gap-2.5 px-3" : "justify-center px-0"}`}><LogOut className="h-4 w-4" />{isSidebarExpanded ? "Log out" : null}</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-16 lg:pb-0">
        {isPracticeArea ? <div className="border-b border-[#2D2E30]/10 bg-[#FFFDF8] px-3 py-3 sm:px-6 lg:px-8"><nav className="mx-auto grid max-w-4xl grid-cols-4 gap-1 rounded-2xl border border-[#E58C1A]/15 bg-[#FFF9EA] p-1.5 shadow-[0_10px_25px_-22px_rgba(80,48,19,0.4)]" aria-label="Practice activities">{practiceNavigation.map(({ label, to, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `min-w-0 rounded-xl px-1.5 py-2.5 text-center text-[11px] font-bold transition sm:px-3 sm:text-sm ${isActive ? "bg-[#2D2E30] text-white shadow-md shadow-[#2D2E30]/15" : "text-[#765F55] hover:bg-white hover:text-[#C97112]"}`}><span className="block truncate">{label}</span></NavLink>)}</nav></div> : null}
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-[#2D2E30]/10 bg-[#FFFDF8]/95 px-2 py-2 backdrop-blur lg:hidden" aria-label="Student navigation">
        {mobileNavigation.map(({ label, to, icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `relative flex min-w-16 flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-bold ${isActive ? "text-[#C97112]" : "text-[#765F55]"}`}>
            <span className="relative">{createElement(icon, { className: "h-5 w-5" })}{label === "Notifications" && unreadCount > 0 ? <span className="absolute -right-2 -top-2 h-2 w-2 rounded-full bg-red-500" /> : null}</span>{label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default StudentLayout
