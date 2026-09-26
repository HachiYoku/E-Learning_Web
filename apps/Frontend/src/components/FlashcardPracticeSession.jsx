import { ArrowLeft, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

const FLASHCARD_RATINGS = [
  { key: "again", label: "Again", score: 0, note: "Didn't remember", style: "border-[#A34D45]/15 bg-[#FDE8E5] text-[#A34D45]" },
  { key: "hard", label: "Hard", score: 0.5, note: "Partially remembered", style: "border-[#E58C1A]/20 bg-[#FFF1CE] text-[#9A5816]" },
  { key: "easy", label: "Easy", score: 1, note: "Remembered", style: "border-[#4D927F]/20 bg-[#E9F4EA] text-[#246B35]" },
];

function FlashcardPracticeSession({ cards, onExit, exitLabel = "All topics" }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState([]);
  const card = cards[index];
  const complete = cards.length > 0 && index >= cards.length;
  const score = useMemo(() => ratings.reduce((total, rating) => total + rating.score, 0), [ratings]);
  const reset = () => { setIndex(0); setFlipped(false); setRatings([]); };
  const choose = (rating) => { setRatings((items) => [...items, rating]); setFlipped(false); setIndex((current) => current + 1); };

  if (complete) return <Results cards={cards} score={score} ratings={ratings} reset={reset} leave={onExit} exitLabel={exitLabel} />;
  if (!card) return null;
  return <section className="mt-8"><button type="button" onClick={onExit} className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 py-1 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1CE] hover:text-[#C97112]"><ArrowLeft size={16} /> {exitLabel}</button><div className="mt-6 flex items-center justify-between text-sm font-semibold text-[#765F55]"><span>Card {index + 1} of {cards.length}</span><span>{ratings.length} reviewed</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9DED2]"><div className="h-full rounded-full bg-[#E58C1A] transition-all motion-reduce:transition-none" style={{ width: `${index / cards.length * 100}%` }} /></div><Flashcard card={card} flipped={flipped} onFlip={() => setFlipped((value) => !value)} />{flipped ? <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">{FLASHCARD_RATINGS.map((rating) => <button key={rating.key} type="button" onClick={() => choose(rating)} className={`min-h-20 rounded-2xl px-3 py-4 text-center font-bold transition hover:brightness-95 ${rating.style}`}><span className="block">{rating.label}</span><span className="mt-1 block text-[11px] font-medium opacity-75">{rating.note}</span></button>)}</div> : <p className="mt-5 text-center text-sm font-semibold text-[#765F55]">Click the card to reveal the answer.</p>}</section>;
}

function Flashcard({ card, flipped, onFlip }) {
  const face = { position: "absolute", inset: 0, display: "flex", minHeight: 380, flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: "2rem", background: "white", padding: "1.75rem", textAlign: "center", boxShadow: "0 24px 55px -35px rgba(45,46,48,.55)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  return <button type="button" onClick={onFlip} aria-pressed={flipped} aria-label={flipped ? "Show flashcard front" : "Show flashcard back"} className="mt-5 block w-full rounded-[2rem] text-inherit focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/30" style={{ perspective: "1200px" }}><div className={`flashcard-flip-inner ${flipped ? "flashcard-flip-inner--flipped" : ""}`} style={{ position: "relative", minHeight: 380, width: "100%", transformStyle: "preserve-3d" }}><div style={face}><p className="text-xs font-bold uppercase tracking-[.18em] text-[#C97112]">Front - click to flip</p>{card.image && <img src={card.image} alt="Flashcard prompt" className="mt-5 h-40 w-56 rounded-2xl object-cover shadow-sm" />}<h2 className={`${card.image ? "mt-6" : "mt-5"} text-3xl font-bold sm:text-4xl`}>{card.prompt}</h2></div><div style={{ ...face, transform: "rotateY(180deg)" }}><p className="text-xs font-bold uppercase tracking-[.18em] text-[#C97112]">Back - click to flip</p><h2 className="mt-5 text-3xl font-bold leading-relaxed sm:text-4xl">{card.answer}</h2>{card.translation && <p className="mt-3 text-xl text-[#765F55]">{card.translation}</p>}</div></div></button>;
}

function Results({ cards, score, ratings, reset, leave, exitLabel }) { return <div className="mt-8 rounded-2xl border border-[#4D927F]/20 bg-[#EDF8F3] p-6 text-center sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#397A69]">Practice complete</p><h2 className="mt-2 text-3xl font-bold">{cards.length} {cards.length === 1 ? "card" : "cards"} reviewed</h2><p className="mt-2 text-[#765F55]">Your score: {Math.round(score / cards.length * 100)}% · {score % 1 ? score.toFixed(1) : score} / {cards.length} points</p><div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">{FLASHCARD_RATINGS.map((rating) => <div key={rating.key} className="rounded-xl bg-white/80 p-3"><p className="text-xl font-bold">{ratings.filter((item) => item.key === rating.key).length}</p><p className="text-xs font-semibold text-[#765F55]">{rating.label}</p></div>)}</div><div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={leave} className="min-h-11 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm font-bold text-[#765F55] hover:bg-[#FFF9EA]">{exitLabel}</button><button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]"><RotateCcw size={17} />Practice again</button></div></div>; }

export default FlashcardPracticeSession;
