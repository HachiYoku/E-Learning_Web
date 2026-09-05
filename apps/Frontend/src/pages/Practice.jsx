import Navbar from "../components/Navbar"
import Footer from "../components/Footer"

function Practice() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFF9EA] text-[#2D2E30]">
      <Navbar />
      <main className="relative isolate flex flex-1 items-center overflow-hidden px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
        <div className="absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/25 blur-3xl" aria-hidden="true" />
        <div className="mx-auto w-full max-w-3xl rounded-[2rem] border border-[#E58C1A]/15 bg-white/75 p-8 text-center shadow-[0_28px_70px_-42px_rgba(80,48,19,0.48)] backdrop-blur-sm sm:p-12 md:rounded-[2.5rem] md:p-16">
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">Practice Thai</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Practice is <span className="text-[#E58C1A]">coming soon.</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#765F55] sm:text-lg">
            A dedicated space for practical Thai learning activities will be here soon.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Practice
