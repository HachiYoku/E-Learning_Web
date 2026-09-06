import { BookOpen, FileText, Users, CreditCard, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmationModal from '../components/ConfirmationModal'
import { fetchCourses } from '../services/courseService'
import { fetchAllPayments } from '../services/paymentService'
import { fetchUsers, deleteUser } from '../services/userService'
import { apiClient } from '../api/client'

function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState([])
  const [recentUsers, setRecentUsers] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // ask for admin password before delete (same pattern as Users page)
  const [confirmDeletePasswordOpen, setConfirmDeletePasswordOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [adminPassword, setAdminPassword] = useState("")
  const [modalError, setModalError] = useState("")
  const [modalSuccess, setModalSuccess] = useState("")

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true)
        setError('')

        const [courses, blogs, users, payments] = await Promise.all([
          fetchCourses(),
          apiClient.get('/blogs'),
          fetchUsers(),
          fetchAllPayments(),
        ])

        const latestCourse = courses[0]
        const latestBlog = blogs[0]
        const latestUser = users[0]
        const latestPayment = payments[0]

        setStats([
          {
            label: 'Course',
            value: String(courses.length),
            icon: BookOpen,
            path: '/courses',
            lastUpdated: latestCourse ? `Last created: ${latestCourse.title}` : 'No courses yet'
          },
          {
            label: 'Blog',
            value: String(blogs.length),
            icon: FileText,
            path: '/blog',
            lastUpdated: latestBlog ? `Last created: ${latestBlog.title}` : 'No blogs yet'
          },
          {
            label: 'User',
            value: String(users.length),
            icon: Users,
            path: '/users',
            lastUpdated: latestUser ? `Last joined: ${latestUser.name}` : 'No users yet'
          },
          {
            label: 'Payment',
            value: String(payments.length),
            icon: CreditCard,
            path: '/review-payment',
            lastUpdated: latestPayment ? `Last reviewed: ${latestPayment.courseName}` : 'No payments yet'
          },
        ])

        setRecentUsers(users.slice(0, 5))
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const handleDeleteClick = (userId) => {
    setSelectedUserId(userId)
    // reset password and modal messages then prompt for admin password
    setAdminPassword("")
    setModalError("")
    setModalSuccess("")
    setConfirmDeletePasswordOpen(true)
  }
  
  const handleDeleteUser = async () => {
    try {
      await deleteUser(selectedUserId, adminPassword)

      // update UI on success
      setRecentUsers((currentUsers) => currentUsers.filter((user) => user.id !== selectedUserId))
      setStats((currentStats) =>
        currentStats.map((stat) =>
          stat.label === 'User'
            ? { ...stat, value: String(Math.max(0, Number(stat.value) - 1)) }
            : stat
        )
      )

      setModalSuccess("User deleted successfully.")
      setAdminPassword("")

      // close modal after a short delay
      setTimeout(() => {
        setConfirmDeletePasswordOpen(false)
        setModalSuccess("")
        setSelectedUserId(null)
      }, 1200)
    } catch (deleteError) {
      // show error inside modal
      if (deleteError && deleteError.status === 403) {
        setModalError("Incorrect admin password. Please try again.")
      } else {
        setModalError(deleteError?.message || "Unable to delete user. Please try again.")
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8">
      <div className="mb-6 sm:mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112] sm:text-xs">Admin workspace</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl md:text-4xl">Arun Thai Administration Dashboard</h1>
        <p className="mt-2 text-sm text-[#765F55] sm:text-base">A quick view of your learning platform.</p>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:mb-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 md:gap-6">
        {(loading ? [] : stats).map((stat, index) => {
          const Icon = stat.icon
          return (
            <button
              key={index}
              type="button"
              onClick={() => navigate(stat.path)}
              className="group relative overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white p-4 text-left shadow-[0_12px_30px_-24px_rgba(45,46,48,0.55)] transition-all hover:-translate-y-1 hover:border-[#E58C1A]/35 hover:shadow-[0_20px_38px_-24px_rgba(201,113,18,0.4)] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]/60 sm:p-5"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[#E58C1A]" />
              <div className="mb-4 flex items-center gap-3 pt-1 sm:gap-4">
                <div className="shrink-0 rounded-xl bg-[#FFF1CE] p-2.5 text-[#C97112] transition-colors group-hover:bg-[#E58C1A] group-hover:text-white sm:p-3">
                  <Icon size={20} className="sm:h-6 sm:w-6" />
                </div>
                <h3 className="text-lg font-bold text-[#2D2E30] sm:text-xl">{stat.label}</h3>
              </div>
              <p className="mb-1 text-3xl font-bold tracking-tight text-[#2D2E30] sm:mb-2 sm:text-4xl">{stat.value}</p>
              <p className="truncate text-xs text-[#765F55] sm:text-sm">{stat.lastUpdated}</p>
            </button>
          )
        })}

        {loading ? (
          <div className="col-span-full rounded-2xl border border-[#2D2E30]/10 bg-white p-8 text-center text-[#765F55] shadow-sm">
            Loading dashboard...
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)]">
        <div className="border-b border-[#E58C1A]/15 bg-[#FFF9EA] px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C97112]">Community</p>
          <h2 className="mt-1 text-lg font-bold text-[#2D2E30] sm:text-xl">Recently joined</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2D2E30]/10 bg-[#FFFDF8]">
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#765F55] sm:px-4 md:px-6 sm:py-4 sm:text-sm">Name</th>
                <th className="hidden px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#765F55] sm:table-cell sm:px-4 md:px-6 sm:py-4 sm:text-sm">Email</th>
                <th className="hidden px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#765F55] md:table-cell sm:px-4 md:px-6 sm:py-4 sm:text-sm">Date created</th>
                <th className="hidden px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#765F55] lg:table-cell sm:px-4 md:px-6 sm:py-4 sm:text-sm">Purchased Course</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#765F55] sm:px-4 md:px-6 sm:py-4 sm:text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((user, index) => (
                <tr key={user.id} className={`border-b border-[#2D2E30]/8 ${index % 2 === 0 ? 'bg-white' : 'bg-[#FFFDF8]'} transition-colors hover:bg-[#FFF4D8]/45`}>
                  <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="h-7 w-7 shrink-0 rounded-full border border-[#E58C1A]/25 object-cover sm:h-8 sm:w-8"
                      />
                      <span className="truncate text-xs font-semibold text-[#2D2E30] sm:text-sm">{user.name}</span>
                    </div>
                  </td>
                  <td className="hidden truncate px-3 py-3 text-xs text-[#765F55] sm:table-cell sm:px-4 md:px-6 sm:py-4 sm:text-sm">{user.email}</td>
                  <td className="hidden px-3 py-3 text-xs text-[#765F55] md:table-cell sm:px-4 md:px-6 sm:py-4 sm:text-sm">{user.dateCreated}</td>
                  <td className="hidden px-3 py-3 text-xs text-[#765F55] lg:table-cell sm:px-4 md:px-6 sm:py-4 sm:text-sm">
                    <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-[#FFF1CE] px-2 py-1 font-bold text-[#C97112]">
                      {user.purchasedCourses.length}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => handleDeleteClick(user.id)}
                        className="rounded-lg p-1.5 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 sm:p-2"
                        title="Delete user"
                      >
                        <Trash2 size={16} className="sm:w-[18px] sm:h-[18px] text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && recentUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prompt for admin password before deleting user (shows friendly messages inside modal) */}
      {confirmDeletePasswordOpen ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="mx-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#2D2E30]/10 bg-[#FFF9EA] p-4 sm:p-6">
              <h2 className="text-base font-bold text-[#2D2E30] sm:text-lg md:text-xl">Confirm admin password</h2>
              <button
                onClick={() => { setAdminPassword(''); setModalError(''); setConfirmDeletePasswordOpen(false); }}
                className="shrink-0 rounded-lg p-1 text-[#765F55] transition-colors hover:bg-[#FFF1CE] hover:text-[#2D2E30]"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {modalError ? (
                <div className="mb-3 rounded px-3 py-2 bg-red-50 text-red-700 text-sm">{modalError}</div>
              ) : null}

              {modalSuccess ? (
                <div className="mb-3 rounded px-3 py-2 bg-green-50 text-green-700 text-sm">{modalSuccess}</div>
              ) : null}

              <label className="mb-2 block text-xs font-bold text-[#2D2E30] sm:text-sm">Confirm admin password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter your admin password to confirm"
                className="w-full rounded-xl border border-[#2D2E30]/15 px-3 py-2.5 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10"
              />
            </div>

            <div className="flex gap-2 border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:gap-3 sm:p-6">
              <button
                onClick={() => { setAdminPassword(''); setModalError(''); setConfirmDeletePasswordOpen(false); }}
                className="flex-1 rounded-xl border border-[#2D2E30]/15 px-4 py-2.5 text-sm font-semibold text-[#2D2E30] transition-colors hover:bg-[#FFF4D8]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setModalError('')
                  if (!adminPassword || adminPassword.trim() === "") {
                    setModalError('Please enter your admin password to confirm.')
                    return
                  }

                  try {
                    await handleDeleteUser()
                  } catch (e) {
                    // handleDeleteUser sets modalError
                  }
                }}
                className="flex-1 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E58C1A]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Dashboard
