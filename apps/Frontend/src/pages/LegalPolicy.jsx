import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

function LegalPolicy({ title, eyebrow, summary, sections }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFF9EA] text-[#2D2E30]">
      <Navbar />
      <main className="relative isolate flex-1 overflow-hidden px-4 py-14 sm:px-6 sm:py-16 md:px-10 md:py-20 lg:px-16">
        <div className="pointer-events-none absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 -z-10 h-96 w-96 rounded-full bg-[#E9A9A0]/15 blur-3xl" aria-hidden="true" />
        <article className="mx-auto max-w-3xl rounded-[2rem] border border-[#E58C1A]/15 bg-[#FFFDF8]/90 p-6 shadow-[0_24px_60px_-42px_rgba(80,48,19,0.45)] backdrop-blur-sm sm:p-9 md:rounded-[2.5rem] md:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">{eyebrow}</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#765F55] sm:text-lg">{summary}</p>
          <div className="mt-9 space-y-7 border-t border-[#2D2E30]/10 pt-8">
            {sections.map((section) => <section key={section.heading}><h2 className="text-xl font-bold tracking-tight text-[#2D2E30] sm:text-2xl">{section.heading}</h2><p className="mt-3 text-sm leading-7 text-[#765F55] sm:text-base">{section.content}</p></section>)}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

export function PrivacyPolicy() {
  return <LegalPolicy title="Privacy Policy" eyebrow="Legal information" summary="This page is a basic public policy shell while Arun Thai’s approved privacy-policy wording is being prepared." sections={[
    { heading: "About this page", content: "A complete approved privacy policy has not yet been published. This page will be updated once the policy text has received owner and legal review." },
    { heading: "Questions", content: "If you have a question about information you submit through the website, your account, or a course enquiry, please contact Arun Thai at arunthaiedu@gmail.com." },
  ]} />;
}

export function CookiePolicy() {
  return <LegalPolicy title="Cookie Policy" eyebrow="Legal information" summary="This page is a basic public policy shell while Arun Thai’s approved cookie-policy wording is being prepared." sections={[
    { heading: "About this page", content: "A complete approved cookie policy has not yet been published. This page will be updated once the policy text has received owner and legal review." },
    { heading: "Questions", content: "If you have a question about browser cookies or similar technologies used with this website, please contact Arun Thai at arunthaiedu@gmail.com." },
  ]} />;
}
