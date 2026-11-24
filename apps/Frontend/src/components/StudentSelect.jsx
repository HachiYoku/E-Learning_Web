import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

function StudentSelect({ label, value, options, onChange, menuPlacement = "absolute", disabled = false }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
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
    event.stopPropagation()
    setOpen(false)
    triggerRef.current?.focus()
  }

  const focusOption = (index) => {
    const nextIndex = (index + normalizedOptions.length) % normalizedOptions.length
    optionRefs.current[nextIndex]?.focus()
  }

  const openFromTrigger = (event) => {
    if (disabled) return
    if (event.key === "Escape") return closeWithEscape(event)
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault()
      setOpen(true)
      window.setTimeout(() => {
        if (event.key === "ArrowUp" || event.key === "End") focusOption(normalizedOptions.length - 1)
        else if (event.key === "Home") focusOption(0)
        else focusOption(Math.max(0, normalizedOptions.findIndex((option) => option.value === value)))
      }, 0)
    }
  }

  const handleOptionKeyDown = (event, index, option) => {
    if (event.key === "Escape") return closeWithEscape(event)
    if (event.key === "ArrowDown") { event.preventDefault(); focusOption(index + 1); }
    if (event.key === "ArrowUp") { event.preventDefault(); focusOption(index - 1); }
    if (event.key === "Home") { event.preventDefault(); focusOption(0); }
    if (event.key === "End") { event.preventDefault(); focusOption(normalizedOptions.length - 1); }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(option.value); }
  }

  const inlineMenu = menuPlacement === "inline"

  return <div ref={containerRef} className="relative text-sm font-bold"><span id={labelId}>{label}</span><button ref={triggerRef} type="button" disabled={disabled} aria-labelledby={labelId} aria-haspopup="listbox" aria-controls={listboxId} aria-expanded={open} onClick={() => setOpen((expanded) => !expanded)} onKeyDown={openFromTrigger} className={`mt-2 flex h-12 w-full items-center justify-between rounded-xl border bg-[#FFFDF8] px-3 text-left text-sm font-semibold text-[#2D2E30] outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 disabled:cursor-not-allowed disabled:opacity-60 ${open ? "border-[#E58C1A] ring-4 ring-[#E58C1A]/10" : "border-[#2D2E30]/15"}`}><span>{selected?.label || "Select a set"}</span><ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-[#765F55] transition-transform ${open ? "rotate-180" : ""}`} /></button>{open ? <div id={listboxId} role="listbox" aria-labelledby={labelId} className={`${inlineMenu ? "relative" : "absolute z-20"} mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-[#E58C1A]/25 bg-white p-1.5 shadow-[0_16px_30px_-18px_rgba(45,46,48,.55)]`}>{normalizedOptions.map((option, index) => <button ref={(element) => { optionRefs.current[index] = element; }} type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => choose(option.value)} onKeyDown={(event) => handleOptionKeyDown(event, index, option)} className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#E58C1A]/30 ${option.value === value ? "bg-[#FFF1D0] text-[#9A5816]" : "text-[#2D2E30] hover:bg-[#FFF9EA]"}`}>{option.label}</button>)}</div> : null}</div>
}

export default StudentSelect
