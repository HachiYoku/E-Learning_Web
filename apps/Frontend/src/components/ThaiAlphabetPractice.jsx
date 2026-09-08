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
  { letter: "ณ", name: "นอ เณร", pronunciation: "nɔɔ neen", word: "เณร", meaning: "novice monk", note: "Less common in everyday Thai" },
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
  { letter: "ฬ", name: "ฬอ จุฬา", pronunciation: "lɔɔ jù-laa", word: "จุฬา", meaning: "kite", note: "Less common in everyday Thai" },
  { letter: "อ", name: "ออ อ่าง", pronunciation: "ɔɔ àang", word: "อ่าง", meaning: "basin" },
  { letter: "ฮ", name: "ฮอ นกฮูก", pronunciation: "hɔɔ nók-hûuk", word: "นกฮูก", meaning: "owl" },
];

const consonantClasses = [
  {
    name: "Mid class",
    thaiName: "อักษรกลาง",
    description: "9 consonants",
    letters: ["ก", "จ", "ด", "ฎ", "ต", "ฏ", "บ", "ป", "อ"],
    styles: "border-[#E58C1A]/25 bg-[#FFF7E8] text-[#A85B09]",
    selectedStyles: "border-[#E58C1A] bg-[#F8C56A] text-[#2D2E30]",
  },
  {
    name: "High class",
    thaiName: "อักษรสูง",
    description: "11 consonants",
    letters: ["ข", "ฃ", "ฉ", "ฐ", "ถ", "ผ", "ฝ", "ศ", "ษ", "ส", "ห"],
    styles: "border-[#9D7568]/25 bg-[#FCF1EC] text-[#8A5143]",
    selectedStyles: "border-[#C87762] bg-[#E9A9A0] text-[#2D2E30]",
  },
  {
    name: "Low class",
    thaiName: "อักษรต่ำ",
    description: "24 consonants",
    letters: ["ง", "น", "ณ", "ม", "ย", "ญ", "ร", "ล", "ฬ", "ว", "ค", "ฆ", "ฅ", "ภ", "พ", "ฟ", "ช", "ฌ", "ซ", "ท", "ฒ", "ฑ", "ธ", "ฮ"],
    styles: "border-[#6E9C8F]/25 bg-[#EDF8F3] text-[#397A69]",
    selectedStyles: "border-[#4D927F] bg-[#A9D7C7] text-[#203B33]",
  },
];

const leadingHaCombinations = [
  { letter: "ง", combination: "หง" },
  { letter: "น", combination: "หน" },
  { letter: "ณ", combination: "หณ" },
  { letter: "ม", combination: "หม" },
  { letter: "ย", combination: "หย" },
  { letter: "ญ", combination: "หญ" },
  { letter: "ร", combination: "หร" },
  { letter: "ล", combination: "หล" },
  { letter: "ฬ", combination: "หฬ" },
  { letter: "ว", combination: "หว" },
];

const consonantClusterGroups = [
  { name: "ร", thaiName: "รอ เรือ", clusters: [
    { cluster: "กร", word: "กราบ", meaning: "to bow" }, { cluster: "ขร", word: "ขรุขระ", meaning: "rough" }, { cluster: "คร", word: "ครู", meaning: "teacher" },
    { cluster: "ตร", word: "ตรง", meaning: "straight" }, { cluster: "ปร", word: "ปรับ", meaning: "to adjust" }, { cluster: "พร", word: "พระ", meaning: "monk" },
  ] },
  { name: "ล", thaiName: "ลอ ลิง", clusters: [
    { cluster: "กล", word: "กลัว", meaning: "afraid" }, { cluster: "ขล", word: "ขลาด", meaning: "cowardly" }, { cluster: "คล", word: "คลาย", meaning: "to loosen" },
    { cluster: "ปล", word: "ปลา", meaning: "fish" }, { cluster: "ผล", word: "ผลไม้", meaning: "fruit" }, { cluster: "พล", word: "พลอย", meaning: "gem" },
  ] },
  { name: "ว", thaiName: "วอ แหวน", clusters: [
    { cluster: "กว", word: "กวาง", meaning: "deer" }, { cluster: "ขว", word: "ขวาน", meaning: "axe" }, { cluster: "คว", word: "ควาย", meaning: "buffalo" },
  ] },
];

