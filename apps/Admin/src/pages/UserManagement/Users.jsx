import { Plus, Trash2, Eye, EyeOff, X, Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ConfirmationModal from '../../components/ConfirmationModal'
import { fetchCourses } from '../../services/courseService'
import { deleteUser, fetchUsers, updateUserCourseAccess, updateUserStatus } from '../../services/userService'

function Users() {
  const [users, setUsers] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [addCourseModalOpen, setAddCourseModalOpen] = useState(false)
  const [selectedUserForCourse, setSelectedUserForCourse] = useState(null)
  const [selectedCourses, setSelectedCourses] = useState([])

  useEffect(() => {
    async function loadUserManagementData() {
      try {
        setLoading(true)
        setError('')

        const [usersResponse, coursesResponse] = await Promise.all([
          fetchUsers(),
          fetchCourses(),
        ])

        setUsers(usersResponse)
        setCourses(coursesResponse)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadUserManagementData()
  }, [])

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [searchTerm, users]
  )

  const handleDeleteClick = (userId) => {
    setSelectedUserId(userId)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    try {
      await deleteUser(selectedUserId)
      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== selectedUserId))
      setDeleteModalOpen(false)
      setSelectedUserId(null)
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const handleDeactivateClick = (userId) => {
    setSelectedUserId(userId)
    setDeactivateModalOpen(true)
  }

  const handleConfirmDeactivate = async () => {
    try {
      const user = users.find((item) => item.id === selectedUserId)
      if (!user) {
        return
      }

      await updateUserStatus(selectedUserId, !user.isActive)
      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.id === selectedUserId
            ? { ...item, isActive: !item.isActive }
            : item
        )
      )

      setDeactivateModalOpen(false)
      setSelectedUserId(null)
    } catch (statusError) {
      setError(statusError.message)
    }
  }

  const handleOpenAddCourseModal = (user) => {
    setSelectedUserForCourse(user)
    setSelectedCourses(
      user.purchasedCourses
        .map((course) => course.id)
        .filter(Boolean)
    )
    setAddCourseModalOpen(true)
  }

  const handleAddCourseToUser = async () => {
    try {
      const updatedUser = await updateUserCourseAccess(selectedUserForCourse.id, selectedCourses)

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === updatedUser.id ? updatedUser : user
        )
      )

      setAddCourseModalOpen(false)
      setSelectedCourses([])
      setSelectedUserForCourse(null)
    } catch (courseAccessError) {
      setError(courseAccessError.message)
    }
  }

  const toggleCourseSelection = (courseId) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    )
  }

  const getCourseTitles = (userCourses) => {
    return userCourses.map((course) => course.title).join(', ')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">Manage user</h1>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <svg className="absolute right-3 top-2.5 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-pink-200 border-b border-pink-300">
              <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Name</th>
              <th className="hidden sm:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Email</th>
              <th className="hidden md:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Date created</th>
              <th className="hidden lg:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Purchased Course</th>
              <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className={`border-b border-gray-200 transition-colors ${user.isActive ? 'hover:bg-gray-50' : 'bg-gray-100 opacity-60'}`}>
                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover ${!user.isActive ? 'opacity-50' : ''}`}
                      />
                      {!user.isActive ? (
                        <div className="absolute inset-0 rounded-full bg-black bg-opacity-40 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">×</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <span className={`font-medium text-xs sm:text-sm truncate block ${user.isActive ? 'text-gray-900' : 'text-gray-500'}`}>{user.name}</span>
                      {!user.isActive ? <div className="text-xs text-red-500 font-semibold">Inactive</div> : null}
                    </div>
                  </div>
                </td>
                <td className={`hidden sm:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm truncate ${user.isActive ? 'text-gray-700' : 'text-gray-400'}`}>{user.email}</td>
                <td className={`hidden md:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm ${user.isActive ? 'text-gray-700' : 'text-gray-400'}`}>{user.dateCreated}</td>
                <td className={`hidden lg:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm ${user.isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                  {user.purchasedCourses.length > 0 ? getCourseTitles(user.purchasedCourses) : 'N/A'}
                </td>
                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <button
                      onClick={() => handleOpenAddCourseModal(user)}
                      disabled={!user.isActive}
                      className={`p-1.5 sm:p-2 rounded-lg transition-colors shrink-0 ${user.isActive ? 'bg-gray-800 text-white hover:bg-gray-900' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                      title="Manage course access"
                    >
                      <Plus size={14} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                    <button
                      onClick={() => handleDeactivateClick(user.id)}
                      className={`p-1.5 sm:p-2 rounded-lg transition-colors shrink-0 ${user.isActive ? 'text-green-600 hover:bg-green-100' : 'text-red-600 hover:bg-red-100'}`}
                      title={user.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {user.isActive ? <Eye size={14} className="sm:w-[18px] sm:h-[18px]" /> : <EyeOff size={14} className="sm:w-[18px] sm:h-[18px]" />}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user.id)}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors shrink-0"
                      title="Delete"
                    >
                      <Trash2 size={14} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
        isDangerous={true}
      />

      <ConfirmationModal
        isOpen={deactivateModalOpen}
        title={users.find((user) => user.id === selectedUserId)?.isActive ? 'Deactivate User' : 'Activate User'}
        message={users.find((user) => user.id === selectedUserId)?.isActive 
          ? 'Are you sure you want to deactivate this user? They will not be able to access their account.'
          : 'Are you sure you want to activate this user? They will be able to access their account again.'
        }
        confirmText={users.find((user) => user.id === selectedUserId)?.isActive ? 'Deactivate' : 'Activate'}
        cancelText="Cancel"
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivateModalOpen(false)}
        isDangerous={users.find((user) => user.id === selectedUserId)?.isActive}
      />

      {addCourseModalOpen ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Manage {selectedUserForCourse?.name}'s course access</h2>
              <button
                onClick={() => setAddCourseModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 max-h-64 sm:max-h-96 overflow-y-auto">
              <div className="space-y-2 sm:space-y-3">
                {courses.map((course) => (
                  <label key={course.id} className="flex items-center gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(course.id)}
                      onChange={() => toggleCourseSelection(course.id)}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500 rounded focus:ring-pink-300 cursor-pointer shrink-0"
                    />
                    <span className="text-xs sm:text-sm text-gray-700 font-medium flex-1">{course.title}</span>
                    {selectedCourses.includes(course.id) ? (
                      <Check size={16} className="sm:w-[18px] sm:h-[18px] text-pink-500 shrink-0" />
                    ) : null}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setAddCourseModalOpen(false)}
                className="flex-1 px-4 py-2 text-gray-700 font-medium text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCourseToUser}
                className="flex-1 px-4 py-2 bg-pink-500 text-white font-medium text-sm rounded-lg hover:bg-pink-600 transition-colors"
              >
                Save Access
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Users
