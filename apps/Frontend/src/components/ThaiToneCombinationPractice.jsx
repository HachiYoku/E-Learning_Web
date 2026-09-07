import { useRef, useState } from "react";
import { Volume2 } from "lucide-react";

const toneMarks = [
  { mark: "", displayMark: "–", thaiName: "ไม่มีวรรณยุกต์", name: "No tone mark", color: "border-[#E58C1A]/30 bg-[#FFF7E8]" },
  { mark: "่", displayMark: "่", thaiName: "ไม้เอก", name: "Mai ek", color: "border-[#C87762]/30 bg-[#FCF1EC]" },
  { mark: "้", displayMark: "้", thaiName: "ไม้โท", name: "Mai tho", color: "border-[#B78A29]/30 bg-[#FFF8D9]" },
  { mark: "๊", displayMark: "๊", thaiName: "ไม้ตรี", name: "Mai tri", color: "border-[#6E9C8F]/30 bg-[#EDF8F3]" },
  { mark: "๋", displayMark: "๋", thaiName: "ไม้จัตวา", name: "Mai chattawa", color: "border-[#8B78B8]/30 bg-[#F3EFFA]" },
];

const consonantGroups = [
  { name: "Mid", letters: ["ก", "จ", "ฎ", "ฏ", "ด", "ต", "บ", "ป", "อ"], color: "text-[#A85B09]" },
  { name: "High", letters: ["ข", "ฃ", "ฉ", "ฐ", "ถ", "ผ", "ฝ", "ศ", "ษ", "ส", "ห"], color: "text-[#8A5143]" },
  { name: "Low", letters: ["ค", "ฅ", "ฆ", "ง", "ช", "ซ", "ฌ", "ญ", "ฑ", "ฒ", "ณ", "ท", "ธ", "น", "พ", "ฟ", "ภ", "ม", "ย", "ร", "ล", "ว", "ฬ", "ฮ"], color: "text-[#397A69]" },
];

const vowels = [
  { id: "aa", symbol: "า", name: "aa", length: "Long", prefix: "", suffix: "า" }, { id: "a", symbol: "ะ", name: "a", length: "Short", prefix: "", suffix: "ะ" },
  { id: "ii", symbol: "ี", name: "ii", length: "Long", prefix: "", suffix: "ี" }, { id: "i", symbol: "ิ", name: "i", length: "Short", prefix: "", suffix: "ิ" },
  { id: "uu", symbol: "ู", name: "uu", length: "Long", prefix: "", suffix: "ู" }, { id: "u", symbol: "ุ", name: "u", length: "Short", prefix: "", suffix: "ุ" },
  { id: "ee", symbol: "เ–", name: "ee", length: "Long", prefix: "เ", suffix: "" }, { id: "e", symbol: "เ–ะ", name: "e", length: "Short", prefix: "เ", suffix: "ะ" },
  { id: "ae", symbol: "แ–", name: "ae", length: "Long", prefix: "แ", suffix: "" }, { id: "o", symbol: "โ–", name: "o", length: "Long", prefix: "โ", suffix: "" }, { id: "ai", symbol: "ไ–", name: "ai", length: "Long", prefix: "ไ", suffix: "" },
];

const endings = [
  { id: "open", letter: "–", name: "Open", type: "Live" }, { id: "ng", letter: "ง", name: "ng", type: "Live" }, { id: "n", letter: "น", name: "n", type: "Live" }, { id: "m", letter: "ม", name: "m", type: "Live" }, { id: "y", letter: "ย", name: "y", type: "Live" }, { id: "w", letter: "ว", name: "w", type: "Live" },
  { id: "k", letter: "ก", name: "k", type: "Dead" }, { id: "t", letter: "ด", name: "t", type: "Dead" }, { id: "p", letter: "บ", name: "p", type: "Dead" },
];

