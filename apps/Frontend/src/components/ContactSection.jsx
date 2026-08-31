import { CheckCircle2, Mail, Send } from "lucide-react";
import { useState } from "react";
import { submitContactLead } from "../services/contactService";

const lineIcon = "/logo/Line.svg";
const facebookIcon = "/logo/facebook.svg";
const instagramIcon = "/logo/instagram.svg";

function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", message: "", marketingOptIn: true, website: "" });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });
    setIsSubmitting(true);

    try {
      const response = await submitContactLead(form);
      setStatus({ type: "success", message: response.message || "Thank you. We will keep you updated." });
      setForm({ name: "", email: "", message: "", marketingOptIn: true, website: "" });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Unable to send your details. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative isolate overflow-hidden bg-[#FFF9EA] px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
      <div className="absolute -left-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/18 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-24 top-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/18 blur-3xl" aria-hidden="true" />
      <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-2 lg:items-start lg:gap-16 xl:gap-24">
        <div className="pt-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">Stay connected</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">
            Let’s Keep Learning <span className="text-[#E58C1A]">Together.</span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#765F55] sm:text-lg">
            Share your details to receive course news, practical Thai learning tips, and updates from Arun Thai Academy.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <a href="mailto:arunthaiedu@gmail.com" className="group rounded-2xl border border-[#E58C1A]/15 bg-[#FFFDF8]/80 p-5 transition hover:-translate-y-1 hover:border-[#E58C1A]/35 hover:shadow-[0_16px_35px_-25px_rgba(80,48,19,0.5)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF1D0] text-[#C97112]"><Mail className="h-5 w-5" aria-hidden="true" /></span>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[#C97112]">Email us</p>
              <p className="mt-1 break-all text-sm font-semibold text-[#2D2E30] group-hover:text-[#C97112]">arunthaiedu@gmail.com</p>
            </a>
            <div className="rounded-2xl border border-[#E58C1A]/15 bg-[#FFFDF8]/80 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C97112]">Follow along</p>
              <p className="mt-1 text-sm font-semibold text-[#2D2E30]">Learn with us every day.</p>
              <div className="mt-5 flex items-center gap-3">
                <a href="https://line.me" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110" title="LINE"><img src={lineIcon} alt="LINE" className="h-9 w-9" /></a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110" title="Facebook"><img src={facebookIcon} alt="Facebook" className="h-9 w-9" /></a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110" title="Instagram"><img src={instagramIcon} alt="Instagram" className="h-9 w-9" /></a>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#E58C1A]/18 bg-[#FFFDF8] p-6 shadow-[0_24px_60px_-38px_rgba(80,48,19,0.42)] sm:p-8 md:rounded-[2.5rem] md:p-10">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Get in touch</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl">Get updates that help you progress.</h3>
            </div>
            <Send className="h-6 w-6 shrink-0 text-[#E58C1A]" aria-hidden="true" />
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[#2D2E30]">Name
              <input required name="name" value={form.name} onChange={updateField} autoComplete="name" className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-[#2D2E30] outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" placeholder="Your name" />
            </label>
            <label className="block text-sm font-semibold text-[#2D2E30]">Email address
              <input required type="email" name="email" value={form.email} onChange={updateField} autoComplete="email" className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-[#2D2E30] outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" placeholder="you@example.com" />
            </label>
          </div>
          <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="contact-website">Website</label>
            <input id="contact-website" type="text" name="website" value={form.website} onChange={updateField} tabIndex="-1" autoComplete="off" />
          </div>
          <label className="mt-5 block text-sm font-semibold text-[#2D2E30]">Message <span className="font-normal text-[#765F55]">(optional)</span>
            <textarea name="message" value={form.message} onChange={updateField} rows="3" className="mt-2 w-full resize-y rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-[#2D2E30] outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" placeholder="How can we help?" />
          </label>
          <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-[#765F55]">
            <input type="checkbox" name="marketingOptIn" checked={form.marketingOptIn} onChange={updateField} className="mt-1 h-4 w-4 rounded border-[#2D2E30]/30 text-[#E58C1A] focus:ring-[#E58C1A]" />
            I’d like to receive news, course information, and Thai learning updates by email.
          </label>

          {status.message ? (
            <p className={`mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${status.type === "success" ? "bg-[#EDF8EE] text-[#246B35]" : "bg-red-50 text-red-700"}`}>
              {status.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" /> : null}{status.message}
            </p>
          ) : null}
          <button disabled={isSubmitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#2D2E30]/20 transition-all hover:-translate-y-0.5 hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? "Sending..." : "Keep me updated"}<Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </section>
  );
}

export default ContactSection;
