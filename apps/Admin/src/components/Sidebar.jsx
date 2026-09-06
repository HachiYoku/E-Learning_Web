import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutGrid, BookOpen, FileText, Users, CreditCard, Settings, LogOut, ListChecks, Mail, MailCheck, Send, BellRing, BarChart3 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { fetchUnreadContactLeadCount } from '../services/contactLeadService'
import { fetchPendingPaymentCount } from '../services/paymentService'

function Sidebar({ isOpen = true, onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()
  const [badges, setBadges] = useState({ contacts: 0, payments: 0 })

  useEffect(() => {
    let active = true
    const loadBadges = async () => {
      try {
        const [contacts, payments] = await Promise.all([fetchUnreadContactLeadCount(), fetchPendingPaymentCount()])
        if (active) setBadges({ contacts: contacts.count || 0, payments: payments.count || 0 })
      } catch {
        // A badge must never interfere with navigation when the dashboard API is unavailable.
      }
    }
    loadBadges()
    const intervalId = window.setInterval(loadBadges, 60000)
    window.addEventListener('admin-badges-refresh', loadBadges)
    return () => { active = false; window.clearInterval(intervalId); window.removeEventListener('admin-badges-refresh', loadBadges) }
  }, [])

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleNavigate = (path) => {
    navigate(path)
    onNavigate?.()
  }

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: LayoutGrid },
    { label: 'Manage course', path: '/courses', icon: BookOpen },
    { label: 'Quiz management', path: '/quizzes', icon: ListChecks },
    { label: 'Manage blog', path: '/blog', icon: FileText },
    { label: 'Manage users', path: '/users', icon: Users },
    { label: 'Pending verification', path: '/pending-verifications', icon: MailCheck },
    { label: 'Subscribers & enquiries', path: '/contacts', icon: Mail, badge: badges.contacts },
    { label: 'Email updates', path: '/campaigns', icon: Send },
    { label: 'User announcements', path: '/announcements', icon: BellRing },
    { label: 'Review payment', path: '/review-payment', icon: CreditCard, badge: badges.payments },
    { label: 'Reports & insights', path: '/analytics', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ]

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[#E58C1A]/15 bg-[#2D2E30] text-white shadow-2xl shadow-[#2D2E30]/20 transition-all duration-300 md:relative md:z-auto md:translate-x-0 md:shadow-none ${
        isOpen ? 'w-72 translate-x-0 md:w-64' : 'w-72 -translate-x-full md:w-[5.5rem]'
      }`}
      aria-label="Admin navigation"
    >
      {/* Logo/Header */}
      <div className="flex min-h-24 items-center border-b border-white/10 px-5">
        {isOpen ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <img src="/images/Arun-thai-web-logo.png" alt="Arun Thai" className="h-11 w-11 shrink-0 rounded-xl object-contain" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-white">Arun Thai</h1>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F8C56A]">Admin portal</p>
            </div>
          </div>
        ) : (
          <img src="/images/Arun-thai-web-logo.png" alt="Arun Thai" className="mx-auto h-11 w-11 shrink-0 rounded-xl object-contain" />
        )}
      </div>

      {/* Menu Items */}
      <nav className={`admin-sidebar-scroll flex-1 space-y-1 overflow-y-auto py-5 ${isOpen ? 'px-3' : 'px-3 md:px-2'}`}>
        {isOpen && <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Workspace</p>}
        {menuItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#F8C56A]/70 ${!isOpen ? 'md:justify-center md:px-0' : ''} ${
                active
                  ? 'bg-[#E58C1A] font-bold text-white shadow-lg shadow-black/15'
                  : 'font-medium text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              title={!isOpen ? item.label : ''}
            >
              <Icon size={19} className={`shrink-0 ${active ? 'text-white' : 'text-[#F8C56A] group-hover:text-[#F8C56A]'}`} />
              {isOpen && <span className="truncate">{item.label}</span>}
              {isOpen && item.badge > 0 ? <span className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white text-[#C97112]' : 'bg-[#F8C56A] text-[#2D2E30]'}`}>{item.badge > 99 ? '99+' : item.badge}</span> : null}
            </button>
          )
        })}
      </nav>

      {/* Logout Button */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#F8C56A]/70 ${!isOpen ? 'md:justify-center md:px-0' : ''}`}
          title={!isOpen ? 'Logout' : ''}
        >
          <LogOut size={19} className="shrink-0 text-[#F8C56A]" />
          {isOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
