const logoMotivation = "/moti/Watermark.JPG"
const openIcon = "/moti/open.svg"
const closeIcon = "/moti/close.svg"

function MotivationBanner() {
  return (
    <section className="relative px-4 sm:px-6 md:px-10 py-6 sm:py-8 md:py-12" style={{ backgroundColor: "#F5D4DC" }}>
      <div className="max-w-6xl mx-auto relative">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 items-center">

          {/* left - Logo (hidden on mobile) */}
          <div className="hidden md:flex justify-center">
            <img
              src={logoMotivation}
              alt="English Kafé Logo"
              className="w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 object-contain"
            />
          </div>

          {/* Right - Main Message (takes 2 cols) */}
          <div className="md:col-span-2 md:pr-6 lg:pr-8 relative px-8 sm:px-10 md:px-0">

            {/* Open quote icon — top left of text block */}
            <div className="absolute left-0 top-0 md:-left-8 lg:-left-12">
              <img
                src={openIcon}
                alt="Open Icon"
                className="w-7 sm:w-9 md:w-14 lg:w-16 h-7 sm:h-9 md:h-14 lg:h-16"
              />
            </div>

            {/* Close quote icon — bottom right of text block */}
            <div className="absolute right-0 bottom-0 md:-right-4">
              <img
                src={closeIcon}
                alt="Close Icon"
                className="w-7 sm:w-9 md:w-14 lg:w-16 h-7 sm:h-9 md:h-14 lg:h-16"
              />
            </div>

            <div>
              {/* Top accent line */}
              <div className="w-16 sm:w-24 md:w-36 h-0.8 sm:h-1 bg-black mb-3 sm:mb-4 mx-8" />

              <div className="py-2 sm:py-3 px-8 pr-6 sm:pr-8 md:pr-4">
                <h2 className="text-base sm:text-lg md:text-xl lg:text-3xl font-bold text-gray-900 mb-2 sm:mb-3 leading-snug">
                  Every small effort you make in learning English
                  today builds the confidence and fluency you
                  will proudly use tomorrow.
                </h2>
                <p className="text-[#8B6F61] text-xs sm:text-sm md:text-base lg:text-lg">
                  Learn smarter, progress faster, and speak with confidence.
                </p>
              </div>
            </div>

          </div>


        </div>

      </div>
    </section>
  )
}

export default MotivationBanner