const consonantClusters = consonantClusterGroups.flatMap((group) => group.clusters);

const leadingOExamples = [
  { word: "อย่า", pronunciation: "yàa", meaning: "do not / don't" },
  { word: "อยาก", pronunciation: "yàak", meaning: "to want" },
  { word: "อย่าง", pronunciation: "yàang", meaning: "kind / type" },
  { word: "อยู่", pronunciation: "yùu", meaning: "to stay / be located" },
];

const specialRaCombinations = [
  { combination: "สร", sound: "ส", word: "สร้าง", pronunciation: "sâang", meaning: "to build" },
  { combination: "ศร", sound: "ส", word: "ศรี", pronunciation: "sǐi", meaning: "glory / honour" },
  { combination: "จร", sound: "จ", word: "จริง", pronunciation: "jing", meaning: "true / really" },
  { combination: "ซร", sound: "ซ", word: "ไซร้", pronunciation: "sái", meaning: "indeed (poetic)" },
  { combination: "ทร", sound: "ซ", word: "ทราบ", pronunciation: "sâap", meaning: "to know" },
];

function ThaiAlphabetPractice() {
  const [selectedLetter, setSelectedLetter] = useState(thaiConsonants[0]);
  const [selectedLeadingHa, setSelectedLeadingHa] = useState(leadingHaCombinations[0]);
  const [selectedCluster, setSelectedCluster] = useState(consonantClusters[0]);
  const [selectedLeadingO, setSelectedLeadingO] = useState(leadingOExamples[0]);
  const [selectedSpecialRa, setSelectedSpecialRa] = useState(specialRaCombinations[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLeadingHaSpeaking, setIsLeadingHaSpeaking] = useState(false);
  const [isClusterSpeaking, setIsClusterSpeaking] = useState(false);
  const [isLeadingOSpeaking, setIsLeadingOSpeaking] = useState(false);
  const [isSpecialRaSpeaking, setIsSpecialRaSpeaking] = useState(false);
  const audioRef = useRef(null);
  const leadingHaAudioRef = useRef(null);
  const clusterAudioRef = useRef(null);
  const leadingOAudioRef = useRef(null);
  const specialRaAudioRef = useRef(null);
  const selectedCardRef = useRef(null);
  const leadingHaCardRef = useRef(null);
  const clusterCardRef = useRef(null);
  const leadingOCardRef = useRef(null);
  const specialRaCardRef = useRef(null);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (audioRef.current) audioRef.current.pause();
    if (leadingHaAudioRef.current) leadingHaAudioRef.current.pause();
    if (clusterAudioRef.current) clusterAudioRef.current.pause();
    if (leadingOAudioRef.current) leadingOAudioRef.current.pause();
    if (specialRaAudioRef.current) specialRaAudioRef.current.pause();
  }, []);

  const stopPlayback = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (leadingHaAudioRef.current) {
      leadingHaAudioRef.current.pause();
      leadingHaAudioRef.current = null;
    }
    if (clusterAudioRef.current) {
      clusterAudioRef.current.pause();
      clusterAudioRef.current = null;
    }
    if (leadingOAudioRef.current) {
      leadingOAudioRef.current.pause();
      leadingOAudioRef.current = null;
    }
    if (specialRaAudioRef.current) {
      specialRaAudioRef.current.pause();
      specialRaAudioRef.current = null;
    }
    setIsSpeaking(false);
    setIsLeadingHaSpeaking(false);
    setIsClusterSpeaking(false);
    setIsLeadingOSpeaking(false);
    setIsSpecialRaSpeaking(false);
  };

  const selectLetter = (consonant) => {
    stopPlayback();
    setSelectedLetter(consonant);

    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    window.requestAnimationFrame(() => {
      const selectedCard = selectedCardRef.current;
      if (!selectedCard) return;

      const { top, bottom } = selectedCard.getBoundingClientRect();
      const isOutsideViewport = top < 0 || bottom > window.innerHeight;
      if (!isOutsideViewport) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      selectedCard.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  };

  const selectLeadingHa = (combination) => {
    stopPlayback();
    setSelectedLeadingHa(combination);
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    window.requestAnimationFrame(() => {
      leadingHaCardRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const selectCluster = (cluster) => {
    stopPlayback();
    setSelectedCluster(cluster);
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    window.requestAnimationFrame(() => {
      clusterCardRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const selectLeadingO = (example) => {
    stopPlayback();
    setSelectedLeadingO(example);
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    window.requestAnimationFrame(() => {
      leadingOCardRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const selectSpecialRa = (combination) => {
    stopPlayback();
    setSelectedSpecialRa(combination);
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    window.requestAnimationFrame(() => {
      specialRaCardRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const speakSelectedLetter = () => {
    stopPlayback();
    const letterNumber = String(thaiConsonants.findIndex((letter) => letter.letter === selectedLetter.letter) + 1).padStart(2, "0");
    const audio = new Audio(`/audio/thai-alphabet/${letterNumber}.mp3`);

    audioRef.current = audio;
    audio.onended = () => {
      if (audioRef.current === audio) audioRef.current = null;
      setIsSpeaking(false);
    };
    audio.onerror = () => {
      if (audioRef.current === audio) audioRef.current = null;
      setIsSpeaking(false);
    };
    setIsSpeaking(true);
    audio.play().catch(() => setIsSpeaking(false));
  };

  const speakLeadingHaWithBrowserVoice = () => {
    if (!("speechSynthesis" in window)) {
      setIsLeadingHaSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(selectedLeadingHa.combination);
    utterance.lang = "th-TH";
    utterance.rate = 0.72;
    utterance.onend = () => setIsLeadingHaSpeaking(false);
    utterance.onerror = () => setIsLeadingHaSpeaking(false);
    setIsLeadingHaSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const speakSelectedLeadingHa = () => {
    stopPlayback();
    const combinationNumber = String(leadingHaCombinations.findIndex((item) => item.combination === selectedLeadingHa.combination) + 1).padStart(2, "0");
    const audio = new Audio(`/audio/leading-ha/${combinationNumber}.mp3`);
    let usedBrowserFallback = false;
    const useBrowserFallback = () => {
      if (usedBrowserFallback) return;
      usedBrowserFallback = true;
      if (leadingHaAudioRef.current === audio) leadingHaAudioRef.current = null;
      speakLeadingHaWithBrowserVoice();
    };

    leadingHaAudioRef.current = audio;
    audio.onended = () => setIsLeadingHaSpeaking(false);
    audio.onerror = useBrowserFallback;
    setIsLeadingHaSpeaking(true);
    audio.play().catch(useBrowserFallback);
  };

  const speakClusterWithBrowserVoice = () => {
    if (!("speechSynthesis" in window)) {
      setIsClusterSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(selectedCluster.word);
    utterance.lang = "th-TH";
    utterance.rate = 0.72;
    utterance.onend = () => setIsClusterSpeaking(false);
    utterance.onerror = () => setIsClusterSpeaking(false);
    setIsClusterSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const speakSelectedCluster = () => {
    stopPlayback();
    const clusterNumber = String(consonantClusters.findIndex((item) => item.cluster === selectedCluster.cluster) + 1).padStart(2, "0");
    const audio = new Audio(`/audio/consonant-clusters/${clusterNumber}.mp3`);
    let usedBrowserFallback = false;
    const useBrowserFallback = () => {
      if (usedBrowserFallback) return;
      usedBrowserFallback = true;
      if (clusterAudioRef.current === audio) clusterAudioRef.current = null;
      speakClusterWithBrowserVoice();
    };

    clusterAudioRef.current = audio;
    audio.onended = () => setIsClusterSpeaking(false);
    audio.onerror = useBrowserFallback;
    setIsClusterSpeaking(true);
    audio.play().catch(useBrowserFallback);
  };

  const speakLeadingOWithBrowserVoice = () => {
    if (!("speechSynthesis" in window)) {
      setIsLeadingOSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(selectedLeadingO.word);
    utterance.lang = "th-TH";
    utterance.rate = 0.72;
    utterance.onend = () => setIsLeadingOSpeaking(false);
    utterance.onerror = () => setIsLeadingOSpeaking(false);
    setIsLeadingOSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const speakSelectedLeadingO = () => {
    stopPlayback();
    const exampleNumber = String(leadingOExamples.findIndex((item) => item.word === selectedLeadingO.word) + 1).padStart(2, "0");
    const audio = new Audio(`/audio/leading-o/${exampleNumber}.mp3`);
    let usedBrowserFallback = false;
    const useBrowserFallback = () => {
      if (usedBrowserFallback) return;
      usedBrowserFallback = true;
      if (leadingOAudioRef.current === audio) leadingOAudioRef.current = null;
      speakLeadingOWithBrowserVoice();
    };

    leadingOAudioRef.current = audio;
    audio.onended = () => setIsLeadingOSpeaking(false);
    audio.onerror = useBrowserFallback;
    setIsLeadingOSpeaking(true);
    audio.play().catch(useBrowserFallback);
  };

  const speakSpecialRaWithBrowserVoice = () => {
    if (!("speechSynthesis" in window)) {
      setIsSpecialRaSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(selectedSpecialRa.word);
    utterance.lang = "th-TH";
    utterance.rate = 0.72;
    utterance.onend = () => setIsSpecialRaSpeaking(false);
    utterance.onerror = () => setIsSpecialRaSpeaking(false);
    setIsSpecialRaSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const speakSelectedSpecialRa = () => {
    stopPlayback();
    const combinationNumber = String(specialRaCombinations.findIndex((item) => item.combination === selectedSpecialRa.combination) + 1).padStart(2, "0");
    const audio = new Audio(`/audio/special-ra/${combinationNumber}.mp3`);
    let usedBrowserFallback = false;
    const useBrowserFallback = () => {
      if (usedBrowserFallback) return;
      usedBrowserFallback = true;
      if (specialRaAudioRef.current === audio) specialRaAudioRef.current = null;
      speakSpecialRaWithBrowserVoice();
    };

    specialRaAudioRef.current = audio;
    audio.onended = () => setIsSpecialRaSpeaking(false);
    audio.onerror = useBrowserFallback;
    setIsSpecialRaSpeaking(true);
    audio.play().catch(useBrowserFallback);
  };

  return (
    <section className="rounded-[2rem] border border-[#E58C1A]/15 bg-white/80 p-5 shadow-[0_24px_60px_-38px_rgba(80,48,19,0.38)] backdrop-blur-sm sm:p-8 md:rounded-[2.5rem] md:p-10">
      <div className="flex flex-col gap-5 border-b border-[#2D2E30]/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Thai Consonants</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">The 44 Thai consonants</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base">Choose a letter to see its Thai name, pronunciation, and example word.</p>
        </div>
        <p className="rounded-full bg-[#FFF1D0] px-3 py-1.5 text-xs font-bold text-[#C97112]">{thaiConsonants.length} letters</p>
      </div>

      <div className="mt-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Tone classes</p>
            <h3 className="mt-2 text-xl font-bold text-[#2D2E30] sm:text-2xl">Thai consonants by class</h3>
          </div>
          <p className="text-sm text-[#765F55]">Select a letter to practise it.</p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {consonantClasses.map((consonantClass) => (
            <section key={consonantClass.name} className={`rounded-2xl border p-4 sm:p-5 ${consonantClass.styles}`} aria-labelledby={`${consonantClass.name.replace(" ", "-")}-heading`}>
              <div className="flex items-baseline justify-between gap-3">
                <h4 id={`${consonantClass.name.replace(" ", "-")}-heading`} className="text-lg font-bold">{consonantClass.name} <span className="font-medium">({consonantClass.thaiName})</span></h4>
                <span className="shrink-0 text-xs font-bold opacity-75">{consonantClass.description}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {consonantClass.letters.map((letter) => {
                  const consonant = thaiConsonants.find((item) => item.letter === letter);
                  const isSelected = letter === selectedLetter.letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => selectLetter(consonant)}
                      aria-pressed={isSelected}
                      aria-label={`${consonant.name}, ${consonantClass.name}`}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${isSelected ? consonantClass.selectedStyles : "border-current/15 bg-white/70 hover:bg-white"}`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.62fr)] lg:items-start">
        <div className="order-2 lg:order-1">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Dictionary order</p>
              <h3 className="mt-2 text-xl font-bold text-[#2D2E30] sm:text-2xl">Thai consonants in dictionary order</h3>
            </div>
            <p className="text-sm text-[#765F55]">Select a letter to practise it.</p>
          </div>
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
        </div>

        <div ref={selectedCardRef} className="order-1 scroll-mt-24 rounded-2xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-5 sm:p-7 lg:order-2">
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

      <div className="mt-10 border-t border-[#2D2E30]/10 pt-9">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Leading consonants</p>
            <h3 className="mt-2 text-xl font-bold text-[#2D2E30] sm:text-2xl">Leading ห (ห นำ) combinations</h3>
          </div>
          <p className="text-sm text-[#765F55]">Select a combination to explore it.</p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.62fr)] lg:items-start">
          <div className="order-2 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3 lg:order-1">
            {leadingHaCombinations.map((combination) => {
              const isSelected = combination.combination === selectedLeadingHa.combination;
              return <button key={combination.letter} type="button" onClick={() => selectLeadingHa(combination)} aria-pressed={isSelected} aria-label={`Leading ห with ${combination.letter}`} className={`rounded-xl border px-3 py-3 text-2xl font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 sm:py-4 ${isSelected ? "border-[#E58C1A] bg-[#F8C56A] text-[#2D2E30] shadow-[0_8px_18px_-12px_rgba(80,48,19,0.8)]" : "border-[#2D2E30]/10 bg-[#FFFDF8] text-[#2D2E30] hover:border-[#E58C1A]/50 hover:bg-[#FFF1D0]"}`}>{combination.combination}</button>;
            })}
          </div>

          <div ref={leadingHaCardRef} className="order-1 scroll-mt-24 rounded-2xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-5 sm:p-7 lg:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Selected combination</p>
            <div className="mt-5 flex items-center gap-3 sm:gap-5">
              <div className="flex h-16 min-w-20 items-center justify-center rounded-2xl bg-[#2D2E30] px-3 text-3xl font-bold text-[#F8C56A] sm:h-20 sm:min-w-24 sm:text-4xl">{selectedLeadingHa.combination}</div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xl font-bold text-[#2D2E30] sm:text-2xl">ห นำ {selectedLeadingHa.letter}</h4>
                <p className="mt-1 text-sm font-semibold text-[#C97112]">Leading ห + {selectedLeadingHa.letter}</p>
              </div>
              <button type="button" onClick={speakSelectedLeadingHa} aria-label={`Hear ห นำ ${selectedLeadingHa.letter}`} title="Hear pronunciation" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${isLeadingHaSpeaking ? "bg-[#E58C1A] text-white" : "bg-[#FFF1D0] text-[#C97112] hover:bg-[#F8C56A] hover:text-[#2D2E30]"}`}><Volume2 className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <p className="mt-6 border-t border-[#E58C1A]/15 pt-5 text-sm leading-relaxed text-[#765F55]">In a ห นำ combination, ห is silent and helps the following low-class consonant follow high-class tone rules.</p>
            {["ณ", "ฬ"].includes(selectedLeadingHa.letter) ? <p className="mt-4 rounded-lg bg-white/75 px-3 py-2 text-xs font-semibold text-[#765F55]">{selectedLeadingHa.letter}อ is not normally used.</p> : null}
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-[#2D2E30]/10 pt-9">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Leading consonants</p>
            <h3 className="mt-2 text-xl font-bold text-[#2D2E30] sm:text-2xl">Leading อ (อ นำ) with ย</h3>
          </div>
          <p className="text-sm text-[#765F55]">Select a word to explore it.</p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.62fr)] lg:items-start">
          <div className="order-2 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:order-1">
            {leadingOExamples.map((example) => {
              const isSelected = example.word === selectedLeadingO.word;
              return <button key={example.word} type="button" onClick={() => selectLeadingO(example)} aria-pressed={isSelected} aria-label={`${example.word}: ${example.meaning}`} className={`rounded-xl border px-3 py-3 text-2xl font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 sm:py-4 ${isSelected ? "border-[#E58C1A] bg-[#F8C56A] text-[#2D2E30] shadow-[0_8px_18px_-12px_rgba(80,48,19,0.8)]" : "border-[#2D2E30]/10 bg-[#FFFDF8] text-[#2D2E30] hover:border-[#E58C1A]/50 hover:bg-[#FFF1D0]"}`}>{example.word}</button>;
            })}
          </div>

          <div ref={leadingOCardRef} className="order-1 scroll-mt-24 rounded-2xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-5 sm:p-7 lg:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Selected word</p>
            <div className="mt-5 flex items-center gap-3 sm:gap-5">
              <div className="flex h-16 min-w-20 items-center justify-center rounded-2xl bg-[#2D2E30] px-3 text-3xl font-bold text-[#F8C56A] sm:h-20 sm:min-w-24 sm:text-4xl">{selectedLeadingO.word}</div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xl font-bold text-[#2D2E30] sm:text-2xl">อ นำ ย</h4>
                <p className="mt-1 text-sm font-semibold text-[#C97112]">{selectedLeadingO.pronunciation} · {selectedLeadingO.meaning}</p>
              </div>
              <button type="button" onClick={speakSelectedLeadingO} aria-label={`Hear ${selectedLeadingO.word}`} title="Hear pronunciation" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${isLeadingOSpeaking ? "bg-[#E58C1A] text-white" : "bg-[#FFF1D0] text-[#C97112] hover:bg-[#F8C56A] hover:text-[#2D2E30]"}`}><Volume2 className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <p className="mt-6 border-t border-[#E58C1A]/15 pt-5 text-sm leading-relaxed text-[#765F55]">In these four words, อ is silent and makes ย follow mid-class tone rules.</p>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-[#2D2E30]/10 pt-9">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Consonant clusters</p>
            <h3 className="mt-2 text-xl font-bold text-[#2D2E30] sm:text-2xl">True consonant clusters (อักษรควบแท้)</h3>
          </div>
          <p className="text-sm text-[#765F55]">Select a cluster to practise it.</p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.62fr)] lg:items-start">
          <div className="order-2 space-y-4 lg:order-1">
            {consonantClusterGroups.map((group) => (
              <div key={group.name} className="rounded-2xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF1D0] text-xl font-bold text-[#C97112]">{group.name}</span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-[#2D2E30] sm:text-base">Clusters with {group.name}</h4>
                      <p className="mt-0.5 text-xs font-semibold text-[#765F55]">{group.thaiName}</p>
                    </div>
                  </div>
                  <span className="shrink-0 pt-1 text-xs font-bold text-[#C97112]">{group.clusters.length} clusters</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                  {group.clusters.map((cluster) => {
                    const isSelected = cluster.cluster === selectedCluster.cluster;
                    return <button key={cluster.cluster} type="button" onClick={() => selectCluster(cluster)} aria-pressed={isSelected} aria-label={`${cluster.cluster}, example ${cluster.word}`} className={`rounded-xl border px-3 py-3 text-2xl font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 sm:min-w-16 sm:py-3 ${isSelected ? "border-[#E58C1A] bg-[#F8C56A] text-[#2D2E30] shadow-[0_8px_18px_-12px_rgba(80,48,19,0.8)]" : "border-[#2D2E30]/10 bg-white text-[#2D2E30] hover:border-[#E58C1A]/50 hover:bg-[#FFF1D0]"}`}>{cluster.cluster}</button>;
                  })}
                </div>
              </div>
            ))}
          </div>

          <div ref={clusterCardRef} className="order-1 scroll-mt-24 rounded-2xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-5 sm:p-7 lg:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Selected cluster</p>
            <div className="mt-5 flex items-center gap-3 sm:gap-5">
              <div className="flex h-16 min-w-20 items-center justify-center rounded-2xl bg-[#2D2E30] px-3 text-3xl font-bold text-[#F8C56A] sm:h-20 sm:min-w-24 sm:text-4xl">{selectedCluster.cluster}</div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xl font-bold text-[#2D2E30] sm:text-2xl">{selectedCluster.cluster}</h4>
              </div>
              <button type="button" onClick={speakSelectedCluster} aria-label={`Hear ${selectedCluster.word}`} title="Hear pronunciation" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${isClusterSpeaking ? "bg-[#E58C1A] text-white" : "bg-[#FFF1D0] text-[#C97112] hover:bg-[#F8C56A] hover:text-[#2D2E30]"}`}><Volume2 className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <div className="mt-6 border-t border-[#E58C1A]/15 pt-5">
              <p className="text-sm leading-relaxed text-[#765F55]">Both consonants are pronounced together at the beginning of the syllable.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-[#2D2E30]/10 pt-9">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Special pronunciation</p>
            <h3 className="mt-2 text-xl font-bold text-[#2D2E30] sm:text-2xl">Special ร combinations (อักษรควบไม่แท้)</h3>
          </div>
          <p className="text-sm text-[#765F55]">Select a combination to hear how it is read.</p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.62fr)] lg:items-start">
          <div className="order-2 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3 lg:order-1">
            {specialRaCombinations.map((combination) => {
              const isSelected = combination.combination === selectedSpecialRa.combination;
              return <button key={combination.combination} type="button" onClick={() => selectSpecialRa(combination)} aria-pressed={isSelected} aria-label={`${combination.combination}, read as ${combination.sound}`} className={`rounded-xl border px-3 py-3 text-2xl font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 sm:py-4 ${isSelected ? "border-[#E58C1A] bg-[#F8C56A] text-[#2D2E30] shadow-[0_8px_18px_-12px_rgba(80,48,19,0.8)]" : "border-[#2D2E30]/10 bg-[#FFFDF8] text-[#2D2E30] hover:border-[#E58C1A]/50 hover:bg-[#FFF1D0]"}`}>{combination.combination}</button>;
            })}
          </div>

          <div ref={specialRaCardRef} className="order-1 scroll-mt-24 rounded-2xl border border-[#E58C1A]/20 bg-[#FFF9EA] p-5 sm:p-7 lg:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Selected combination</p>
            <div className="mt-5 flex items-center gap-3 sm:gap-5">
              <div className="flex h-16 min-w-20 items-center justify-center rounded-2xl bg-[#2D2E30] px-3 text-3xl font-bold text-[#F8C56A] sm:h-20 sm:min-w-24 sm:text-4xl">{selectedSpecialRa.combination}</div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xl font-bold text-[#2D2E30] sm:text-2xl">Read as {selectedSpecialRa.sound}</h4>
              </div>
              <button type="button" onClick={speakSelectedSpecialRa} aria-label={`Hear ${selectedSpecialRa.word}`} title="Hear pronunciation" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${isSpecialRaSpeaking ? "bg-[#E58C1A] text-white" : "bg-[#FFF1D0] text-[#C97112] hover:bg-[#F8C56A] hover:text-[#2D2E30]"}`}><Volume2 className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <div className="mt-6 border-t border-[#E58C1A]/15 pt-5">
              <p className="text-sm leading-relaxed text-[#765F55]">In these combinations, ร is not pronounced as an r sound.</p>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}

export default ThaiAlphabetPractice;
