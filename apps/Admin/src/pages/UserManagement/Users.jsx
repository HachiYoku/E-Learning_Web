import { Plus, Trash2, Eye, EyeOff, X, Check, Copy, KeyRound, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchCourses } from '../../services/courseService'
import { deleteUser, fetchUsers, updateUserCourseAccess, updateUserStatus } from '../../services/userService'

function SecureUserActionModal({ action, user, password, error, success, saving, onPasswordChange, onConfirm, onClose }) {
  if (!action || !user) return null

  const isDelete = action === 'delete'
  const isDeactivating = action === 'deactivate'
  const title = isDelete ? 'Delete user account' : isDeactivating ? 'Deactivate user account' : 'Activate user account'
  const description = isDelete
    ? 'This permanently removes the account, course enrollments, and payment records.'
    : isDeactivating
      ? 'The student will not be able to sign in until the account is activated again.'
      : 'The student will be able to sign in and continue learning again.'
  const confirmText = isDelete ? 'Delete account' : isDeactivating ? 'Deactivate account' : 'Activate account'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/60 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-2xl shadow-[#2D2E30]/30" role="dialog" aria-modal="true" aria-labelledby="secure-user-action-title">
        <div className={`border-b p-5 sm:p-6 ${isDelete ? 'border-[#A34D45]/15 bg-[#FFF0EE]' : 'border-[#E58C1A]/15 bg-[#FFF9EA]'}`}>
          <div className="flex items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${isDelete ? 'bg-[#FFE1DD] text-[#A34D45]' : 'bg-[#FFF1CE] text-[#C97112]'}`}>
              {isDelete ? <Trash2 size={20} /> : <ShieldAlert size={21} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDelete ? 'text-[#A34D45]' : 'text-[#C97112]'}`}>Protected action</p>
              <h2 id="secure-user-action-title" className="mt-1 text-lg font-bold text-[#2D2E30] sm:text-xl">{title}</h2>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-1 text-[#765F55] transition hover:bg-white/70 hover:text-[#2D2E30] disabled:opacity-50" aria-label="Close dialog"><X size={20} /></button>
          </div>
        </div>

        <form onSubmit={onConfirm}>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="rounded-xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-4">
              <p className="font-semibold text-[#2D2E30]">{user.name}</p>
              <p className="mt-0.5 break-all text-sm text-[#765F55]">{user.email}</p>
            </div>
            <p className="text-sm leading-6 text-[#765F55]">{description}</p>
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-[#7AB589]/30 bg-[#EDF8EE] px-3 py-2.5 text-sm text-[#246B35]">{success}</div> : null}
            <label className="block text-sm font-bold text-[#2D2E30]">
              <span className="mb-2 flex items-center gap-2"><KeyRound size={16} className="text-[#C97112]" /> Confirm admin password</span>
              <input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} autoFocus disabled={saving} autoComplete="current-password" placeholder="Enter your password" className="w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3.5 py-3 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 disabled:bg-[#F5F1EA]" />
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:flex-row sm:gap-3 sm:p-5">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D2E30] transition hover:bg-[#FFF4D8] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving || Boolean(success)} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${isDelete ? 'bg-[#A34D45] hover:bg-[#8D4039]' : 'bg-[#2D2E30] hover:bg-[#E58C1A]'}`}>{saving ? 'Confirming…' : confirmText}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Users() {
  const [users, setUsers] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [secureAction, setSecureAction] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [addCourseModalOpen, setAddCourseModalOpen] = useState(false)
  const [selectedUserForCourse, setSelectedUserForCourse] = useState(null)
  const [selectedCourses, setSelectedCourses] = useState([])
  const [adminPassword, setAdminPassword] = useState("")
  const [modalError, setModalError] = useState("")
  const [modalSuccess, setModalSuccess] = useState("")
  const [copiedEmail, setCopiedEmail] = useState("")
  const [actionSaving, setActionSaving] = useState(false)

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

  const systemUsers = filteredUsers.filter((user) => user.recordType === "system")
  const displayedRecords = systemUsers

  const handleDeleteClick = (userId) => {
    setSelectedUserId(userId)
    setAdminPassword("")
    setModalError("")
    setModalSuccess("")
    setSecureAction('delete')
  }

  const closeSecureAction = () => {
    if (actionSaving) return
    setAdminPassword('')
    setModalError('')
    setModalSuccess('')
    setSecureAction(null)
    setSelectedUserId(null)
  }

  const handleConfirmDelete = async (event) => {
    event.preventDefault()
    if (!adminPassword.trim()) {
      setModalError('Please enter your admin password to continue.')
      return
    }
    try {
      setActionSaving(true)
      setModalError('')
      await deleteUser(selectedUserId, adminPassword)
      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== selectedUserId))
      setModalSuccess('User account deleted successfully.')
      setAdminPassword("")
      setTimeout(() => {
        setSecureAction(null)
        setModalSuccess('')
        setSelectedUserId(null)
      }, 1200)
    } catch (deleteError) {
      if (deleteError && deleteError.status === 403) {
        setModalError('Incorrect admin password. Please try again.')
      } else {
        setModalError(deleteError?.message || 'Unable to delete user. Please try again.')
      }
    } finally {
      setActionSaving(false)
    }
  }

  const handleDeactivateClick = (userId) => {
    setSelectedUserId(userId)
    setAdminPassword('')
    setModalError('')
    setModalSuccess('')
    setSecureAction('status')
  }

  const handleConfirmDeactivate = async (event) => {
    event.preventDefault()
    if (!adminPassword.trim()) {
      setModalError('Please enter your admin password to continue.')
      return
    }
    try {
      const user = users.find((item) => item.id === selectedUserId)
      if (!user) {
        return
      }

      setActionSaving(true)
      setModalError('')
      await updateUserStatus(selectedUserId, !user.isActive, adminPassword)
      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.id === selectedUserId
            ? { ...item, isActive: !item.isActive }
            : item
        )
      )
      setAdminPassword('')
      setModalSuccess(user.isActive ? 'User account deactivated successfully.' : 'User account activated successfully.')
      setTimeout(() => {
        setSecureAction(null)
        setModalSuccess('')
        setSelectedUserId(null)
      }, 1200)
    } catch (statusError) {
      setModalError(statusError?.status === 403 ? 'Incorrect admin password. Please try again.' : statusError.message)
    } finally {
      setActionSaving(false)
    }
  }

  const handleOpenAddCourseModal = (user) => {
    setSelectedUserForCourse(user)
    setSelectedCourses(
      user.purchasedCourses
        .map((course) => course.id)
        .filter(Boolean)
    )
    setAdminPassword("")
    setModalError("")
    setModalSuccess("")
    setAddCourseModalOpen(true)
  }

  const handleAddCourseToUser = async () => {
    try {
      // clear previous modal messages
      setModalError("")
      setModalSuccess("")

      if (!adminPassword || adminPassword.trim() === "") {
        setModalError("Please enter your admin password to confirm changes.")
        return
      }

      const updatedUser = await updateUserCourseAccess(selectedUserForCourse.id, selectedCourses, adminPassword)

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === updatedUser.id ? updatedUser : user
        )
      )

      // show a friendly success message inside modal then close
      setModalSuccess("Course access updated successfully.")
      setAdminPassword("")

      setTimeout(() => {
        setAddCourseModalOpen(false)
        setSelectedCourses([])
        setSelectedUserForCourse(null)
        setModalSuccess("")
      }, 1200)
    } catch (courseAccessError) {
      // map common errors to friendly messages
      if (courseAccessError && courseAccessError.status === 403) {
        setModalError("Incorrect admin password. Please try again.")
      } else {
        setModalError(courseAccessError?.message || "Unable to save changes. Please try again.")
      }
    }
  }

  const toggleCourseSelection = (courseId) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    )
  }

  const copyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email)
      setCopiedEmail(email)
      window.setTimeout(() => setCopiedEmail(""), 1600)
    } catch {
      setError("Unable to copy the email address.")
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112] sm:text-xs">Community</p>
        <h1 className="mb-2 mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl md:text-4xl">Manage users</h1>
        <p className="mb-4 text-sm text-[#765F55] md:mb-6">Registered student accounts and course access controls.</p>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-[#2D2E30]/15 bg-white px-3 py-2.5 pr-10 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 sm:px-4"
            />
            <svg className="absolute right-3 top-3 h-4 w-4 text-[#C97112] sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2D2E30]/10 bg-[#FFF9EA]">
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#765F55] sm:px-4 md:px-6 sm:py-4 sm:text-sm">Name</th>
              <th className="hidden px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#765F55] sm:table-cell sm:px-4 md:px-6 sm:py-4 sm:text-sm">Email</th>
              <th className="hidden px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#765F55] md:table-cell sm:px-4 md:px-6 sm:py-4 sm:text-sm">Date created</th>
              <th className="hidden px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#765F55] lg:table-cell sm:px-4 md:px-6 sm:py-4 sm:text-sm">Purchased courses</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#765F55] sm:px-4 md:px-6 sm:py-4 sm:text-sm">Action</th>
            </tr>
          </thead>
          <tbody>
            {displayedRecords.map((user) => (
              <tr key={user.id} className={`border-b border-[#2D2E30]/8 transition-colors ${user.isActive ? 'hover:bg-[#FFF4D8]/45' : 'bg-[#F5F1EA] opacity-60'}`}>
                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className={`h-8 w-8 rounded-full border border-[#E58C1A]/25 object-cover sm:h-10 sm:w-10 ${!user.isActive ? 'opacity-50' : ''}`}
                      />
                      {!user.isActive ? (
                        <div className="absolute inset-0 rounded-full bg-black bg-opacity-40 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">×</span>
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <span className={`block whitespace-normal break-words font-semibold text-xs sm:text-sm ${user.isActive ? 'text-[#2D2E30]' : 'text-[#765F55]'}`}>{user.name}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-[#765F55] sm:hidden">
                        <span className="max-w-36 truncate">{user.email}</span>
                        <button type="button" onClick={() => copyEmail(user.email)} className="rounded p-0.5 hover:bg-gray-100" title="Copy email address" aria-label={`Copy ${user.email}`}>
                          {copiedEmail === user.email ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                        </button>
                      </span>
                      {!user.isActive ? <div className="text-xs text-red-500 font-semibold">Inactive</div> : null}
                    </div>
                  </div>
                </td>
                <td className={`hidden sm:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm ${user.isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                  <div className="flex min-w-[11rem] items-center gap-2">
                    <span className="truncate">{user.email}</span>
                    <button type="button" onClick={() => copyEmail(user.email)} className="shrink-0 rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900" title="Copy email address" aria-label={`Copy ${user.email}`}>
                      {copiedEmail === user.email ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                    </button>
                  </div>
                </td>
                <td className={`hidden md:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm ${user.isActive ? 'text-gray-700' : 'text-gray-400'}`}>{user.dateCreated}</td>
                <td className={`hidden lg:table-cell px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm ${user.isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                  <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-[#FFF1CE] px-2 py-1 font-bold text-[#C97112]">{user.purchasedCourses.length}</span>
                </td>
                <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <button
                      onClick={() => handleOpenAddCourseModal(user)}
                      disabled={!user.isActive}
                      className={`shrink-0 rounded-lg p-1.5 transition-colors sm:p-2 ${user.isActive ? 'bg-[#2D2E30] text-white hover:bg-[#E58C1A]' : 'cursor-not-allowed bg-gray-300 text-gray-500'}`}
                      title="Manage course access"
                    >
                      <Plus size={14} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                    <button
                      onClick={() => handleDeactivateClick(user.id)}
                      className={`shrink-0 rounded-lg p-1.5 transition-colors sm:p-2 ${user.isActive ? 'text-[#246B35] hover:bg-[#EDF8EE]' : 'text-[#A34D45] hover:bg-[#FFF0EE]'}`}
                      title={user.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {user.isActive ? <Eye size={14} className="sm:w-[18px] sm:h-[18px]" /> : <EyeOff size={14} className="sm:w-[18px] sm:h-[18px]" />}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user.id)}
                      className="shrink-0 rounded-lg p-1.5 text-[#A34D45] transition-colors hover:bg-[#FFF0EE] sm:p-2"
                      title="Delete"
                    >
                      <Trash2 size={14} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && displayedRecords.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SecureUserActionModal
        action={secureAction === 'delete' ? 'delete' : secureAction === 'status' && users.find((user) => user.id === selectedUserId)?.isActive ? 'deactivate' : secureAction === 'status' ? 'activate' : null}
        user={users.find((user) => user.id === selectedUserId)}
        password={adminPassword}
        error={modalError}
        success={modalSuccess}
        saving={actionSaving}
        onPasswordChange={setAdminPassword}
        onConfirm={secureAction === 'delete' ? handleConfirmDelete : handleConfirmDeactivate}
        onClose={closeSecureAction}
      />

      {addCourseModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/55 p-4">
          <div className="mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-2xl shadow-[#2D2E30]/25" role="dialog" aria-modal="true" aria-labelledby="course-access-title">
            <div className="flex items-center justify-between border-b border-[#E58C1A]/15 bg-[#FFF9EA] p-4 sm:p-6">
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C97112]">Student access</p><h2 id="course-access-title" className="mt-1 truncate text-base font-bold text-[#2D2E30] sm:text-lg">Manage {selectedUserForCourse?.name}'s courses</h2></div>
              <button
                type="button"
                onClick={() => { setAdminPassword(""); setAddCourseModalOpen(false); }}
                className="shrink-0 rounded-lg p-1 text-[#765F55] transition-colors hover:bg-white/70 hover:text-[#2D2E30]"
                aria-label="Close course access dialog"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto p-4 sm:max-h-96 sm:p-6">
              <div className="space-y-2 sm:space-y-3">
                {courses.map((course) => (
                  <label key={course.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${selectedCourses.includes(course.id) ? 'border-[#E58C1A]/35 bg-[#FFF9EA]' : 'border-[#2D2E30]/10 bg-white hover:bg-[#FFFDF8]'}`}>
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(course.id)}
                      onChange={() => toggleCourseSelection(course.id)}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#2D2E30]/20 text-[#E58C1A] focus:ring-[#E58C1A]/30 sm:h-5 sm:w-5"
                    />
                    <span className="flex-1 text-xs font-semibold text-[#2D2E30] sm:text-sm">{course.title}</span>
                    {selectedCourses.includes(course.id) ? (
                      <Check size={16} className="shrink-0 text-[#C97112] sm:h-[18px] sm:w-[18px]" />
                    ) : null}
                  </label>
                ))}
              </div>
            </div>

            <div className="px-4 pb-4 sm:px-6 sm:pb-6">
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
                placeholder="Enter your admin password to confirm changes"
                className="w-full rounded-xl border border-[#2D2E30]/15 px-3 py-2.5 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:flex-row sm:gap-3 sm:p-6">
              <button
                onClick={() => { setAdminPassword(""); setAddCourseModalOpen(false); }}
                className="flex-1 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D2E30] transition-colors hover:bg-[#FFF4D8]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCourseToUser}
                className="flex-1 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#E58C1A]"
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
