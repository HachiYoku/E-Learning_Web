const logo = "/Nav/Logo.PNG"
import { Menu, X } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { useAuth } from "../contexts/AuthContext"

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()

  const isActive = (path) => location.pathname === path

  useEffect(() => {
    setShowMobileMenu(false)
    setShowProfileMenu(false)
  }, [location.pathname])

  const navItems = [
    { label: "Home", path: "/" },
    { label: "Courses", path: "/courses" },
    { label: "Blogs", path: "/blog" },
    { label: "Services", path: "/service" },
  ]

  const goTo = (path) => {
    navigate(path)
    setShowMobileMenu(false)
  }

  const handleLogout = () => {
    logout()
    setShowProfileMenu(false)
    setShowMobileMenu(false)
    navigate('/')
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
          <img src={logo} alt="English Kafe Logo" className="size-14 scale-150 object-fit sm:size-15" />
        </button>

        {/* Desktop Menu */}
        <ul className="hidden md:flex gap-4 lg:gap-8 font-medium">
          {navItems.map((item) => (
            <li
              key={item.path}
              onClick={() => goTo(item.path)}
              className="cursor-pointer rounded-full px-4 py-2 text-black transition-all hover:shadow-md lg:px-6"
              style={{ backgroundColor: isActive(item.path) ? "#CDEAFA" : "transparent" }}
            >
              {item.label}
            </li>
          ))}
        </ul>

        {/* Desktop Login / Profile */}
        <div className="hidden md:block">
          {!isAuthenticated ? (
            <button
              onClick={() => goTo('/login')}
              className="rounded-lg bg-black px-6 py-2 font-medium text-white transition-colors hover:bg-gray-800"
            >
              login
            </button>
          ) : (
            <div className="relative">
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
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-xl">
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
                      goTo('/my-profile')
                      setShowProfileMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left font-medium text-gray-700 transition-colors hover:bg-blue-50"
                  >
                    My Profile
                  </button>

                  <button
                    onClick={() => {
                      goTo('/my-courses')
                      setShowProfileMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 transition-colors hover:bg-blue-50"
                  >
                    My Courses
                  </button>

                  <button
                    onClick={() => {
                      goTo('/my-course-order')
                      setShowProfileMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 transition-colors hover:bg-blue-50"
                  >
                    My Course Order
                  </button>

                  <div className="border-t border-gray-200">
                    <button
                      onClick={handleLogout}
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
                className="w-full rounded-2xl px-4 py-3 text-left font-medium text-gray-900 transition-colors"
                style={{ backgroundColor: isActive(item.path) ? "#CDEAFA" : "#F9FAFB" }}
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
                <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
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

                <button
                  onClick={() => goTo('/my-profile')}
                  className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-left font-medium text-gray-700 transition-colors hover:bg-blue-50"
                >
                  My Profile
                </button>

                <button
                  onClick={() => goTo('/my-courses')}
                  className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-left font-medium text-gray-700 transition-colors hover:bg-blue-50"
                >
                  My Courses
                </button>

                <button
                  onClick={() => goTo('/my-course-order')}
                  className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-left font-medium text-gray-700 transition-colors hover:bg-blue-50"
                >
                  My Course Order
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full rounded-2xl bg-red-50 px-4 py-3 text-left font-medium text-red-700 transition-colors hover:bg-red-100"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  )
}

export default Navbar
