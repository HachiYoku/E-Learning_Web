import Navbar from "../components/Navbar"
import Footer from "../components/Footer"
import ThaiAlphabetPractice from "../components/ThaiAlphabetPractice"
import ThaiVowelPractice from "../components/ThaiVowelPractice"
import { ArrowLeft } from "lucide-react"
import { Link, useLocation, useParams } from "react-router-dom"
import Seo from "../components/Seo"

const practiceSections = [
  { id: "thai-consonants", label: "Thai Consonants", description: "Alphabet & consonant classes", path: "/practice/thai-consonants" },
  { id: "thai-vowels", label: "Thai Vowels", description: "Short, long & special vowels", path: "/practice/thai-vowels" },
  { id: "level-test", label: "Level test", description: "Coming soon", path: null },
  { id: "quiz", label: "Quiz", description: "Coming soon", path: null },
  { id: "flashcards", label: "Flashcards", description: "Image-based recall practice", path: "/flashcards" },
]

function Practice() {
  const { section } = useParams()
  const location = useLocation()
  const studentPractice = location.pathname.startsWith("/app/practice/")
  const activeSection = practiceSections.some((item) => item.id === section) ? section : "thai-consonants"
  const isVowels = activeSection === "thai-vowels"
  const canonicalPath = section ? `/practice/${activeSection}` : "/practice"

  const ContentTag = studentPractice ? "div" : "main"
  return (
    <div className={studentPractice ? "min-w-0 bg-[#FFF9EA] text-[#2D2E30]" : "flex min-h-screen flex-col bg-[#FFF9EA] text-[#2D2E30]"}>
      <Seo title={isVowels ? "Thai Vowel Practice" : "Thai Consonant Practice"} description={isVowels ? "Practice Thai vowels, including short, long, and special vowel sounds." : "Learn and practice all 44 Thai consonants, their classes, sounds, and common combinations."} path={canonicalPath} />
      {!studentPractice ? <Navbar /> : null}
      <ContentTag className={studentPractice ? "relative isolate min-w-0 overflow-hidden px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12" : "relative isolate flex-1 overflow-hidden px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16"}>
        <div className="absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/25 blur-3xl" aria-hidden="true" />
        <div className="mx-auto w-full max-w-[1200px]">
          {studentPractice ? <Link to="/app/practice" className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#C97112] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to Practice Overview</Link> : null}
          <h1 className="sr-only">{isVowels ? "Thai vowel practice" : "Thai consonant practice"}</h1>
          <div>{activeSection === "thai-vowels" ? <ThaiVowelPractice /> : <ThaiAlphabetPractice />}</div>
        </div>
      </ContentTag>
      {!studentPractice ? <Footer /> : null}
    </div>
  )
}

export default Practice
