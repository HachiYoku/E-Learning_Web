import { ArrowLeft, FolderOpen, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { fetchFlashcards } from "../services/flashcardService";

const RATINGS = [
  { key: "again", label: "Again", score: 0, note: "Didn't remember", style: "border-[#A34D45]/15 bg-[#FDE8E5] text-[#A34D45]" },
  { key: "hard", label: "Hard", score: 0.5, note: "Partially remembered", style: "border-[#E58C1A]/20 bg-[#FFF1CE] text-[#9A5816]" },
  { key: "easy", label: "Easy", score: 1, note: "Remembered", style: "border-[#4D927F]/20 bg-[#E9F4EA] text-[#246B35]" },
];

function Flashcards() {
  const [cards, setCards] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { fetchFlashcards().then(setCards).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  const categories = useMemo(() => {
    const found = new Map();
    cards.forEach((card) => { const category = card.category; const key = String(category?._id || category?.id || ""); if (key && category?.name) found.set(key, category); });
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);
  const selectedId = String(selectedCategory?._id || selectedCategory?.id || "");
  const deck = cards.filter((card) => String(card.category?._id || card.category?.id || card.category || "") === selectedId);
  const card = deck[index];
  const complete = deck.length > 0 && index >= deck.length;
  const score = useMemo(() => ratings.reduce((total, rating) => total + rating.score, 0), [ratings]);
  const reset = () => { setIndex(0); setFlipped(false); setRatings([]); };
  const start = (category) => { setSelectedCategory(category); reset(); };
  const choose = (rating) => { setRatings((items) => [...items, rating]); setFlipped(false); setIndex((current) => current + 1); };
  const leaveDeck = () => { setSelectedCategory(null); reset(); };

  return <div className="flex min-h-screen flex-col bg-[#FFF9EA] text-[#2D2E30]">
    <Navbar />
    <main className="relative isolate flex-1 overflow-hidden px-4 py-12 sm:px-6 md:px-10 md:py-20 lg:px-16">
      <div className="absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/25 blur-3xl" />
      <div className="absolute -right-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/25 blur-3xl" />
      <section className="mx-auto w-full max-w-6xl rounded-[2rem] border border-[#E58C1A]/15 bg-white/80 p-5 shadow-[0_24px_60px_-38px_rgba(80,48,19,.38)] backdrop-blur-sm sm:p-8 md:rounded-[2.5rem] md:p-10">
        <header className="border-b border-[#2D2E30]/10 pb-7">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#C97112]">Thai foundations</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{selectedCategory?.name || "Flashcards"}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base">{selectedCategory ? "Flip each card, then rate how well you remembered it." : "Choose a topic and build your Thai vocabulary through quick recall."}</p>
        </header>
        {loading ? <Notice message="Loading flashcards..." /> : error ? <Notice message={error} error /> : !selectedCategory ? <CategoryPicker categories={categories} start={start} /> : complete ? <Results deck={deck} score={score} ratings={ratings} reset={reset} leaveDeck={leaveDeck} /> : card ? <PracticeDeck card={card} deck={deck} index={index} ratings={ratings} flipped={flipped} setFlipped={setFlipped} choose={choose} leaveDeck={leaveDeck} /> : <Notice message="This category has no published cards." />}
      </section>
    </main>
    <Footer />
  </div>;
}

function CategoryPicker({ categories, start }) {
  if (!categories.length) return <Notice message="No flashcards have been published yet." />;
  return <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <button key={category._id || category.id} type="button" onClick={() => start(category)} className="group rounded-2xl border border-[#E58C1A]/20 bg-[#FFF7E8] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#E58C1A] hover:bg-[#FFF1CE] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#C97112] shadow-sm"><FolderOpen size={21} /></span><h2 className="mt-5 text-lg font-bold">{category.name}</h2><p className="mt-1 text-sm text-[#765F55]">Start practice <span className="font-bold text-[#C97112]">→</span></p></button>)}</div>;
}

function PracticeDeck({ card, deck, index, ratings, flipped, setFlipped, choose, leaveDeck }) {
  return <section className="mt-8"><button type="button" onClick={leaveDeck} className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1CE] hover:text-[#C97112]"><ArrowLeft size={16} /> All topics</button><div className="mt-6 flex items-center justify-between text-sm font-semibold text-[#765F55]"><span>Card {index + 1} of {deck.length}</span><span>{ratings.length} reviewed</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9DED2]"><div className="h-full rounded-full bg-[#E58C1A] transition-all" style={{ width: `${index / deck.length * 100}%` }} /></div><FlashCard card={card} flipped={flipped} onFlip={() => setFlipped((value) => !value)} />{flipped ? <div className="mt-5 grid grid-cols-3 gap-3">{RATINGS.map((rating) => <button key={rating.key} type="button" onClick={() => choose(rating)} className={`rounded-2xl px-3 py-4 text-center font-bold transition hover:brightness-95 ${rating.style}`}><span className="block">{rating.label}</span><span className="mt-1 block text-[11px] font-medium opacity-75">{rating.note}</span></button>)}</div> : <p className="mt-5 text-center text-sm font-semibold text-[#765F55]">Click the card to reveal the answer.</p>}</section>;
}

function FlashCard({ card, flipped, onFlip }) {
  const face = { position: "absolute", inset: 0, display: "flex", minHeight: 380, flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: "2rem", background: "white", padding: "1.75rem", textAlign: "center", boxShadow: "0 24px 55px -35px rgba(45,46,48,.55)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  return <button type="button" onClick={onFlip} aria-pressed={flipped} aria-label={flipped ? "Show flashcard front" : "Show flashcard back"} className="mt-5 block w-full rounded-[2rem] text-inherit focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/30" style={{ perspective: "1200px" }}><div style={{ position: "relative", minHeight: 380, width: "100%", transformStyle: "preserve-3d", transition: "transform 500ms ease", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}><div style={face}><p className="text-xs font-bold uppercase tracking-[.18em] text-[#C97112]">Front - click to flip</p>{card.image && <img src={card.image} alt="Flashcard prompt" className="mt-5 h-40 w-56 rounded-2xl object-cover shadow-sm" />}<h2 className={`${card.image ? "mt-6" : "mt-5"} text-3xl font-bold sm:text-4xl`}>{card.prompt}</h2></div><div style={{ ...face, transform: "rotateY(180deg)" }}><p className="text-xs font-bold uppercase tracking-[.18em] text-[#C97112]">Back - click to flip</p><h2 className="mt-5 text-3xl font-bold leading-relaxed sm:text-4xl">{card.answer}</h2>{card.translation && <p className="mt-3 text-xl text-[#765F55]">{card.translation}</p>}</div></div></button>;
}

function Results({ deck, score, ratings, reset, leaveDeck }) { return <div className="mt-8 rounded-2xl border border-[#4D927F]/20 bg-[#EDF8F3] p-6 text-center sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#397A69]">Deck complete</p><h2 className="mt-2 text-3xl font-bold">Your score: {Math.round(score / deck.length * 100)}%</h2><p className="mt-2 text-[#765F55]">{score % 1 ? score.toFixed(1) : score} / {deck.length} points</p><div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">{RATINGS.map((rating) => <div key={rating.key} className="rounded-xl bg-white/80 p-3"><p className="text-xl font-bold">{ratings.filter((item) => item.key === rating.key).length}</p><p className="text-xs font-semibold text-[#765F55]">{rating.label}</p></div>)}</div><div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={leaveDeck} className="rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm font-bold text-[#765F55] hover:bg-[#FFF9EA]">All topics</button><button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]"><RotateCcw size={17} /> Study again</button></div></div>; }
function Notice({ message, error = false }) { return <div className={`mt-8 rounded-2xl border p-8 text-center text-sm font-medium ${error ? "border-red-200 bg-red-50 text-red-700" : "border-[#E58C1A]/15 bg-[#FFF9EA] text-[#765F55]"}`}>{message}</div>; }

export default Flashcards;
