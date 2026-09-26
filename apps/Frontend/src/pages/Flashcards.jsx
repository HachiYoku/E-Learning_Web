import { ArrowLeft, FolderOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { fetchFlashcards } from "../services/flashcardService";
import FlashcardPracticeSession from "../components/FlashcardPracticeSession";

function Flashcards() {
  const location = useLocation();
  const [cards, setCards] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
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
  const start = (category) => setSelectedCategory(category);
  const leaveDeck = () => setSelectedCategory(null);
  const studentPractice = location.pathname === "/app/practice/flashcards/public";
  const backTo = studentPractice ? "/app/practice/flashcards" : "/practice";
  const backLabel = studentPractice ? "Back to Flashcards" : "Back to Practice";

  return <div className="flex min-h-screen flex-col bg-[#FFF9EA] text-[#2D2E30]">
    <Navbar />
    <main className="relative isolate flex-1 overflow-hidden px-4 py-12 sm:px-6 md:px-10 md:py-20 lg:px-16">
      <div className="absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/25 blur-3xl" />
      <div className="absolute -right-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/25 blur-3xl" />
      <div className="mx-auto w-full max-w-6xl">
        <Link to={backTo} className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:bg-[#FFF1CE] hover:text-[#C97112]"><ArrowLeft size={16} />{backLabel}</Link>
        <section className="rounded-[2rem] border border-[#E58C1A]/15 bg-white/80 p-5 shadow-[0_24px_60px_-38px_rgba(80,48,19,.38)] backdrop-blur-sm sm:p-8 md:rounded-[2.5rem] md:p-10">
          <header className="border-b border-[#2D2E30]/10 pb-7">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#C97112]">Thai foundations</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{selectedCategory?.name || "Flashcards"}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base">{selectedCategory ? "Flip each card, then rate how well you remembered it." : "Choose a topic and build your Thai vocabulary through quick recall."}</p>
          </header>
          {loading ? <Notice message="Loading flashcards..." /> : error ? <Notice message={error} error /> : !selectedCategory ? <CategoryPicker categories={categories} start={start} /> : deck.length ? <FlashcardPracticeSession cards={deck} onExit={leaveDeck} /> : <Notice message="This category has no published cards." />}
        </section>
      </div>
    </main>
    <Footer />
  </div>;
}

function CategoryPicker({ categories, start }) {
  if (!categories.length) return <Notice message="No flashcards have been published yet." />;
  return <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <button key={category._id || category.id} type="button" onClick={() => start(category)} className="group rounded-2xl border border-[#E58C1A]/20 bg-[#FFF7E8] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#E58C1A] hover:bg-[#FFF1CE] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#C97112] shadow-sm"><FolderOpen size={21} /></span><h2 className="mt-5 text-lg font-bold">{category.name}</h2><p className="mt-1 text-sm text-[#765F55]">Start practice <span className="font-bold text-[#C97112]">→</span></p></button>)}</div>;
}

function Notice({ message, error = false }) { return <div className={`mt-8 rounded-2xl border p-8 text-center text-sm font-medium ${error ? "border-red-200 bg-red-50 text-red-700" : "border-[#E58C1A]/15 bg-[#FFF9EA] text-[#765F55]"}`}>{message}</div>; }

export default Flashcards;
