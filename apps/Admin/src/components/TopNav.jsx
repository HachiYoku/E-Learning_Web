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
    <div className="bg-white px-8 py-4 flex items-center justify-between border-b border-gray-200">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition-colors hover:bg-pink-50 hover:text-gray-900"
        title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* Profile Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
        >
          {adminAvatar ? (
            <img
              src={adminAvatar}
              alt={adminName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">{adminName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">{adminName}</p>
            <p className="text-xs text-gray-500">{adminEmail}</p>
          </div>
        </button>

        {showProfile && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-3 border-b border-gray-200 overflow-hidden">
              <p className="text-sm text-gray-600">Logged in as</p>
              <p className="font-semibold text-sm text-gray-900">{adminEmail}</p>
            </div>

            <button
              onClick={() => {
                navigate('/admin-profile')
                setShowProfile(false)
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors flex items-center gap-2 text-sm"
            >
              <User size={16} />
              Admin Profile
            </button>

            <div className="border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TopNav
