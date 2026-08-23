import { useState } from "react";
import { useNavigate } from "react-router-dom";

const lineIcon = "/logo/Line.svg";
const facebookIcon = "/logo/facebook.svg";
const instagramIcon = "/logo/instagram.svg";
const landing0 = "/hero/hero2.jpg";
const landing = "/hero/hero1.jpg";

function Hero() {
  const navigate = useNavigate();
  const [activeImage, setActiveImage] = useState("conversation");

  return (
    <section className="relative isolate overflow-hidden bg-[#FFF9EA] px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
      <div className="absolute -left-24 top-12 -z-10 h-72 w-72 rounded-full bg-[#F8C56A]/25 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-20 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/20 blur-3xl" aria-hidden="true" />
      <div className="mx-auto grid max-w-[1500px] grid-cols-1 items-center gap-10 md:grid-cols-[minmax(170px,1fr)_minmax(360px,1.5fr)_minmax(170px,1fr)] md:gap-6 lg:gap-12">
        <button
          type="button"
          onClick={() => setActiveImage("conversation")}
          className={`group relative hidden w-full overflow-hidden rounded-[2rem] text-left shadow-xl transition duration-500 md:block md:h-[27rem] ${activeImage === "conversation" ? "-rotate-2 scale-[1.03]" : "rotate-2 opacity-75 hover:rotate-0 hover:scale-[1.03] hover:opacity-100"}`}
          aria-label="Focus on everyday Thai"
        >
          <img src={landing} alt="Student practicing Thai conversation" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-[#2D2E30]/85 via-[#2D2E30]/25 to-transparent p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            <div className="translate-y-3 text-white transition-transform duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FFD98B]">Everyday Thai</p>
              <p className="mt-2 text-xl font-semibold leading-tight">Find your voice in every conversation.</p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">Build natural speaking habits for travel, work, and real life.</p>
            </div>
          </div>
        </button>

        <div className="z-10 rounded-[2rem] border border-white/70 bg-white/45 px-5 py-8 text-center shadow-[0_24px_60px_-32px_rgba(80,48,19,0.45)] backdrop-blur-sm sm:px-8 sm:py-10 md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none md:backdrop-blur-none">
          <p className="mb-5 inline-flex rounded-full border border-[#E58C1A]/20 bg-[#FFF4D8] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Arun Thai Academy</p>
          <h1 className="text-4xl font-bold leading-[1.06] tracking-tight text-[#2D2E30] sm:text-5xl lg:text-7xl">
            Learn Thai with <span className="text-[#E58C1A]">confidence</span><span className="text-[#2D2E30]">, naturally.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#765F55] md:text-xl">
            Where Thai learning feels relaxed, practical, and enjoyable.
          </p>
          <button
            onClick={() => navigate("/courses")}
            className="mt-8 rounded-xl bg-[#2D2E30] px-8 py-3.5 font-semibold text-white shadow-lg shadow-[#2D2E30]/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#E58C1A] hover:shadow-xl"
          >
            Explore Courses <span aria-hidden="true">→</span>
          </button>
          <p className="mt-4 text-sm font-medium text-[#8B6F61]">Begin with practical Thai for real life.</p>
          <div className="mt-8 flex justify-center gap-4" aria-label="Social links">
            <img src={lineIcon} alt="Line" className="h-7 w-7 transition hover:scale-110" />
            <img src={facebookIcon} alt="Facebook" className="h-7 w-7 transition hover:scale-110" />
            <img src={instagramIcon} alt="Instagram" className="h-7 w-7 transition hover:scale-110" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveImage("foundations")}
          className={`group relative hidden w-full overflow-hidden rounded-[2rem] text-left shadow-xl transition duration-500 md:block md:h-[27rem] ${activeImage === "foundations" ? "rotate-2 scale-[1.03]" : "-rotate-2 opacity-75 hover:rotate-0 hover:scale-[1.03] hover:opacity-100"}`}
          aria-label="Focus on Thai foundations"
        >
          <img src={landing0} alt="Student learning Thai grammar" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-[#2D2E30]/85 via-[#2D2E30]/25 to-transparent p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            <div className="translate-y-3 text-white transition-transform duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FFD98B]">Thai Foundations</p>
              <p className="mt-2 text-xl font-semibold leading-tight">Make grammar feel beautifully simple.</p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">Learn the patterns behind Thai so every new phrase sticks.</p>
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}

export default Hero;
