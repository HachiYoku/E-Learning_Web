import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export default function GeneralPracticeSelect({ label, value, options, onChange, placeholder, invalid = false }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const choices = useRef([])
  const labelId = useId()
  const listId = useId()
  const items = options.map((option) => typeof option === 'string' ? { value: option, label: option } : option)
  const selected = items.find((option) => option.value === value)

  useEffect(() => {
    const closeOutside = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [])

  const focusChoice = (index) => requestAnimationFrame(() => choices.current[index]?.focus())
  const openAt = (index) => { setOpen(true); focusChoice(index) }
  const choose = (nextValue) => { onChange(nextValue); setOpen(false); trigger.current?.focus() }
  const onTriggerKey = (event) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const selectedIndex = Math.max(0, items.findIndex((item) => item.value === value))
      openAt(event.key === 'ArrowUp' ? (selectedIndex - 1 + items.length) % items.length : (selectedIndex + 1) % items.length)
    }
  }
  const onOptionKey = (event, index) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      choices.current[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
  }

  return <div ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} className="relative text-sm font-bold text-[#2D2E30]">
    <span id={labelId}>{label}</span>
    <button ref={trigger} type="button" aria-labelledby={labelId} aria-haspopup="listbox" aria-controls={listId} aria-expanded={open} aria-invalid={invalid || undefined} onClick={() => setOpen((current) => !current)} onKeyDown={onTriggerKey} className={`mt-2 flex min-h-11 w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm font-medium text-[#2D2E30] shadow-sm transition hover:border-[#E58C1A]/45 focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/10 ${open ? 'border-[#E58C1A]' : 'border-[#2D2E30]/15'}`}>
      <span className={selected ? '' : 'text-[#9B867C]'}>{selected?.label || placeholder}</span><ChevronDown size={18} aria-hidden="true" className={`text-[#C97112] transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open ? <div id={listId} role="listbox" aria-labelledby={labelId} className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#E58C1A]/25 bg-white p-1.5 shadow-xl shadow-[#2D2E30]/15">
      {items.map((option, index) => <button key={option.value} ref={(node) => { choices.current[index] = node }} type="button" role="option" aria-selected={option.value === value} onClick={() => choose(option.value)} onKeyDown={(event) => onOptionKey(event, index)} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[#E58C1A]/30 ${option.value === value ? 'bg-[#FFF1CE] font-bold text-[#C97112]' : 'font-medium text-[#2D2E30] hover:bg-[#FFF9EA]'}`}>{option.label}{option.value === value ? <Check size={16} aria-hidden="true" /> : null}</button>)}
    </div> : null}
  </div>
}