const getToneResult = (consonantClass, toneMark, syllableType, vowelLength) => {
  if (toneMark) {
    const markedTones = { Mid: { "่": "Low tone", "้": "Falling tone", "๊": "High tone", "๋": "Rising tone" }, High: { "่": "Low tone", "้": "Falling tone" }, Low: { "่": "Falling tone", "้": "High tone" } };
    return markedTones[consonantClass][toneMark] || "Not normally used";
  }
  if (syllableType === "Live") return consonantClass === "High" ? "Rising tone" : "Mid tone";
  if (consonantClass === "Low") return vowelLength === "Short" ? "High tone" : "Falling tone";
  return "Low tone";
};

const buildSyllable = (consonant, vowel, ending, toneMark) => `${vowel.prefix}${consonant}${toneMark}${vowel.suffix}${ending.id === "open" ? "" : ending.letter}`;

const getConsonantClass = (letter) => consonantGroups.find((group) => group.letters.includes(letter));

function ThaiToneCombinationPractice() {
  const [selectedTone, setSelectedTone] = useState(toneMarks[0]);
  const [selectedConsonant, setSelectedConsonant] = useState("ก");
  const [selectedVowel, setSelectedVowel] = useState(vowels[0]);
  const [selectedEnding, setSelectedEnding] = useState(endings[0]);
  const [isToneRevealed, setIsToneRevealed] = useState(true);
  const selectedCombinationRef = useRef(null);
  const selectedClass = getConsonantClass(selectedConsonant);
  const selectedToneResult = getToneResult(selectedClass.name, selectedTone.mark, selectedEnding.type, selectedVowel.length);
  const combination = buildSyllable(selectedConsonant, selectedVowel, selectedEnding, selectedTone.mark);
  const speakCombination = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(combination);
    utterance.lang = "th-TH";
    utterance.rate = 0.72;
    window.speechSynthesis.speak(utterance);
  };
  const selectToneMark = (tone) => {
    setSelectedTone(tone);
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    window.requestAnimationFrame(() => {
      selectedCombinationRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  return (
    <section className="rounded-[2rem] border border-[#E58C1A]/15 bg-white/80 p-5 shadow-[0_24px_60px_-38px_rgba(80,48,19,0.38)] backdrop-blur-sm sm:p-8 md:rounded-[2.5rem] md:p-10">
      <div className="border-b border-[#2D2E30]/10 pb-7">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Thai foundations · Step 2</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">Tone combinations</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base">Choose any consonant, then explore how each tone mark changes the combination.</p>
      </div>

      <div className="mt-7 rounded-2xl border border-[#E58C1A]/15 bg-[#FFF9EA] p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">How to read this chart</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#765F55]">Build a standard Thai syllable step by step. The result uses consonant class, vowel length, ending type, and tone mark.</p>
      </div>

      <div className="mt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-bold text-[#2D2E30]">1. Choose a consonant</h3>
          <p className={`text-sm font-bold ${selectedClass.color}`}>{selectedClass.name} class</p>
        </div>
        <div className="mt-4 space-y-4">
          {consonantGroups.map((group) => (
            <div key={group.name} className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-2">
              <span className={`pt-2 text-xs font-bold uppercase tracking-wider ${group.color}`}>{group.name}</span>
              <div className="flex flex-wrap gap-1.5">
                {group.letters.map((letter) => {
                  const isSelected = letter === selectedConsonant;
                  return <button key={letter} type="button" onClick={() => setSelectedConsonant(letter)} aria-pressed={isSelected} aria-label={`${letter}, ${group.name} class`} className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${isSelected ? "border-[#E58C1A] bg-[#F8C56A] text-[#2D2E30]" : "border-[#2D2E30]/10 bg-[#FFFDF8] text-[#2D2E30] hover:border-[#E58C1A]/50 hover:bg-[#FFF1D0]"}`}>{letter}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-7 lg:grid-cols-2">
        <div>
          <h3 className="text-xl font-bold text-[#2D2E30]">2. Choose a vowel</h3>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {vowels.map((vowel) => {
              const isSelected = vowel.id === selectedVowel.id;
              return <button key={vowel.id} type="button" onClick={() => setSelectedVowel(vowel)} aria-pressed={isSelected} className={`rounded-xl border p-2.5 text-center transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${isSelected ? "border-[#E58C1A] bg-[#FFF1D0]" : "border-[#2D2E30]/10 bg-[#FFFDF8] hover:border-[#E58C1A]/50"}`}><span className="block text-xl font-bold text-[#2D2E30]">{vowel.symbol}</span><span className="mt-1 block text-[11px] font-semibold text-[#765F55]">{vowel.name} · {vowel.length}</span></button>;
            })}
          </div>
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#2D2E30]">3. Choose an ending</h3>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {endings.map((ending) => {
              const isSelected = ending.id === selectedEnding.id;
              return <button key={ending.id} type="button" onClick={() => setSelectedEnding(ending)} aria-pressed={isSelected} className={`rounded-xl border p-2.5 text-center transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${isSelected ? "border-[#E58C1A] bg-[#FFF1D0]" : "border-[#2D2E30]/10 bg-[#FFFDF8] hover:border-[#E58C1A]/50"}`}><span className="block text-xl font-bold text-[#2D2E30]">{ending.letter}</span><span className="mt-1 block text-[11px] font-semibold text-[#765F55]">{ending.name} · {ending.type}</span></button>;
            })}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-bold text-[#2D2E30]">4. Choose a tone mark</h3>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {toneMarks.map((tone) => {
          const isSelected = tone.mark === selectedTone.mark;
          const toneResult = getToneResult(selectedClass.name, tone.mark, selectedEnding.type, selectedVowel.length);
          const isLessCommon = toneResult === "Not normally used";
          return (
            <button
              key={tone.name}
              type="button"
              onClick={() => selectToneMark(tone)}
              aria-pressed={isSelected}
              className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${tone.color} ${isSelected ? "ring-2 ring-[#E58C1A] shadow-[0_10px_24px_-18px_rgba(80,48,19,0.7)]" : "hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-18px_rgba(80,48,19,0.5)]"}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-2xl font-bold text-[#2D2E30]">{tone.displayMark}</span>
              <span className="mt-3 block text-base font-bold text-[#2D2E30]">{tone.thaiName}</span>
              <span className="mt-0.5 block text-xs font-semibold text-[#765F55]">{tone.name}</span>
              <span className={`mt-2 block text-xs font-bold leading-4 ${isLessCommon ? "text-[#69538E]" : "text-[#765F55]"}`}>{toneResult}</span>
            </button>
          );
        })}
        </div>
      </div>

      <div ref={selectedCombinationRef} className={`mt-6 rounded-2xl border p-4 shadow-[0_18px_35px_-28px_rgba(80,48,19,0.6)] sm:p-6 ${selectedTone.color}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#765F55]">Your selected combination</p>
            <p className="mt-1 text-sm font-semibold text-[#2D2E30]">Read the syllable, then check its tone.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={speakCombination} aria-label={`Hear ${combination}`} title="Hear syllable" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#C97112] transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20"><Volume2 className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" onClick={() => setIsToneRevealed((isRevealed) => !isRevealed)} className="rounded-full bg-white/75 px-3 py-1.5 text-xs font-bold text-[#C97112] transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20">{isToneRevealed ? "Try yourself" : "Reveal tone"}</button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-center">
          <div className="flex min-h-32 items-center justify-center rounded-2xl bg-[#2D2E30] px-4 text-5xl font-bold text-[#F8C56A] shadow-[0_10px_22px_-14px_rgba(45,46,48,0.9)] sm:text-6xl">{combination}</div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#2D2E30]">{selectedTone.thaiName} · {selectedTone.name}</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold">
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-[#765F55]">{selectedClass.name} class</span>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-[#765F55]">{selectedVowel.length} vowel</span>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-[#765F55]">{selectedEnding.type} syllable</span>
            </div>
            <p className="mt-4 text-base font-bold text-[#C97112]">{isToneRevealed ? `Result: ${selectedToneResult}` : "Predict the tone, then reveal your answer."}</p>
            {selectedToneResult === "Not normally used" ? <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs font-medium text-[#69538E]">This combination is still available to explore.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ThaiToneCombinationPractice;
