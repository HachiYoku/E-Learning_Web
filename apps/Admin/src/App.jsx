import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom'
import { useState } from 'react'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import Sidebar from './components/Sidebar'
import TopNav from './components/TopNav'
import Courses from './pages/CourseManagement/Courses'
import AddCourse from './pages/CourseManagement/AddCourse'
import EditCourse from './pages/CourseManagement/EditCourse'
import CourseDetail from './pages/CourseManagement/CourseDetail'
import AddLesson from './pages/CourseManagement/AddLesson'
import EditLesson from './pages/CourseManagement/EditLesson'
import Users from './pages/UserManagement/Users'
import Blogs from './pages/BlogManagement/Blogs'
import AddBlog from './pages/BlogManagement/AddBlog'
import EditBlog from './pages/BlogManagement/EditBlog'
import ReviewPayment from './pages/Payment/ReviewPayment'
import Instructors from './pages/InstructorManagement/Instructors'
import Analytics from './pages/Reports/Analytics'
import Settings from './pages/Settings/GeneralSettings'
import AdminProfile from './pages/AdminProfile'
import NotFound from './pages/NotFound'
import RequireAdmin from './routes/RequireAdmin'

function ProtectedLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen((current) => !current)} />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route element={<RequireAdmin />}>
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/add" element={<AddCourse />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/courses/:id/add-lesson" element={<AddLesson />} />
            <Route path="/courses/:id/edit-lesson/:lessonId" element={<EditLesson />} />
            <Route path="/courses/edit/:id" element={<EditCourse />} />
            <Route path="/users" element={<Users />} />
            <Route path="/blog" element={<Blogs />} />
            <Route path="/blog/add" element={<AddBlog />} />
            <Route path="/blog/edit/:id" element={<EditBlog />} />
            <Route path="/review-payment" element={<ReviewPayment />} />
            <Route path="/instructors" element={<Instructors />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin-profile" element={<AdminProfile />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  )
}

export default App
