const openIcon = "/moti/open.svg"
const closeIcon = "/moti/close.svg"

function MotivationBanner() {
  return (
    <section className="relative isolate overflow-hidden bg-[#FFF9EA] px-4 pb-8 pt-16 sm:px-6 sm:py-16 md:px-10 md:py-24 lg:px-16">
      <div className="relative mx-auto max-w-[1500px]">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#E58C1A]/20 bg-[linear-gradient(120deg,#FFFDF7_0%,#FFF4D8_52%,#FCE5C4_100%)] px-5 py-8 shadow-[0_28px_70px_-42px_rgba(80,48,19,0.5)] sm:px-8 sm:py-10 md:rounded-[2.5rem] md:px-12 md:py-12 lg:px-16 lg:py-14">
          <div className="pointer-events-none absolute -left-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[#F8C56A]/35 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[18px] border-[#E58C1A]/10" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 rounded-tl-full bg-[#E9A9A0]/20" aria-hidden="true" />

          <div className="relative max-w-3xl lg:max-w-2xl">
            <div className="mb-5 h-1 w-16 rounded-full bg-[#E58C1A] sm:mb-6 sm:w-24" />
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">A note for your journey</p>
            <h2 lang="my" className="font-myanmar text-[1.35rem] font-medium leading-[1.62] tracking-normal text-[#2D2E30] sm:text-2xl sm:leading-[1.58] md:text-3xl md:leading-[1.55] lg:text-[2rem] xl:text-4xl">
              သင့်ရဲ့ ကြိုးစားအားထုတ်မှုနဲ့ ရည်မှန်းချက်တွေရှေ့မှာ ဘာသာစကား အဟန့်အတား မရှိပါစေနဲ့။
            </h2>
            <div className="mt-6 h-px w-14 bg-[#E58C1A]/65 sm:w-20" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium leading-relaxed text-[#654E44] sm:text-base lg:text-lg">
              Your ambition has no language barrier.
            </p>
          </div>

          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[34%] lg:block" aria-hidden="true">
            <div className="absolute right-16 top-14 h-28 w-28 rounded-full border border-[#E58C1A]/25 bg-white/25" />
            <img src={openIcon} alt="" className="absolute right-24 top-20 h-28 w-28 -rotate-6 opacity-[0.12]" />
            <img src={closeIcon} alt="" className="absolute bottom-12 right-12 h-36 w-36 rotate-6 opacity-[0.12]" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default MotivationBanner
