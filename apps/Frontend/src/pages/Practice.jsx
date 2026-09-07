import Navbar from "../components/Navbar"
import Footer from "../components/Footer"
import ThaiAlphabetPractice from "../components/ThaiAlphabetPractice"
import ThaiToneCombinationPractice from "../components/ThaiToneCombinationPractice"
import { useParams } from "react-router-dom"

const practiceSections = [
  { id: "foundations", label: "Thai foundations", description: "Alphabet & consonant classes", path: "/practice/foundations" },
  { id: "tone-combinations", label: "Tone combinations", description: "Vowels & tone marks", path: "/practice/tone-combinations" },
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
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">Practice Thai</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Build your Thai, <span className="text-[#E58C1A]">one step at a time.</span></h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#765F55] sm:text-lg">Work through Thai foundations and tone combinations now. Level testing and quizzes will be added next.</p>
          </div>
          <div className="mt-10">{activeSection === "tone-combinations" ? <ThaiToneCombinationPractice /> : <ThaiAlphabetPractice />}</div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Practice
