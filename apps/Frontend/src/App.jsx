import { Navigate, Routes, Route, useLocation, useParams } from 'react-router-dom'
import Home from "./pages/Home"
import Login from "./pages/Login"
import Register from "./pages/Register"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import VerificationHelp from "./pages/VerificationHelp"
import Courses from "./pages/Courses"
import CourseDetail from "./pages/CourseDetail"
import Enroll from "./pages/Enroll"
import Payment from "./pages/Payment"
import MyCourses from "./pages/MyCourses"
import MyCourseOrder from "./pages/MyCourseOrder"
import MyProfile from "./pages/MyProfile"
import Notifications from "./pages/Notifications"
import CourseLessons from "./pages/CourseLessons"
import OrderStatus from "./pages/OrderStatus"
import Blog from "./pages/Blog"
import Practice from "./pages/Practice"
import About from "./pages/About"
import NotFound from "./pages/NotFound"
import Quiz from "./pages/Quiz"
import Flashcards from "./pages/Flashcards"
import RequireAuth from "./routes/RequireAuth"
import ScrollToTop from "./components/ScrollToTop"
import Seo from "./components/Seo"
import StudentLayout from "./layouts/StudentLayout"
import StudentDashboard from "./pages/StudentDashboard"
import StudentMore from "./pages/StudentMore"
import StudentPractice from "./pages/StudentPractice"
import StudentExplore from "./pages/StudentExplore"
import StudentSupport from "./pages/StudentSupport"

const privateRoutePrefixes = ["/app", "/login", "/register", "/forgot-password", "/verification-help", "/reset-password", "/enroll", "/payment", "/my-courses", "/my-course-order", "/my-profile", "/notifications", "/order-status", "/course-lessons", "/course-quiz"]

function LegacyCourseRedirect({ type = "learn" }) {
  const { courseId, lessonId, quizId } = useParams()
  if (type === "lessonQuiz") return <Navigate to={`/app/learn/${courseId}/quiz/${lessonId}`} replace />
  if (type === "courseQuiz") return <Navigate to={`/app/course-quiz/${courseId}/${quizId}`} replace />
  return <Navigate to={`/app/learn/${courseId}`} replace />
}

function LegacyOrderRedirect() {
  const { orderId } = useParams()
  return <Navigate to={`/app/orders/${orderId}`} replace />
}

function RouteMetadata() {
  const { pathname } = useLocation()
  const isPrivate = privateRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (isPrivate) return <Seo title="Account" path={pathname} noIndex />

  const publicPages = {
    "/": ["Learn Thai Online", "Practical online Thai courses and free learning resources from Arun Thai."],
    "/courses": ["Thai Language Courses", "Explore self-paced Thai courses for speaking, grammar, and everyday communication."],
    "/blog": ["Thai Learning Blog", "Practical Thai learning tips, useful vocabulary, and encouragement from the Arun Thai Journal."],
    "/practice": ["Thai Language Practice", "Practice Thai consonants and vowels with free interactive learning resources."],
    "/about": ["About Arun Thai", "Learn about Arun Thai Language Center and our supportive approach to learning Thai."],
    "/flashcards": ["Thai Flashcards", "Practice Thai vocabulary with free interactive flashcards from Arun Thai Language Center."],
  }
  const page = publicPages[pathname]
  if (page) return <Seo title={page[0]} description={page[1]} path={pathname} />
  if (pathname.startsWith("/practice/")) return <Seo title="Thai Language Practice" description="Practice Thai consonants and vowels with free interactive learning resources." path={pathname} />
  if (pathname.startsWith("/courses/")) return <Seo title="Thai Course" description="Learn practical Thai online with Arun Thai Language Center." path={pathname} />
  return <Seo title="Page not found" path={pathname} noIndex />
}

function App() {
  return (
    <>
      <ScrollToTop />
      <RouteMetadata />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verification-help" element={<VerificationHelp />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseId" element={<CourseDetail />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/foundations" element={<Navigate to="/practice/thai-consonants" replace />} />
        <Route path="/practice/tone-combinations" element={<Navigate to="/practice/thai-vowels" replace />} />
        <Route path="/practice/:section" element={<Practice />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/about" element={<About />} />
        <Route element={<RequireAuth />}>
          <Route path="/app" element={<StudentLayout />}>
            <Route index element={<StudentDashboard />} />
            <Route path="courses" element={<MyCourses />} />
            <Route path="explore" element={<StudentExplore />} />
            <Route path="learn/:courseId" element={<CourseLessons />} />
            <Route path="learn/:courseId/quiz/:lessonId" element={<Quiz />} />
            <Route path="course-quiz/:courseId/:quizId" element={<Quiz />} />
            <Route path="practice" element={<StudentPractice />} />
            <Route path="practice/flashcards" element={<Flashcards />} />
            <Route path="practice/:section" element={<Practice />} />
            <Route path="blog" element={<Blog />} />
            <Route path="profile" element={<MyProfile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="orders" element={<MyCourseOrder />} />
            <Route path="orders/:orderId" element={<OrderStatus />} />
            <Route path="more" element={<StudentMore />} />
            <Route path="support" element={<StudentSupport />} />
          </Route>
          <Route path="/enroll/:courseId" element={<Enroll />} />
          <Route path="/payment/:courseId" element={<Payment />} />
          <Route path="/my-courses" element={<Navigate to="/app/courses" replace />} />
          <Route path="/my-course-order" element={<Navigate to="/app/orders" replace />} />
          <Route path="/my-profile" element={<Navigate to="/app/profile" replace />} />
          <Route path="/notifications" element={<Navigate to="/app/notifications" replace />} />
          <Route path="/order-status/:orderId" element={<LegacyOrderRedirect />} />
          <Route path="/course-lessons/:courseId" element={<LegacyCourseRedirect />} />
          <Route path="/course-lessons/:courseId/quiz/:lessonId" element={<LegacyCourseRedirect type="lessonQuiz" />} />
          <Route path="/course-quiz/:courseId/:quizId" element={<LegacyCourseRedirect type="courseQuiz" />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default App
