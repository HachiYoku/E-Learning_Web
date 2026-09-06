import Navbar from "../components/Navbar"
import Footer from "../components/Footer"
import ThaiAlphabetPractice from "../components/ThaiAlphabetPractice"

function Practice() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFF9EA] text-[#2D2E30]">
      <Navbar />
      <main className="relative isolate flex-1 overflow-hidden px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
        <div className="absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/25 blur-3xl" aria-hidden="true" />
        <div className="mx-auto w-full max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">Practice Thai</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Build your Thai, <span className="text-[#E58C1A]">one letter at a time.</span></h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#765F55] sm:text-lg">Start with the Thai alphabet, then use each letter as a foundation for clearer reading and pronunciation.</p>
          </div>
          <div className="mt-10"><ThaiAlphabetPractice /></div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Practice
