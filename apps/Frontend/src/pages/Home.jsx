import Navbar from "../components/Navbar"
import Hero from "../components/Hero"
import Instructors from "../components/Instructors"
import MotivationBanner from "../components/MotivationBanner"
import Courses from "../components/Courses"
import Article from "../components/Article"
import StudentReview from "../components/StudentReview"
import ContactSection from "../components/ContactSection"
import Footer from "../components/Footer"

function Home() {
  return (
    <div>
      <Navbar />
      <Hero />
      <Instructors />
      <MotivationBanner />
      <Courses />
      <Article />
      <StudentReview />
      <ContactSection />
      <Footer />
    </div>
  )
}

export default Home