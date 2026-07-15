import Navbar from "../components/Navbar"
import StudentReview from "../components/StudentReview"
import ContactSection from "../components/ContactSection"
import Footer from "../components/Footer"
const lineIcon = "/logo/Line.svg"
const serviceImage = "/moti/Watermark.JPG"

function Service() {
  return (
    <div className="min-h-screen bg-[#E8F5FD]">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
        {/* Services Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center">
          {/* Left - Text Content */}
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
              โค้ชภาษาอังกฤษส่วนตัว — ฝึกฝนด้วยแนวทางที่ถูกต้อง แม่นยำ และมั่นใจ
            </h1>
            
            <p className="text-gray-600 text-xs sm:text-sm md:text-base lg:text-lg leading-relaxed">
              ดูแลแบบตัวต่อตัวเพื่ออัปเกรดทักษะการพูด แกรมม่า และความมั่นใจ ผ่านการฝึกฝนที่เน้นการใช้งานจริงและมีผู้เชี่ยวชาญคอยไกด์อย่างใกล้ชิด — ครบเครื่องทั้งเพื่อการใช้ชีวิตประจำวัน การสอบ และการทำงาน
            </p>

            {/* Contact via LINE Button */}
            <div className="pt-2 sm:pt-3 md:pt-4">
              <button className="flex items-center gap-2 sm:gap-3 bg-[#F8B2C0] hover:bg-[#F8C2C0] transition-colors px-6 sm:px-7 md:px-8 py-2 sm:py-3 md:py-4 rounded-xl font-semibold text-sm sm:text-base md:text-lg">
                <img src={lineIcon} alt="LINE" className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8" />
                Contact via LINE
              </button>
            </div>
          </div>

          {/* Right - Image */}
          <div className="flex justify-center mt-6 md:mt-0">
            <img 
              src={serviceImage} 
              alt="Personal English Coaching" 
              loading="eager"
              decoding="async"
              className="w-full h-48 sm:h-64 md:h-80 lg:h-96 object-cover rounded-lg shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Student Reviews */}
      <StudentReview />

      {/* Contact Section */}
      <ContactSection />

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default Service
