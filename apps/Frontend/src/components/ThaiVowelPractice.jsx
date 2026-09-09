import { Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const vowelGroups = [
  {
    id: "short", name: "Short vowels", thaiName: "สระเสียงสั้น", description: "14 vowels", mobileGridClass: "grid-cols-3", gridClass: "md:grid-cols-5",
    styles: "border-[#E58C1A]/25 bg-[#FFF7E8] text-[#A85B09]", selectedStyles: "border-[#E58C1A] bg-[#F8C56A] text-[#2D2E30]",
    vowels: [
      { symbol: "ะ", name: "a", thaiName: "สระ อะ" }, { symbol: "ิ", name: "i", thaiName: "สระ อิ" }, { symbol: "ึ", name: "ue", thaiName: "สระ อึ" }, { symbol: "ุ", name: "u", thaiName: "สระ อุ" },
      { symbol: "เ-ะ", name: "e", thaiName: "สระ เอะ" }, { symbol: "แ-ะ", name: "ae", thaiName: "สระ แอะ" }, { symbol: "โ-ะ", name: "o", thaiName: "สระ โอะ" }, { symbol: "เ-าะ", name: "aw", thaiName: "สระ เอาะ" },
      { symbol: "ัวะ", name: "ua", thaiName: "สระ อัวะ" }, { symbol: "เ ียะ", name: "ia", thaiName: "สระ เอียะ" }, { symbol: "เ ​ือะ", name: "uea", thaiName: "สระ เอือะ" }, { symbol: "เ-อะ", name: "oe", thaiName: "สระ เออะ" },
      { symbol: "ฤ", name: "rue", thaiName: "สระ ฤ" }, { symbol: "ฦ", name: "lue", thaiName: "สระ ฦ" },
    ],
  },
  {
    id: "long", name: "Long vowels", thaiName: "สระเสียงยาว", description: "14 vowels", mobileGridClass: "grid-cols-3", gridClass: "md:grid-cols-7",
    styles: "border-[#6E9C8F]/25 bg-[#EDF8F3] text-[#397A69]", selectedStyles: "border-[#4D927F] bg-[#A9D7C7] text-[#203B33]",
    vowels: [
      { symbol: "า", name: "aa", thaiName: "สระ อา" }, { symbol: "ี", name: "ii", thaiName: "สระ อี" }, { symbol: "ือ", name: "ue", thaiName: "สระ อือ" }, { symbol: "ู", name: "uu", thaiName: "สระ อู" },
      { symbol: "เ", name: "ee", thaiName: "สระ เอ" }, { symbol: "แ", name: "ae", thaiName: "สระ แอ" }, { symbol: "โ", name: "oo", thaiName: "สระ โอ" }, { symbol: "อ", name: "aw", thaiName: "สระ ออ" },
      { symbol: "ัว", name: "ua", thaiName: "สระ อัว" }, { symbol: "เอีย", name: "ia", thaiName: "สระ เอีย" }, { symbol: "เอือ", name: "uea", thaiName: "สระ เอือ" }, { symbol: "เ-อ", name: "oe", thaiName: "สระ เออ" },
      { symbol: "ฤๅ", name: "rue", thaiName: "สระ ฤๅ" }, { symbol: "ฦๅ", name: "lue", thaiName: "สระ ฦๅ" },
    ],
  },
  {
    id: "special", name: "Special vowels", thaiName: "สระพิเศษ", description: "4 vowels", mobileGridClass: "grid-cols-2", gridClass: "md:grid-cols-4", note: "These are special short-vowel forms. For tone practice, use the same tone rules as long vowels.",
    styles: "border-[#9D7568]/25 bg-[#FCF1EC] text-[#8A5143]", selectedStyles: "border-[#C87762] bg-[#E9A9A0] text-[#2D2E30]",
    vowels: [
      { symbol: "ำ", name: "am", thaiName: "สระ อำ" }, { symbol: "ไ", name: "ai", thaiName: "สระ ไอ" }, { symbol: "ใ", name: "ai", thaiName: "สระ ใอ" }, { symbol: "เ-า", name: "ao", thaiName: "สระ เอา" },
    ],
  },
];

const thaiVowels = vowelGroups.flatMap((group) => group.vowels.map((vowel) => ({ ...vowel, group })));

function ThaiVowelPractice() {
  const [selectedVowels, setSelectedVowels] = useState(() => Object.fromEntries(vowelGroups.map((group) => [group.id, { ...group.vowels[0], group }])));
  const [speakingGroupId, setSpeakingGroupId] = useState(null);
  const audioRef = useRef(null);
  const selectedCardRefs = useRef({});

  const stopPlayback = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingGroupId(null);
  };

  useEffect(() => () => stopPlayback(), []);

  const selectVowel = (vowel) => {
    stopPlayback();
    setSelectedVowels((current) => ({ ...current, [vowel.group.id]: vowel }));
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    window.requestAnimationFrame(() => selectedCardRefs.current[vowel.group.id]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  };

  const speakWithBrowserVoice = (vowel, groupId) => {
    if (!("speechSynthesis" in window)) { setSpeakingGroupId(null); return; }
    const utterance = new SpeechSynthesisUtterance(vowel.thaiName);
    utterance.lang = "th-TH";
    utterance.rate = 0.72;
    utterance.onend = () => setSpeakingGroupId(null);
    utterance.onerror = () => setSpeakingGroupId(null);
    setSpeakingGroupId(groupId);
    window.speechSynthesis.speak(utterance);
  };

  const speakSelectedVowel = (vowel, groupId) => {
    stopPlayback();
    const vowelNumber = String(thaiVowels.findIndex((item) => item.symbol === vowel.symbol && item.group.id === groupId) + 1).padStart(2, "0");
    const audio = new Audio(`/audio/thai-vowels/${vowelNumber}.mp3`);
    let usedBrowserFallback = false;
    const useBrowserFallback = () => {
      if (usedBrowserFallback) return;
      usedBrowserFallback = true;
      if (audioRef.current === audio) audioRef.current = null;
      speakWithBrowserVoice(vowel, groupId);
    };
    audioRef.current = audio;
    audio.onended = () => setSpeakingGroupId(null);
    audio.onerror = useBrowserFallback;
    setSpeakingGroupId(groupId);
    audio.play().catch(useBrowserFallback);
  };

  return (
    <section className="rounded-[2rem] border border-[#E58C1A]/15 bg-white/80 p-5 shadow-[0_24px_60px_-38px_rgba(80,48,19,0.38)] backdrop-blur-sm sm:p-8 md:rounded-[2.5rem] md:p-10">
      <div className="border-b border-[#2D2E30]/10 pb-7">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Thai foundations</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">Thai vowels</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base">Explore Thai vowels by length and type. Select a vowel to see its name and hear its pronunciation.</p>
      </div>

      <div className="mt-8 space-y-5">
          {vowelGroups.map((group) => {
            const selectedVowel = selectedVowels[group.id];
            const isSpeaking = speakingGroupId === group.id;
            return (
            <div key={group.id} className={`rounded-2xl border p-4 sm:p-5 ${group.styles}`}>
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-bold text-[#2D2E30] sm:text-xl">{group.name}</h3><p className="mt-0.5 text-sm font-semibold">{group.thaiName}</p></div><span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold">{group.description}</span></div>
              {group.note ? <p className="mt-4 rounded-xl border border-white/70 bg-white/75 px-4 py-3 text-sm font-semibold leading-relaxed text-[#765F55]"><span className="font-bold text-[#C97112]">Note: </span>{group.note}</p> : null}
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.62fr)] lg:items-start">
                <div className={`order-2 grid gap-2 sm:grid-cols-5 sm:gap-3 lg:order-1 ${group.mobileGridClass} ${group.gridClass}`}>
                  {group.vowels.map((vowel) => {
                    const isSelected = vowel.symbol === selectedVowel.symbol;
                    return <button key={vowel.symbol} type="button" onClick={() => selectVowel({ ...vowel, group })} aria-pressed={isSelected} aria-label={`${vowel.thaiName}, ${group.name}`} className={`flex min-h-24 items-center justify-center rounded-xl border px-2 py-3 text-center transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 sm:min-h-0 sm:py-4 ${isSelected ? "border-[#C97112] bg-white/80 text-[#2D2E30] shadow-[0_8px_18px_-12px_rgba(80,48,19,0.8)]" : "border-[#2D2E30]/10 bg-white/80 text-[#2D2E30] hover:border-[#E58C1A]/50 hover:bg-[#FFF1D0]"}`}><span className="text-2xl font-bold leading-none sm:text-3xl">{vowel.symbol}</span></button>;
                  })}
                </div>
                <div ref={(element) => { selectedCardRefs.current[group.id] = element; }} className="order-1 scroll-mt-24 rounded-2xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-5 lg:order-2 sm:p-7">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9B867C]">Selected vowel</p>
                  <div className="mt-5 flex items-center gap-3 sm:gap-5"><div className="flex h-16 min-w-20 items-center justify-center rounded-2xl bg-[#2D2E30] px-3 text-3xl font-bold text-[#F8C56A] sm:h-20 sm:min-w-24 sm:text-4xl">{selectedVowel.symbol}</div><div className="min-w-0 flex-1"><h4 className="text-xl font-bold text-[#2D2E30] sm:text-2xl">{selectedVowel.thaiName}</h4></div><button type="button" onClick={() => speakSelectedVowel(selectedVowel, group.id)} aria-label={`Hear ${selectedVowel.thaiName}`} title="Hear pronunciation" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${isSpeaking ? "bg-[#E58C1A] text-white" : "bg-[#FFF1D0] text-[#C97112] hover:bg-[#F8C56A] hover:text-[#2D2E30]"}`}><Volume2 className="h-5 w-5" aria-hidden="true" /></button></div>
                  <div className="mt-6 border-t border-[#E58C1A]/15 pt-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9B867C]">Vowel group</p><p className="mt-2 text-base font-bold text-[#2D2E30]">{group.name}</p><p className="mt-1 text-sm text-[#765F55]">{group.thaiName}</p></div>
                </div>
              </div>
            </div>
          );
          })}
      </div>
    </section>
  );
}

export default ThaiVowelPractice;
