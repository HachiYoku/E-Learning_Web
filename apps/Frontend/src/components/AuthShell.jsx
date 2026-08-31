import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

function AuthShell({ eyebrow = "Arun Thai Academy", title, description, children, footer, asideTitle = "Thai that feels natural." }) {
  return (
    <main className="relative isolate flex min-h-screen items-center overflow-hidden bg-[#FFF9EA] px-4 py-8 sm:px-6 lg:px-10">
      <div className="absolute -left-32 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/30 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-36 right-0 -z-10 h-96 w-96 rounded-full bg-[#E9A9A0]/25 blur-3xl" aria-hidden="true" />
      <div className="mx-auto grid w-full max-w-[1180px] overflow-hidden rounded-[2rem] border border-[#E58C1A]/15 bg-[#FFFDF8] shadow-[0_32px_90px_-45px_rgba(76,48,20,0.55)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden min-h-[680px] overflow-hidden bg-[#2D2E30] p-10 text-white lg:flex lg:flex-col">
          <img src="/benefit/teacher&stduents.jpg" alt="Teacher supporting students" className="absolute inset-0 h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#2D2E30]/95 via-[#2D2E30]/65 to-[#C97112]/70" />
          <Link to="/" className="relative inline-flex w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white backdrop-blur-sm transition hover:bg-white/20"><ArrowLeft className="mr-2 h-4 w-4" />Back to website</Link>
          <div className="relative mt-auto">
            <p className="mt-10 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FFD487]"><Sparkles className="h-4 w-4" />Learn with confidence</p>
            <h2 className="mt-4 max-w-sm text-4xl font-bold leading-[1.08] tracking-tight">{asideTitle}</h2>
            <p className="mt-5 max-w-sm text-base leading-relaxed text-white/80">Practical learning, thoughtful guidance, and progress at a pace that feels right for you.</p>
          </div>
        </aside>
        <section className="flex min-h-[680px] items-center px-5 py-10 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-[440px]">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#765F55] transition hover:text-[#C97112] lg:hidden"><ArrowLeft className="h-4 w-4" />Back to website</Link>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-[#2D2E30] sm:text-4xl">{title}</h1>
            {description ? <p className="mt-3 text-sm leading-relaxed text-[#765F55] sm:text-base">{description}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-7 text-center text-sm text-[#765F55]">{footer}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

export default AuthShell;
