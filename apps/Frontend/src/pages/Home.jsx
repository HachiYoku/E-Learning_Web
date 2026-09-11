import Navbar from "../components/Navbar"
import Hero from "../components/Hero"
import OurServices from "../components/OurServices"
import Benefits from "../components/Benefits"
import MotivationBanner from "../components/MotivationBanner"
import Courses from "../components/Courses"
import Article from "../components/Article"
import StudentReview from "../components/StudentReview"
import ContactSection from "../components/ContactSection"
import Footer from "../components/Footer"
import Seo from "../components/Seo"
import { organizationSchema } from "../components/seoData"

function Home() {
  return (
    <div>
      <Seo title="Learn Thai Online" description="Build confidence in everyday Thai with practical online courses, free learning resources, and supportive guidance from Arun Thai." structuredData={organizationSchema} />
      <Navbar />
      <Hero />
      <Courses />
      <Benefits />
      <Article />
      <MotivationBanner />
      <OurServices />
      <StudentReview />
      <ContactSection />
      <Footer />
    </div>
  )
}

export default Home
