const logo = "/Nav/Arun-thai-web-logo.png"
import { Bell, CheckCheck, Menu, X } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import { useNotification } from "../contexts/NotificationContext"
import LogoutConfirmModal from "./LogoutConfirmModal"

const NOTIFICATION_FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "course", label: "Course" },
  { key: "payment", label: "Payment" },
];

function NotificationBell({ compact = false }) {
  const {
    unreadCount,
    isOpen: isNotificationOpen,
    setIsOpen: setNotificationOpen,
    notifications,
    loading,
    markAsRead,
    markAllRead,
  } = useNotification()
  const [activeFilter, setActiveFilter] = useState("all")

  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === "unread") return !notification.isRead;
    if (activeFilter === "course") return notification.type === "course" || notification.type === "enrollment";
    if (activeFilter === "payment") return notification.type === "payment";
    return true;
  })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setNotificationOpen(!isNotificationOpen)}
        className={`relative flex items-center justify-center rounded-full border border-[#2D2E30]/10 bg-white text-[#765F55] transition hover:border-[#E58C1A]/30 hover:bg-[#FFF4D8] hover:text-[#C97112] ${compact ? "h-10 w-10" : "h-11 w-11"}`}
        aria-label="Notifications"
      >
        <Bell className={compact ? "h-4 w-4" : "h-5 w-5"} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isNotificationOpen && (
        <div className="absolute right-0 z-50 mt-3 w-[22rem] rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="border-b border-gray-200 px-3 py-2">
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    activeFilter === filter.key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">Loading notifications...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">No notifications in this view.</div>
            ) : (
              filteredNotifications.map((notification) => (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => {
                    if (!notification.isRead) markAsRead(notification._id);
                    setNotificationOpen(false);
                    if (notification.link) window.location.href = notification.link;
                  }}
                  className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${
                    !notification.isRead ? "bg-blue-50/40" : "bg-white"
                  }`}
                >
                  <div
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      notification.isRead ? "bg-gray-300" : "bg-blue-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{notification.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                    <p className="mt-2 text-[11px] text-gray-400">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()
  const { setIsOpen: setNotificationOpen } = useNotification();

  const isActive = (path) => location.pathname === path

  useEffect(() => {
    setShowMobileMenu(false)
    setShowProfileMenu(false)
    setNotificationOpen(false)
  }, [location.pathname, setNotificationOpen])

  const navItems = [
    { label: "Home", path: "/" },
    { label: "Courses", path: "/courses" },
    { label: "Practice", path: "/practice" },
    { label: "Blogs", path: "/blog" },
    { label: "About", path: "/about" },
  ]

  const goTo = (path) => {
    navigate(path)
    setShowMobileMenu(false)
  }

  const handleLogout = () => {
    logout()
    setShowProfileMenu(false)
    setShowMobileMenu(false)
    setIsLogoutConfirmOpen(false)
    navigate('/')
  }

  const requestLogout = () => {
    setShowProfileMenu(false)
    setShowMobileMenu(false)
    setIsLogoutConfirmOpen(true)
  }

  const profileImage = user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'user'}`
  const userName = user?.name || 'User'

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 sm:px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-30">
        {/* Logo */}
        <button
          type="button"
          onClick={() => goTo('/')}
          className="flex items-center overflow-hidden"
        >
          <img
            src={logo}
            alt="Arun Thai"
            className="w-[150px] h-auto object-contain"
          />
        </button>

        {/* Desktop Menu */}
        <ul className="hidden md:flex gap-4 lg:gap-8 font-medium">
          {navItems.map((item) => (
            <li
              key={item.path}
              onClick={() => goTo(item.path)}
              className={`cursor-pointer rounded-full px-4 py-2 font-semibold transition-all lg:px-6 ${
                isActive(item.path) ? "bg-[#2D2E30] text-white shadow-md shadow-[#2D2E30]/10" : "text-[#2D2E30] hover:bg-[#FFF4D8] hover:text-[#C97112]"
              }`}
            >
              {item.label}
            </li>
          ))}
        </ul>

        {/* Desktop Login / Profile */}
        <div className="hidden md:flex items-center gap-3">
          {!isAuthenticated ? (
            <button
              onClick={() => goTo('/login')}
              className="rounded-lg bg-black px-6 py-2 font-medium text-white transition-colors hover:bg-gray-800"
            >
              login
            </button>
          ) : (
            <div className="relative flex items-center gap-3">
              <NotificationBell />

              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 transition-opacity hover:opacity-80"
              >
                <img
                  src={profileImage}
                  alt="Profile"
                  className="size-12 scale-120 rounded-full border-2 border-gray-300 object-cover"
                />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-xl top-full">
                  <div className="flex items-center gap-3 overflow-hidden border-b border-gray-200 px-2 py-4">
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="h-12 w-12 rounded-full border-2 border-gray-300 object-cover"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      goTo('/notifications')
                      setShowProfileMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left font-medium text-[#2D2E30] transition-colors hover:bg-[#FFF4D8] hover:text-[#C97112]"
                  >
                    Notifications
                  </button>

                  <button
                    onClick={() => {
                      goTo('/my-courses')
                      setShowProfileMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left font-medium text-[#2D2E30] transition-colors hover:bg-[#FFF4D8] hover:text-[#C97112]"
                  >
                    My Courses
                  </button>

                  <button
                    onClick={() => {
                      goTo('/my-course-order')
                      setShowProfileMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left font-medium text-[#2D2E30] transition-colors hover:bg-[#FFF4D8] hover:text-[#C97112]"
                  >
                    My Course Order
                  </button>

                  <button
                    onClick={() => {
                      goTo('/my-profile')
                      setShowProfileMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left font-medium text-[#2D2E30] transition-colors hover:bg-[#FFF4D8] hover:text-[#C97112]"
                  >
                    My Profile
                  </button>

                  <div className="border-t border-gray-200">
                    <button
                      onClick={requestLogout}
                      className="w-full px-4 py-3 text-left font-medium text-gray-700 transition-colors hover:bg-red-50"
                    >
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          type="button"
          onClick={() => setShowMobileMenu((current) => !current)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-800 transition-colors hover:bg-gray-50 md:hidden"
          aria-label={showMobileMenu ? "Close navigation menu" : "Open navigation menu"}
        >
          {showMobileMenu ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {showMobileMenu ? (
        <div className="border-t border-gray-200 bg-white px-4 pb-4 pt-3 shadow-sm md:hidden">
          <div className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => goTo(item.path)}
                className={`w-full rounded-2xl border px-4 py-3 text-left font-bold transition-colors ${
                  isActive(item.path)
                    ? "border-[#2D2E30] bg-[#2D2E30] text-white"
                    : "border-[#2D2E30]/10 bg-[#FFF9EA] text-[#2D2E30] hover:border-[#E58C1A]/35 hover:bg-[#FFF4D8] hover:text-[#C97112]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-gray-200 pt-4">
            {!isAuthenticated ? (
              <button
                onClick={() => goTo('/login')}
                className="w-full rounded-2xl bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-gray-800"
              >
                login
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="h-12 w-12 rounded-full border-2 border-gray-300 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{userName}</p>
                      <p className="truncate text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </div>

                  <NotificationBell compact />
                </div>

                <button
                  onClick={() => goTo('/notifications')}
                  className="w-full rounded-2xl bg-[#FFF9EA] px-4 py-3 text-left font-medium text-[#2D2E30] transition-colors hover:bg-[#FFF4D8] hover:text-[#C97112]"
                >
                  Notifications
                </button>

                <button
                  onClick={() => goTo('/my-courses')}
                  className="w-full rounded-2xl bg-[#FFF9EA] px-4 py-3 text-left font-medium text-[#2D2E30] transition-colors hover:bg-[#FFF4D8] hover:text-[#C97112]"
                >
                  My Courses
                </button>

                <button
                  onClick={() => goTo('/my-course-order')}
                  className="w-full rounded-2xl bg-[#FFF9EA] px-4 py-3 text-left font-medium text-[#2D2E30] transition-colors hover:bg-[#FFF4D8] hover:text-[#C97112]"
                >
                  My Course Order
                </button>

                <button
                  onClick={() => goTo('/my-profile')}
                  className="w-full rounded-2xl bg-[#FFF9EA] px-4 py-3 text-left font-medium text-[#2D2E30] transition-colors hover:bg-[#FFF4D8] hover:text-[#C97112]"
                >
                  My Profile
                </button>

                <button
                  onClick={requestLogout}
                  className="w-full rounded-2xl bg-red-50 px-4 py-3 text-left font-medium text-red-700 transition-colors hover:bg-red-100"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onCancel={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
      />
    </nav>
  )
}

export default Navbar
