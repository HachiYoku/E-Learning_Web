import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function QuizDialog({ title, message, confirmText, onConfirm, onCancel }) {
  const dialog = useRef(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    const origin = document.activeElement;
    const node = dialog.current;
    node.querySelector("button")?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); cancel.current(); }
      if (event.key === "Tab") {
        const buttons = [...node.querySelectorAll("button:not(:disabled)")];
        const next = event.shiftKey ? buttons.at(-1) : buttons[0];
        if (!node.contains(document.activeElement) || document.activeElement === (event.shiftKey ? buttons[0] : buttons.at(-1))) { event.preventDefault(); next?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); origin?.focus(); };
  }, []);
  return createPortal(<div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2D2E30]/55 p-4">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="quiz-confirmation-title" aria-describedby="quiz-confirmation-description" className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E58C1A]/20 bg-white shadow-2xl">
      <h2 id="quiz-confirmation-title" className="bg-[#FFF9EA] p-6 text-xl font-bold text-[#2D2E30]">{title}</h2>
      <p id="quiz-confirmation-description" className="p-6 text-sm leading-6 text-[#765F55]">{message}</p>
      <div className="flex flex-wrap justify-end gap-3 border-t border-[#2D2E30]/10 p-5">
        <button type="button" onClick={onCancel} className="rounded-xl border border-[#2D2E30]/15 px-5 py-3 font-bold text-[#765F55] focus:ring-4 focus:ring-[#E58C1A]/25">Cancel</button>
        <button type="button" onClick={onConfirm} className="rounded-xl bg-[#2D2E30] px-5 py-3 font-bold text-white focus:ring-4 focus:ring-[#E58C1A]/25">{confirmText}</button>
      </div>
    </section>
  </div>, document.body);
}
