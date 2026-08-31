const openIcon = "/moti/open.svg"
const closeIcon = "/moti/close.svg"

function MotivationBanner() {
  return (
    <section className="relative isolate overflow-hidden bg-[#FFF9EA] px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
      <div className="absolute -left-24 top-0 -z-10 h-72 w-72 rounded-full bg-[#F8C56A]/20 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-20 -right-16 -z-10 h-72 w-72 rounded-full bg-[#E9A9A0]/20 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1500px]">
        <div className="relative mx-auto max-w-4xl rounded-[2rem] border border-white/80 bg-white/55 px-8 py-10 shadow-[0_24px_60px_-32px_rgba(80,48,19,0.45)] backdrop-blur-sm sm:px-12 sm:py-12 md:px-16 md:py-14">

          <div className="absolute left-3 top-4 sm:left-5 sm:top-5">
              <img
                src={openIcon}
                alt=""
                className="h-7 w-7 opacity-60 sm:h-9 sm:w-9 md:h-12 md:w-12"
              />
            </div>

          <div className="absolute bottom-4 right-3 sm:bottom-5 sm:right-5">
              <img
                src={closeIcon}
                alt=""
                className="h-7 w-7 opacity-60 sm:h-9 sm:w-9 md:h-12 md:w-12"
              />
            </div>

            <div className="relative">
              <div className="mb-5 h-1 w-16 rounded-full bg-[#E58C1A] sm:mb-6 sm:w-24" />

              <div className="pr-4 sm:pr-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">A note for your journey</p>
                <h2 className="mb-4 text-xl font-bold leading-snug tracking-tight text-[#2D2E30] sm:text-2xl md:text-3xl lg:text-4xl">
                  Every small effort you make in learning Thai
                  today builds the confidence and fluency you
                  will proudly use tomorrow.
                </h2>
                <p className="text-sm leading-relaxed text-[#765F55] sm:text-base lg:text-lg">
                  Learn smarter, progress faster, and speak with confidence.
                </p>
              </div>
            </div>

        </div>
      </div>
    </section>
  )
}

export default MotivationBanner
