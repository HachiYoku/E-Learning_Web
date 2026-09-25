import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { BadgePercent, BarChart3, BellRing, BookOpen, ChevronDown, ChevronRight, CreditCard, FileText, GalleryVerticalEnd, Headphones, LayoutGrid, ListChecks, LogOut, Mail, MailCheck, Send, Settings, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { fetchUnreadContactLeadCount } from '../services/contactLeadService'
import { useAdminBadges } from '../contexts/AdminBadgeContext'

function Sidebar({ isOpen = true, onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user, isAuthenticated, isBootstrapping } = useAuth()
  const [badges, setBadges] = useState({ contacts: 0 })
  const { badges: actionBadges } = useAdminBadges()
  const [expandedGroups, setExpandedGroups] = useState({})

  useEffect(() => {
    let active = true
    if (isBootstrapping || !isAuthenticated || user?.role !== 'admin') {
      setBadges({ contacts: 0 })
      return () => { active = false }
    }
    const loadBadges = async () => {
      try {
        const contacts = await fetchUnreadContactLeadCount()
        if (active) setBadges({ contacts: contacts.count || 0 })
      } catch {
        // A badge must never interfere with navigation when the dashboard API is unavailable.
      }
    }
    loadBadges()
    const intervalId = window.setInterval(loadBadges, 60000)
    window.addEventListener('admin-badges-refresh', loadBadges)
    return () => { active = false; window.clearInterval(intervalId); window.removeEventListener('admin-badges-refresh', loadBadges) }
  }, [isAuthenticated, isBootstrapping, user?.role])

  const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/')
  const handleNavigate = (path) => { navigate(path); onNavigate?.() }
  const handleLogout = () => { logout(); navigate('/login') }

  const dashboardItem = { label: 'Dashboard', path: '/', icon: LayoutGrid }
  const navigationGroups = [
    { key: 'learning', label: 'Learning', items: [{ label: 'Courses', path: '/courses', icon: BookOpen }, { label: 'Quizzes', path: '/quizzes', icon: ListChecks }, { label: 'Flashcards', path: '/flashcards', icon: GalleryVerticalEnd }, { label: 'Blog', path: '/blog', icon: FileText }] },
    { key: 'people', label: 'People', items: [{ label: 'Users', path: '/users', icon: Users }, { label: 'Verifications', path: '/pending-verifications', icon: MailCheck }, { label: 'Support', path: '/support', icon: Headphones, badge: actionBadges.support }] },
    { key: 'communication', label: 'Communication', items: [{ label: 'Enquiries', path: '/contacts', icon: Mail, badge: badges.contacts }, { label: 'Email', path: '/campaigns', icon: Send }, { label: 'Announcements', path: '/announcements', icon: BellRing }] },
    { key: 'sales', label: 'Sales', items: [{ label: 'Payments', path: '/review-payment', icon: CreditCard, badge: actionBadges.payments }, { label: 'Payment methods', path: '/payment-methods', icon: CreditCard }, { label: 'Promo codes', path: '/promo-codes', icon: BadgePercent }] },
  ]
  const standaloneItems = [{ label: 'Analytics', path: '/analytics', icon: BarChart3 }, { label: 'Settings', path: '/settings', icon: Settings }]
  const activeGroupKey = navigationGroups.find((group) => group.items.some((item) => isActive(item.path)))?.key
  const compactItems = [dashboardItem, ...navigationGroups.flatMap((group) => group.items), ...standaloneItems]
  const isGroupExpanded = (key) => key === activeGroupKey || expandedGroups[key]
  const toggleGroup = (key) => { if (key !== activeGroupKey) setExpandedGroups((current) => ({ ...current, [key]: !current[key] })) }

  const renderItem = (item, nested = false) => {
    const Icon = item.icon
    const active = isActive(item.path)
    return <button key={item.path} type="button" onClick={() => handleNavigate(item.path)} className={`group flex w-full items-center gap-3 rounded-xl text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#F8C56A]/70 ${nested ? 'px-3 py-2.5' : 'px-3 py-3'} ${!isOpen ? 'md:justify-center md:px-0' : ''} ${active ? 'bg-[#E58C1A] font-bold text-white shadow-lg shadow-black/15' : 'font-medium text-white/70 hover:bg-white/10 hover:text-white'}`} title={!isOpen ? item.label : ''}><Icon size={nested ? 17 : 19} className={`shrink-0 ${active ? 'text-white' : 'text-[#F8C56A] group-hover:text-[#F8C56A]'}`} />{isOpen ? <span className="truncate">{item.label}</span> : null}{isOpen && item.badge > 0 ? <span className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white text-[#C97112]' : 'bg-[#F8C56A] text-[#2D2E30]'}`}>{item.badge > 99 ? '99+' : item.badge}</span> : null}</button>
  }

  return <aside className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[#E58C1A]/15 bg-[#2D2E30] text-white shadow-2xl shadow-[#2D2E30]/20 transition-all duration-300 md:relative md:z-auto md:translate-x-0 md:shadow-none ${isOpen ? 'w-72 translate-x-0 md:w-64' : 'w-72 -translate-x-full md:w-[5.5rem]'}`} aria-label="Admin navigation"><div className="flex min-h-24 items-center border-b border-white/10 px-5">{isOpen ? <div className="flex min-w-0 flex-1 items-center gap-3"><img src="/images/Arun-thai-web-logo.png" alt="Arun Thai" className="h-11 w-11 shrink-0 rounded-xl object-contain" /><div className="min-w-0"><h1 className="truncate text-base font-bold tracking-tight text-white">Arun Thai</h1><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F8C56A]">Admin portal</p></div></div> : <img src="/images/Arun-thai-web-logo.png" alt="Arun Thai" className="mx-auto h-11 w-11 shrink-0 rounded-xl object-contain" />}</div><nav className={`admin-sidebar-scroll flex-1 overflow-y-auto py-5 ${isOpen ? 'px-3' : 'space-y-1 px-3 md:px-2'}`}>{isOpen ? <><p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Workspace</p>{renderItem(dashboardItem)}<div className="mt-3 space-y-1">{navigationGroups.map((group) => { const expanded = isGroupExpanded(group.key); const groupIsActive = group.key === activeGroupKey; return <div key={group.key}><button type="button" onClick={() => toggleGroup(group.key)} aria-expanded={expanded} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold uppercase tracking-[0.12em] transition focus:outline-none focus:ring-2 focus:ring-[#F8C56A]/70 ${groupIsActive ? 'text-[#F8C56A]' : 'text-white/50 hover:bg-white/10 hover:text-white/80'}`}><span className="flex-1">{group.label}</span>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>{expanded ? <div className="ml-2 space-y-1 border-l border-white/10 pl-2">{group.items.map((item) => renderItem(item, true))}</div> : null}</div> })}</div><div className="mt-4 border-t border-white/10 pt-3">{standaloneItems.map((item) => renderItem(item))}</div></> : compactItems.map((item) => renderItem(item))}</nav><div className="border-t border-white/10 p-3"><button type="button" onClick={handleLogout} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#F8C56A]/70 ${!isOpen ? 'md:justify-center md:px-0' : ''}`} title={!isOpen ? 'Logout' : ''}><LogOut size={19} className="shrink-0 text-[#F8C56A]" />{isOpen ? <span>Logout</span> : null}</button></div></aside>
}

export default Sidebar
