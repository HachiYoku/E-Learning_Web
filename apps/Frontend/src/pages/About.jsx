import { ArrowRight, BookOpen, Heart, Users } from "lucide-react"
import Navbar from "../components/Navbar"
import StudentReview from "../components/StudentReview"
import ContactSection from "../components/ContactSection"
import Footer from "../components/Footer"

const aboutImage = "/benefit/teacher&stduents.jpg"

const values = [
  {
    icon: Heart,
    title: "A warm place to learn",
    description: "We make space for questions, mistakes, and every small win along the way.",
  },
  {
    icon: BookOpen,
    title: "Thai for real life",
    description: "Practical lessons help you communicate naturally in the moments that matter.",
  },
  {
    icon: Users,
    title: "Guidance that feels personal",
    description: "Clear teaching and thoughtful support keep your learning steady and enjoyable.",
  },
]

function About() {
  return (
    <div className="min-h-screen bg-[#FFF9EA] text-[#2D2E30]">
      <Navbar />

      <main>
        <section className="relative isolate overflow-hidden px-4 py-16 sm:px-6 sm:py-20 md:px-10 md:py-24 lg:px-16">
          <div className="absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/25 blur-3xl" aria-hidden="true" />
          <div className="absolute -right-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/25 blur-3xl" aria-hidden="true" />

          <div className="mx-auto grid max-w-[1500px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">About Arun Thai</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                Learning Thai should feel <span className="text-[#E58C1A]">possible.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#765F55] sm:text-lg">
                Arun Thai Language Center helps learners build the confidence to understand, speak, and enjoy Thai in everyday life. We believe progress comes from practical learning, patient guidance, and a little encouragement at every step.
              </p>
              <a href="mailto:arunthaiedu@gmail.com" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#2D2E30]/20 transition-all hover:-translate-y-0.5 hover:bg-[#E58C1A]">
                Get in touch <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-[#F8C56A]/25 rotate-3" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white p-3 shadow-[0_28px_70px_-38px_rgba(80,48,19,0.5)] sm:p-4">
                <img src={aboutImage} alt="Teacher and students learning Thai together" className="aspect-[4/3] w-full rounded-[1.35rem] object-cover" />
                <div className="absolute bottom-8 left-8 rounded-2xl border border-white/40 bg-[#2D2E30]/85 px-4 py-3 text-white backdrop-blur-sm sm:bottom-9 sm:left-9">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F8C56A]">Our promise</p>
                  <p className="mt-1 text-sm font-semibold">Learn with confidence.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
          <div className="mx-auto max-w-[1500px]">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">What guides us</p>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">A thoughtful way to <span className="text-[#E58C1A]">grow.</span></h2>
            </div>
            <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-3">
              {values.map(({ icon: Icon, title, description }) => (
                <article key={title} className="rounded-[1.75rem] border border-[#E58C1A]/15 bg-[#FFFDF8] p-7 shadow-[0_18px_40px_-34px_rgba(80,48,19,0.55)] transition-transform hover:-translate-y-1 sm:p-8">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1D0] text-[#C97112]"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                  <h3 className="mt-6 text-xl font-bold tracking-tight">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#765F55] sm:text-base">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <StudentReview />
        <ContactSection />
      </main>

      <Footer />
    </div>
  )
}

export default About
