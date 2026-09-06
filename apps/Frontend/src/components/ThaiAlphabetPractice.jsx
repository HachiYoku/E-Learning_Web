import { Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const thaiConsonants = [
  { letter: "ก", name: "กอ ไก่", pronunciation: "gɔɔ gài", word: "ไก่", meaning: "chicken" },
  { letter: "ข", name: "ขอ ไข่", pronunciation: "khɔ̌ɔ khài", word: "ไข่", meaning: "egg" },
  { letter: "ฃ", name: "ฃอ ขวด", pronunciation: "khɔ̌ɔ khùat", word: "ขวด", meaning: "bottle", note: "Rarely used today" },
  { letter: "ค", name: "คอ ควาย", pronunciation: "khɔɔ khwaai", word: "ควาย", meaning: "buffalo" },
  { letter: "ฅ", name: "ฅอ คน", pronunciation: "khɔɔ khon", word: "คน", meaning: "person", note: "Rarely used today" },
  { letter: "ฆ", name: "ฆอ ระฆัง", pronunciation: "khɔɔ rá-khang", word: "ระฆัง", meaning: "bell" },
  { letter: "ง", name: "งอ งู", pronunciation: "ngɔɔ nguu", word: "งู", meaning: "snake" },
  { letter: "จ", name: "จอ จาน", pronunciation: "jɔɔ jaan", word: "จาน", meaning: "plate" },
  { letter: "ฉ", name: "ฉอ ฉิ่ง", pronunciation: "chɔ̌ɔ chìng", word: "ฉิ่ง", meaning: "small cymbals" },
  { letter: "ช", name: "ชอ ช้าง", pronunciation: "chɔɔ cháang", word: "ช้าง", meaning: "elephant" },
  { letter: "ซ", name: "ซอ โซ่", pronunciation: "sɔɔ sôo", word: "โซ่", meaning: "chain" },
  { letter: "ฌ", name: "ชอ เฌอ", pronunciation: "chɔɔ choe", word: "เฌอ", meaning: "tree" },
  { letter: "ญ", name: "ญอ หญิง", pronunciation: "yɔɔ yǐng", word: "หญิง", meaning: "woman" },
  { letter: "ฎ", name: "ดอ ชฎา", pronunciation: "dɔɔ cha-daa", word: "ชฎา", meaning: "headdress" },
  { letter: "ฏ", name: "ตอ ปฏัก", pronunciation: "tɔɔ bpà-dtàk", word: "ปฏัก", meaning: "goad" },
  { letter: "ฐ", name: "ฐอ ฐาน", pronunciation: "thɔ̌ɔ thǎan", word: "ฐาน", meaning: "pedestal" },
  { letter: "ฑ", name: "ทอ มณโฑ", pronunciation: "thɔɔ mon-thoo", word: "มณโฑ", meaning: "Montho" },
  { letter: "ฒ", name: "ทอ ผู้เฒ่า", pronunciation: "thɔɔ phûu-thâo", word: "ผู้เฒ่า", meaning: "elder" },
  { letter: "ณ", name: "นอ เณร", pronunciation: "nɔɔ neen", word: "เณร", meaning: "novice monk" },
  { letter: "ด", name: "ดอ เด็ก", pronunciation: "dɔɔ dèk", word: "เด็ก", meaning: "child" },
  { letter: "ต", name: "ตอ เต่า", pronunciation: "tɔɔ dtào", word: "เต่า", meaning: "turtle" },
  { letter: "ถ", name: "ถอ ถุง", pronunciation: "thɔ̌ɔ thǔng", word: "ถุง", meaning: "bag" },
  { letter: "ท", name: "ทอ ทหาร", pronunciation: "thɔɔ thá-hǎan", word: "ทหาร", meaning: "soldier" },
  { letter: "ธ", name: "ทอ ธง", pronunciation: "thɔɔ thong", word: "ธง", meaning: "flag" },
  { letter: "น", name: "นอ หนู", pronunciation: "nɔɔ nǔu", word: "หนู", meaning: "mouse" },
  { letter: "บ", name: "บอ ใบไม้", pronunciation: "bɔɔ bai-mái", word: "ใบไม้", meaning: "leaf" },
  { letter: "ป", name: "ปอ ปลา", pronunciation: "bpɔɔ bplaa", word: "ปลา", meaning: "fish" },
  { letter: "ผ", name: "ผอ ผึ้ง", pronunciation: "phɔ̌ɔ phʉ̂ng", word: "ผึ้ง", meaning: "bee" },
  { letter: "ฝ", name: "ฝอ ฝา", pronunciation: "fɔ̌ɔ fǎa", word: "ฝา", meaning: "lid" },
  { letter: "พ", name: "พอ พาน", pronunciation: "phɔɔ phaan", word: "พาน", meaning: "tray" },
  { letter: "ฟ", name: "ฟอ ฟัน", pronunciation: "fɔɔ fan", word: "ฟัน", meaning: "tooth" },
  { letter: "ภ", name: "ภอ สำเภา", pronunciation: "phɔɔ sǎm-phao", word: "สำเภา", meaning: "junk ship" },
  { letter: "ม", name: "มอ ม้า", pronunciation: "mɔɔ máa", word: "ม้า", meaning: "horse" },
  { letter: "ย", name: "ยอ ยักษ์", pronunciation: "yɔɔ yák", word: "ยักษ์", meaning: "giant" },
  { letter: "ร", name: "รอ เรือ", pronunciation: "rɔɔ rʉʉa", word: "เรือ", meaning: "boat" },
  { letter: "ล", name: "ลอ ลิง", pronunciation: "lɔɔ ling", word: "ลิง", meaning: "monkey" },
  { letter: "ว", name: "วอ แหวน", pronunciation: "wɔɔ wǎen", word: "แหวน", meaning: "ring" },
  { letter: "ศ", name: "ศอ ศาลา", pronunciation: "sɔ̌ɔ sǎa-laa", word: "ศาลา", meaning: "pavilion" },
  { letter: "ษ", name: "ษอ ฤๅษี", pronunciation: "sɔ̌ɔ rʉʉ-sǐi", word: "ฤๅษี", meaning: "hermit" },
  { letter: "ส", name: "สอ เสือ", pronunciation: "sɔ̌ɔ sʉ̌ʉa", word: "เสือ", meaning: "tiger" },
  { letter: "ห", name: "หอ หีบ", pronunciation: "hɔ̌ɔ hìip", word: "หีบ", meaning: "chest" },
  { letter: "ฬ", name: "ฬอ จุฬา", pronunciation: "lɔɔ jù-laa", word: "จุฬา", meaning: "kite" },
  { letter: "อ", name: "ออ อ่าง", pronunciation: "ɔɔ àang", word: "อ่าง", meaning: "basin" },
  { letter: "ฮ", name: "ฮอ นกฮูก", pronunciation: "hɔɔ nók-hûuk", word: "นกฮูก", meaning: "owl" },
];

function ThaiAlphabetPractice() {
  const [selectedLetter, setSelectedLetter] = useState(thaiConsonants[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (audioRef.current) audioRef.current.pause();
  }, []);

  const stopPlayback = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const selectLetter = (consonant) => {
    stopPlayback();
    setSelectedLetter(consonant);
  };

  const speakWithBrowserVoice = () => {
    if (!("speechSynthesis" in window)) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(`${selectedLetter.name} ${selectedLetter.word}`);
    utterance.lang = "th-TH";
    utterance.rate = 0.72;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const speakSelectedLetter = () => {
    stopPlayback();
    const letterNumber = String(thaiConsonants.findIndex((letter) => letter.letter === selectedLetter.letter) + 1).padStart(2, "0");
    const audio = new Audio(`/audio/thai-alphabet/${letterNumber}.mp3`);
    let usedBrowserFallback = false;
    const useBrowserFallback = () => {
      if (usedBrowserFallback) return;
      usedBrowserFallback = true;
      if (audioRef.current === audio) audioRef.current = null;
      speakWithBrowserVoice();
    };

    audioRef.current = audio;
    audio.onended = () => setIsSpeaking(false);
    audio.onerror = useBrowserFallback;
    setIsSpeaking(true);
    audio.play().catch(useBrowserFallback);
  };

  return (
    <section className="rounded-[2rem] border border-[#E58C1A]/15 bg-white/80 p-5 shadow-[0_24px_60px_-38px_rgba(80,48,19,0.38)] backdrop-blur-sm sm:p-8 md:rounded-[2.5rem] md:p-10">
      <div className="flex flex-col gap-5 border-b border-[#2D2E30]/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Thai foundations</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">The 44 Thai consonants</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base">Choose a letter to see its Thai name, pronunciation, and example word.</p>
        </div>
        <p className="rounded-full bg-[#FFF1D0] px-3 py-1.5 text-xs font-bold text-[#C97112]">{thaiConsonants.length} letters</p>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.62fr)] lg:items-start">
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-7 sm:gap-3">
          {thaiConsonants.map((consonant) => {
            const isSelected = consonant.letter === selectedLetter.letter;
            return (
              <button
                key={consonant.letter}
                type="button"
                onClick={() => selectLetter(consonant)}
                aria-pressed={isSelected}
                aria-label={`${consonant.name}: ${consonant.meaning}`}
                className={`aspect-square rounded-xl border text-2xl font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 sm:text-3xl ${isSelected ? "border-[#E58C1A] bg-[#F8C56A] text-[#2D2E30] shadow-[0_8px_18px_-12px_rgba(80,48,19,0.8)]" : "border-[#2D2E30]/10 bg-[#FFFDF8] text-[#2D2E30] hover:border-[#E58C1A]/50 hover:bg-[#FFF1D0]"}`}
              >
                {consonant.letter}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-6 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Selected letter</p>
          <div className="mt-5 flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#2D2E30] text-5xl font-bold text-[#F8C56A]">{selectedLetter.letter}</div>
            <div className="min-w-0 flex-1">
              <h3 className="text-2xl font-bold text-[#2D2E30]">{selectedLetter.name}</h3>
              <p className="mt-1 text-base font-semibold text-[#C97112]">{selectedLetter.pronunciation}</p>
            </div>
            <button type="button" onClick={speakSelectedLetter} aria-label={`Hear ${selectedLetter.name}`} title="Hear pronunciation" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${isSpeaking ? "bg-[#E58C1A] text-white" : "bg-[#FFF1D0] text-[#C97112] hover:bg-[#F8C56A] hover:text-[#2D2E30]"}`}>
              <Volume2 className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-6 border-t border-[#E58C1A]/15 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9B867C]">Example word</p>
            <p className="mt-2 text-2xl font-bold text-[#2D2E30]">{selectedLetter.word}</p>
            <p className="mt-1 text-sm text-[#765F55]">{selectedLetter.meaning}</p>
            {selectedLetter.note ? <p className="mt-4 rounded-lg bg-white/75 px-3 py-2 text-xs font-semibold text-[#765F55]">{selectedLetter.note}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ThaiAlphabetPractice;
