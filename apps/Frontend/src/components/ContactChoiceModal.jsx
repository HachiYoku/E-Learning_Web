import { ExternalLink, MessageCircle, Send, X } from "lucide-react";
import { createElement, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CONTACT_LINKS } from "../config/contactLinks";

function ContactOption({ label, href, icon }) {
  const content = <><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1D0] text-[#C97112]">{createElement(icon, { className: "h-5 w-5", "aria-hidden": true })}</span><span className="min-w-0 flex-1 text-left text-sm font-bold text-[#2D2E30]">{label}</span></>;

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center gap-3 rounded-xl border border-[#E58C1A]/25 bg-white px-3 py-2.5 transition hover:border-[#E58C1A]/55 hover:bg-[#FFF9EA] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15">{content}<ExternalLink className="h-4 w-4 shrink-0 text-[#C97112]" aria-hidden="true" /></a>;
  }

  return <button type="button" disabled aria-label={`${label} is not available yet`} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[#2D2E30]/10 bg-[#F7F3EE] px-3 py-2.5 text-left opacity-75 disabled:cursor-not-allowed">{content}<span className="shrink-0 text-xs font-semibold text-[#765F55]">Coming soon</span></button>;
}

function ContactChoiceModal({ isOpen, onClose, returnFocusRef }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const trigger = returnFocusRef?.current;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      trigger?.focus();
    };
  }, [isOpen, onClose, returnFocusRef]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#2D2E30]/65 p-3 backdrop-blur-[2px] sm:p-4" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="contact-choice-title" className="w-full max-w-md rounded-[1.75rem] border border-[#E58C1A]/20 bg-[#FFFDF8] shadow-[0_28px_70px_-30px_rgba(45,46,48,0.55)] sm:rounded-[2rem]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[#2D2E30]/10 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Arun Thai Academy</p>
            <h2 id="contact-choice-title" className="mt-1 text-2xl font-bold tracking-tight text-[#2D2E30]">Let&apos;s talk</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#765F55]">Choose how you&apos;d like to contact us.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#2D2E30] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15" aria-label="Close contact options"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <div className="space-y-3 px-5 py-5 sm:px-6 sm:py-6">
          <ContactOption label="Facebook Messenger" href={CONTACT_LINKS.messenger} icon={MessageCircle} />
          <ContactOption label="LINE" href={CONTACT_LINKS.line} icon={Send} />
          {!CONTACT_LINKS.messenger && !CONTACT_LINKS.line ? <p className="rounded-xl bg-[#FFF1D0]/65 px-3 py-2.5 text-xs leading-relaxed text-[#765F55]">Our contact links are being set up. Please check back soon.</p> : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default ContactChoiceModal;
