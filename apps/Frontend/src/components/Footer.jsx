import { Link, useLocation } from "react-router-dom"

function Footer() {
  const currentYear = new Date().getFullYear()
  const { pathname } = useLocation()

  if (pathname === "/app" || pathname.startsWith("/app/")) return null

  return (
    <footer className="border-t border-[#E58C1A]/15 bg-[#FFFDF8] py-6 sm:py-7">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row md:gap-6">
          <div className="text-center text-sm text-[#765F55] sm:text-base md:text-left">
            Copyright {currentYear} © <span className="font-bold text-[#2D2E30]">Arun Thai Language Center</span>. All rights reserved.
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm sm:text-base">
            <Link to="/privacy-policy" className="inline-flex min-h-11 items-center rounded-xl px-3 font-medium text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#2D2E30] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15">Privacy Policy</Link>
            <span className="text-[#B9A79D]" aria-hidden="true">|</span>
            <Link to="/cookie-policy" className="inline-flex min-h-11 items-center rounded-xl px-3 font-medium text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#2D2E30] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
