import { Mail, MapIcon } from "lucide-react";
const lineIcon = "/logo/Line.svg"
const facebookIcon = "/logo/facebook.svg"
const instagramIcon = "/logo/instagram.svg"


function ContactSection() {
  return (
    <section className="px-4 sm:px-6 md:px-10 py-8 sm:py-10 md:py-14 bg-[#F5D4DC]">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center">

          {/* Left Side - Contact Information */}
          <div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 sm:mb-8">
              Contact Us
            </h2>
            

            {/* Email */}
            <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="text-gray-900 mt-0.5 shrink-0">
                <Mail />
              </div>
              <p className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 break-all">
                mindployenglish@gmail.com
              </p>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="text-gray-900 mt-0.5 shrink-0">
                <MapIcon />
              </div>
              <p className="text-gray-900 font-semibold text-sm sm:text-base leading-relaxed">
                355 สันโค้งหลวง ซอย 6 Tambon Rop Wiang,<br />
                Mueang Chiang Rai District, Chiang Rai 57000, Thailand
              </p>
            </div>

            {/* Social Media Icons */}
            <div className="flex items-center gap-4 sm:gap-6">
              <a href="https://line.me" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity" title="LINE">
                <img src={lineIcon} alt="LINE" className="w-8 sm:w-10 h-8 sm:h-10" />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity" title="Facebook">
                <img src={facebookIcon} alt="Facebook" className="w-8 sm:w-10 h-8 sm:h-10" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity" title="Instagram">
                <img src={instagramIcon} alt="Instagram" className="w-8 sm:w-10 h-8 sm:h-10" />
              </a>
            </div>
          </div>

          {/* Right Side - Map */}
          <div className="w-full rounded-2xl overflow-hidden border-4 border-blue-300 shadow-lg h-56 sm:h-72 md:h-80 lg:h-96">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3751.641848995492!2d99.81752957532288!3d19.897339625675!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30d707b92d0b5149%3A0x9a726a9e061e2afe!2zRW5nbGlzaCBLYWbDqSDguK3guLTguIfguKXguLTguIrguITguLLguYDguJ_guYgg4LmA4LiK4Li14Lii4LiH4Lij4Liy4Lii!5e0!3m2!1sen!2sth!4v1775645451185!5m2!1sen!2sth"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Mind Ploy English location"
            />
          </div>

        </div>
      </div>
    </section>
  )
}

export default ContactSection