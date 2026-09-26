import { CATALOGUE_CURRENCIES } from "../utils/catalogueCurrency"

export default function CatalogueCurrencySelector({ currency, onChange, compact = false }) {
  return <div className={`inline-flex items-center ${compact ? "" : "gap-3"}`} aria-label="Course catalogue currency">
    {!compact ? <span className="text-xs font-semibold text-[#765F55]">Display prices in</span> : null}
    <div className="inline-flex rounded-xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-1" role="group" aria-label="Choose display currency">
      {CATALOGUE_CURRENCIES.map((item) => {
        const selected = currency === item
        const symbol = item === "THB" ? "฿" : "Ks"
        return <button key={item} type="button" onClick={() => onChange(item)} aria-pressed={selected} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-[#E58C1A]/35 sm:px-3.5 ${selected ? "bg-[#FFF1D0] text-[#9A5816] shadow-sm" : "text-[#765F55] hover:bg-[#FFF9EA] hover:text-[#C97112]"}`}><span>{item}</span><span className={`text-[10px] ${selected ? "text-[#C97112]" : "text-[#9E887C]"}`}>{symbol}</span></button>
      })}
    </div>
  </div>
}
