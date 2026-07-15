import { BookOpen, FileText, Users, CreditCard, Trash2} from 'lucide-react'
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)

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
    setDeleteModalOpen(true)
  }

  const handleDeleteUser = async () => {
    try {
      await deleteUser(selectedUserId)
      setRecentUsers((currentUsers) => currentUsers.filter((user) => user.id !== selectedUserId))
      setStats((currentStats) =>
        currentStats.map((stat) =>
          stat.label === 'User'
            ? { ...stat, value: String(Math.max(0, Number(stat.value) - 1)) }
            : stat
        )
      )
      setDeleteModalOpen(false)
      setSelectedUserId(null)
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-6 md:mb-8">Mind Ploy English Administration Dashboard</h1>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8">
        {(loading ? [] : stats).map((stat, index) => {
          const Icon = stat.icon
          return (
            <button
              key={index}
              type="button"
              onClick={() => navigate(stat.path)}
              className="bg-pink-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow text-left focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="p-2 sm:p-3 bg-pink-200 rounded-lg shrink-0">
                  <Icon size={20} className="sm:w-6 sm:h-6 text-gray-700" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{stat.label}</h3>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">{stat.value}</p>
              <p className="text-xs sm:text-sm text-gray-600">{stat.lastUpdated}</p>
            </button>
          )
        })}

        {loading ? (
          <div className="col-span-full rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
            Loading dashboard...
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-pink-100 border-b border-pink-200">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Recent Joined:</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-pink-50 border-b border-pink-200">
                <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Name</th>
                <th className="hidden sm:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Email</th>
                <th className="hidden md:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Date created</th>
                <th className="hidden lg:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Purchased Course</th>
                <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((user, index) => (
                <tr key={user.id} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-pink-50 transition-colors`}>
                  <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0"
                      />
                      <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">{user.name}</span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 truncate">{user.email}</td>
                  <td className="hidden md:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">{user.dateCreated}</td>
                  <td className="hidden lg:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">
                    {user.purchasedCourses.length > 0
                      ? user.purchasedCourses.map((course) => course.title).join(', ')
                      : 'N/A'}
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => handleDeleteClick(user.id)}
                        className="p-1.5 sm:p-2 hover:bg-red-50 rounded-lg transition-colors"
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

      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteUser}
        onCancel={() => {
          setDeleteModalOpen(false)
          setSelectedUserId(null)
        }}
        isDangerous={true}
      />
    </div>
  )
}

export default Dashboard
