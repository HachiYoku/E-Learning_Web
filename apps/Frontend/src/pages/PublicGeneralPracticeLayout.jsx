import { Outlet } from "react-router-dom"
import Navbar from "../components/Navbar"
import Footer from "../components/Footer"

function PublicGeneralPracticeLayout() {
  return <div className="flex min-h-screen flex-col bg-[#FFF9EA] text-[#2D2E30]">
    <Navbar />
    <main className="flex-1"><Outlet /></main>
    <Footer />
  </div>
}

export default PublicGeneralPracticeLayout
