const benefitImage = "/benefit/teacher&stduents.jpg";

const benefits = [
  {
    number: "01",
    title: "Speak with Confidence",
    description: "Real-world conversations for everyday life.",
  },
  {
    number: "02",
    title: "Understand Clearly",
    description: "Simple explanations that make Thai click.",
  },
  {
    number: "03",
    title: "Practice Together",
    description: "Supportive guidance whenever you need it.",
  },
  {
    number: "04",
    title: "Learn at Your Pace",
    description: "Steady progress, with no pressure.",
  },
];

function Benefits() {
  return (
    <section className="bg-[#FFF9EA] px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
      <div className="relative mx-auto max-w-[1500px] overflow-hidden rounded-[2rem] border border-[#E58C1A]/20 bg-[linear-gradient(135deg,#FFFDF7_0%,#FFF8E9_100%)] p-5 shadow-[0_28px_70px_-45px_rgba(80,48,19,0.5)] sm:p-8 md:rounded-[2.5rem] md:p-12 lg:p-16">
        <div className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-[#E58C1A]/80 to-transparent" aria-hidden="true" />
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">The Arun Thai approach</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">
            Learn More Than Just <span className="text-[#E58C1A]">Words.</span>
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#765F55] sm:text-base">
            A warm, practical path to using Thai naturally in the moments that matter.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-8 md:mt-12 md:flex-row md:items-center md:gap-12 lg:gap-16">
          <div className="relative mx-auto w-full max-w-md shrink-0 overflow-hidden rounded-[1.75rem] bg-[#2D2E30] shadow-[0_24px_45px_-28px_rgba(45,46,48,0.55)] md:mx-0 md:h-[250px] md:w-[38%] md:max-w-none">
            <img
              src={benefitImage}
              alt="Teacher and students learning Thai together"
              className="aspect-square h-full w-full object-cover object-center md:aspect-auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2D2E30]/45 via-transparent to-transparent" aria-hidden="true" />
            <p className="absolute bottom-5 left-5 rounded-full border border-white/30 bg-[#2D2E30]/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              Learn together
            </p>
          </div>

          <div className="w-full divide-y divide-[#2D2E30]/10 border-y border-[#2D2E30]/10 md:grid md:h-[250px] md:flex-1 md:grid-cols-2 md:grid-rows-2 md:gap-3 md:divide-y-0 md:border-y-0">
            {benefits.map(({ number, title, description }) => (
              <article key={number} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 py-5 first:pt-0 last:pb-0 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-5 sm:py-6 md:grid-cols-[2.25rem_minmax(0,1fr)] md:gap-3 md:rounded-2xl md:border md:border-[#E58C1A]/15 md:bg-white/45 md:p-4 md:first:p-4 md:last:p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E58C1A]/25 bg-[#FFF1D0] text-xs font-bold tracking-[0.12em] text-[#C97112] md:h-8 md:w-8">{number}</span>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-[#2D2E30] sm:text-xl md:text-base lg:text-lg">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#765F55] sm:text-base md:text-xs lg:text-sm">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Benefits;
