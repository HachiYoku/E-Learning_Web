import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

function StudentSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const labelId = useId()
  const listboxId = useId()
  const normalizedOptions = options.map((option) => typeof option === "string" ? { value: option, label: option } : option)
  const selected = normalizedOptions.find((option) => option.value === value)

  useEffect(() => {
    const closeOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener("mousedown", closeOutside)
    return () => document.removeEventListener("mousedown", closeOutside)
  }, [])

  const choose = (nextValue) => {
    onChange(nextValue)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const closeWithEscape = (event) => {
    if (event.key !== "Escape") return
    event.preventDefault()
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <div ref={containerRef} className="relative text-sm font-bold"><span id={labelId}>{label}</span><button ref={triggerRef} type="button" aria-labelledby={labelId} aria-haspopup="listbox" aria-controls={listboxId} aria-expanded={open} onClick={() => setOpen((expanded) => !expanded)} onKeyDown={closeWithEscape} className={`mt-2 flex h-12 w-full items-center justify-between rounded-xl border bg-[#FFFDF8] px-3 text-left text-sm font-semibold text-[#2D2E30] outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 ${open ? "border-[#E58C1A] ring-4 ring-[#E58C1A]/10" : "border-[#2D2E30]/15"}`}><span>{selected?.label}</span><ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-[#765F55] transition-transform ${open ? "rotate-180" : ""}`} /></button>{open ? <div id={listboxId} role="listbox" aria-labelledby={labelId} className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-[#E58C1A]/25 bg-white p-1.5 shadow-[0_16px_30px_-18px_rgba(45,46,48,.55)]" onKeyDown={closeWithEscape}>{normalizedOptions.map((option) => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => choose(option.value)} className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#E58C1A]/30 ${option.value === value ? "bg-[#FFF1D0] text-[#9A5816]" : "text-[#2D2E30] hover:bg-[#FFF9EA]"}`}>{option.label}</button>)}</div> : null}</div>
}

export default StudentSelect
