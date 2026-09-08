import Navbar from "../components/Navbar"
import Footer from "../components/Footer"
import ThaiAlphabetPractice from "../components/ThaiAlphabetPractice"
import ThaiVowelPractice from "../components/ThaiVowelPractice"
import { useParams } from "react-router-dom"

const practiceSections = [
  { id: "foundations", label: "Thai Consonants", description: "Alphabet & consonant classes", path: "/practice/foundations" },
  { id: "tone-combinations", label: "Thai Vowels", description: "Short, long & special vowels", path: "/practice/tone-combinations" },
  { id: "level-test", label: "Level test", description: "Coming soon", path: null },
  { id: "quiz", label: "Quiz", description: "Coming soon", path: null },
]

function Practice() {
  const { section } = useParams()
  const activeSection = practiceSections.some((item) => item.id === section) ? section : "foundations"

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF9EA] text-[#2D2E30]">
      <Navbar />
      <main className="relative isolate flex-1 overflow-hidden px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
        <div className="absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/25 blur-3xl" aria-hidden="true" />
        <div className="mx-auto w-full max-w-6xl">
          <div>{activeSection === "tone-combinations" ? <ThaiVowelPractice /> : <ThaiAlphabetPractice />}</div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Practice
