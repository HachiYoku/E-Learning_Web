import { useNavigate } from 'react-router-dom'
import { User, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

function TopNav({ isSidebarOpen = true, onToggleSidebar }) {
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)
  const { user, logout } = useAuth()
  const adminEmail = user?.email || 'admin@example.com'
  const adminName = user?.name || 'Admin'
  const adminAvatar = user?.avatar || ''

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex min-h-[76px] items-center justify-between border-b border-[#E58C1A]/15 bg-[#FFFDF8] px-4 py-3 sm:px-6 md:min-h-[88px] md:px-8">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2D2E30] text-white shadow-md shadow-[#2D2E30]/15 transition-all hover:-translate-y-0.5 hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2"
        title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* Profile Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowProfile(!showProfile)}
          className="flex items-center gap-2 rounded-xl border border-transparent p-1.5 pr-2 transition-colors hover:border-[#E58C1A]/20 hover:bg-[#FFF4D8]/60 focus:outline-none focus:ring-2 focus:ring-[#E58C1A]/50 sm:gap-3 sm:pr-3"
          aria-expanded={showProfile}
          aria-haspopup="menu"
        >
          {adminAvatar ? (
            <img
              src={adminAvatar}
              alt={adminName}
              className="h-10 w-10 rounded-xl border-2 border-[#F8C56A] object-cover sm:h-11 sm:w-11"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E58C1A] shadow-sm shadow-[#E58C1A]/30 sm:h-11 sm:w-11">
              <span className="text-sm font-bold text-white">{adminName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="hidden min-w-0 text-left sm:block">
            <p className="max-w-[11rem] truncate text-sm font-bold text-[#2D2E30]">{adminName}</p>
            <p className="max-w-[11rem] truncate text-xs text-[#765F55]">{adminEmail}</p>
          </div>
        </button>

        {showProfile && (
          <div className="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-[#E58C1A]/20 bg-white shadow-xl shadow-[#2D2E30]/15" role="menu">
            <div className="border-b border-[#2D2E30]/10 bg-[#FFF9EA] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C97112]">Signed in as</p>
              <p className="mt-1 truncate text-sm font-bold text-[#2D2E30]">{adminName}</p>
              <p className="mt-0.5 truncate text-xs text-[#765F55]">{adminEmail}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                navigate('/admin-profile')
                setShowProfile(false)
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-[#2D2E30] transition-colors hover:bg-[#FFF4D8] focus:outline-none focus:bg-[#FFF4D8]"
              role="menuitem"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF1CE] text-[#C97112]"><User size={16} /></span>
              Admin Profile
            </button>

            <div className="border-t border-[#2D2E30]/10">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#A34D45] transition-colors hover:bg-[#FFF0EE] focus:outline-none focus:bg-[#FFF0EE]"
                role="menuitem"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF0EE]"><LogOut size={16} /></span>
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default TopNav
