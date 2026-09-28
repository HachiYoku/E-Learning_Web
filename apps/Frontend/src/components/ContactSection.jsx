import { Camera, CheckCircle2, ExternalLink, Mail, MessageCircle, Music2, Send } from "lucide-react";
import { createElement, useState } from "react";
import { CONTACT_LINKS } from "../config/contactLinks";
import { submitContactLead } from "../services/contactService";

function ContactChannel({ label, href, icon }) {
  const content = <><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1D0] text-[#C97112]">{createElement(icon, { className: "h-5 w-5", "aria-hidden": true })}</span><span className="min-w-0 flex-1 text-left text-sm font-bold text-[#2D2E30]">{label}</span></>;

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 rounded-xl border border-[#E58C1A]/20 bg-white px-3 py-2.5 transition hover:border-[#E58C1A]/45 hover:bg-[#FFF9EA] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15">{content}<ExternalLink className="h-4 w-4 shrink-0 text-[#C97112]" aria-hidden="true" /></a>;
  }

  return <button type="button" disabled aria-label={`${label} is not available yet`} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-[#2D2E30]/10 bg-[#F7F3EE] px-3 py-2.5 text-left opacity-75 disabled:cursor-not-allowed">{content}<span className="shrink-0 text-xs font-semibold text-[#765F55]">Coming soon</span></button>;
}

function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", message: "", marketingOptIn: false, website: "" });
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
      setForm({ name: "", email: "", message: "", marketingOptIn: false, website: "" });
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
      <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-2 lg:items-stretch lg:gap-16 xl:gap-24">
        <div className="pt-2">
          <p className="text-brand-accent text-xs font-bold uppercase tracking-[0.24em]">Stay connected</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">
            Let’s Talk About Your <span className="text-brand-accent">Thai Journey.</span>
          </h2>
          <p lang="my" className="font-myanmar mt-5 max-w-xl text-base leading-[1.85] text-[#765F55] sm:text-lg">
            သင်တန်းအကြောင်း သိချင်တာပဲဖြစ်ဖြစ်၊ ဘယ်သင်တန်းက သင့်အတွက် အသင့်တော်ဆုံးလဲ မေးချင်တာပဲဖြစ်ဖြစ် Arun Thai ကို အချိန်မရွေး ဆက်သွယ်မေးမြန်းနိုင်ပါတယ်။
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-[#E58C1A]/15 bg-[#FFFDF8]/80 p-5 sm:h-full">
              <p className="text-brand-accent text-xs font-bold uppercase tracking-[0.14em]">Chat with us</p>
              <div className="mt-4 space-y-2.5">
                <ContactChannel label="Facebook Messenger" href={CONTACT_LINKS.messenger} icon={MessageCircle} />
                <ContactChannel label="LINE" href={CONTACT_LINKS.line} icon={Send} />
                <ContactChannel label="TikTok" href={CONTACT_LINKS.tiktok} icon={Music2} />
              </div>
            </section>
            <div className="space-y-4">
              <a href="mailto:arunthaiedu@gmail.com" className="group flex min-h-[8.5rem] flex-col rounded-2xl border border-[#E58C1A]/15 bg-[#FFFDF8]/80 p-5 transition hover:-translate-y-1 hover:border-[#E58C1A]/35 hover:shadow-[0_16px_35px_-25px_rgba(80,48,19,0.5)] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF1D0] text-[#C97112]"><Mail className="h-5 w-5" aria-hidden="true" /></span>
                <p className="text-brand-accent mt-4 text-xs font-bold uppercase tracking-[0.14em]">Email us</p>
                <p className="mt-1 break-words text-sm font-semibold text-[#2D2E30] group-hover:text-[#A94F00]">arunthaiedu@gmail.com</p>
              </a>
              <section className="rounded-2xl border border-[#E58C1A]/15 bg-[#FFFDF8]/80 p-5">
              <p className="text-brand-accent text-xs font-bold uppercase tracking-[0.14em]">Follow us</p>
                <div className="mt-4"><ContactChannel label="Instagram" href={CONTACT_LINKS.instagram} icon={Camera} /></div>
              </section>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#E58C1A]/18 bg-[#FFFDF8] p-6 shadow-[0_24px_60px_-38px_rgba(80,48,19,0.42)] sm:p-8 md:rounded-[2.5rem] md:p-10 lg:mt-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-brand-accent text-xs font-bold uppercase tracking-[0.2em]">Get in touch</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl">Have a Question?</h3>
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
          <label className="mt-5 flex min-h-11 items-start gap-3 rounded-xl px-1 text-sm leading-relaxed text-[#765F55]">
            <input type="checkbox" name="marketingOptIn" checked={form.marketingOptIn} onChange={updateField} className="mt-1 h-4 w-4 rounded border-[#2D2E30]/30 text-[#E58C1A] focus:ring-[#E58C1A]" />
            Send me course news and Thai learning updates too.
          </label>

          {status.message ? (
            <p className={`mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${status.type === "success" ? "bg-[#EDF8EE] text-[#246B35]" : "bg-red-50 text-red-700"}`}>
              {status.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" /> : null}{status.message}
            </p>
          ) : null}
          <button disabled={isSubmitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#2D2E30]/20 transition-all hover:-translate-y-0.5 hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? "Sending..." : "Send Message"}<Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </section>
  );
}

export default ContactSection;
