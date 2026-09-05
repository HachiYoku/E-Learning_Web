import { ArrowLeft, Home, MapPin } from "lucide-react"
import { useNavigate } from "react-router-dom"
import Navbar from "../components/Navbar"
import Footer from "../components/Footer"

function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF9EA] text-[#2D2E30]">
      <Navbar />
      <main className="relative isolate flex flex-1 items-center overflow-hidden px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
        <div className="absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/25 blur-3xl" aria-hidden="true" />

        <div className="mx-auto w-full max-w-3xl rounded-[2rem] border border-[#E58C1A]/15 bg-white/80 p-8 text-center shadow-[0_28px_70px_-42px_rgba(80,48,19,0.48)] backdrop-blur-sm sm:p-12 md:rounded-[2.5rem] md:p-16">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1D0] text-[#C97112]">
            <MapPin className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">Error 404</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">This page is <span className="text-[#E58C1A]">lost.</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#765F55] sm:text-lg">
            It may have moved, or the address may not be quite right. Let&apos;s get you back to your Thai learning journey.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => navigate("/")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#2D2E30]/20 transition-all hover:-translate-y-0.5 hover:bg-[#E58C1A]">
              <Home className="h-4 w-4" aria-hidden="true" /> Go to home
            </button>
            <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-6 py-3.5 font-semibold text-[#2D2E30] transition-colors hover:border-[#E58C1A]/35 hover:bg-[#FFF4D8] hover:text-[#C97112]">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Go back
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default NotFound
