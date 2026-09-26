import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import FlashcardPracticeSession from "../components/FlashcardPracticeSession";
import { fetchPersonalFlashcardDecks, fetchPersonalFlashcards } from "../services/personalFlashcardService";

function PersonalFlashcardPractice() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const decks = await fetchPersonalFlashcardDecks();
      const found = decks.find((item) => item._id === deckId);
      if (!found) throw new Error("Flashcard deck not found.");
      const loadedCards = await fetchPersonalFlashcards(deckId);
      setDeck(found); setCards(loadedCards);
    } catch (requestError) { setError(requestError.message); } finally { setLoading(false); }
  }, [deckId]);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const deckPath = `/app/practice/flashcards/mine/${deckId}`;
  if (loading) return <LoadingState />;
  if (error || !deck) return <FailureState error={error || "Flashcard deck not found."} retry={load} deckPath={deckPath} />;
  if (!cards.length) return <EmptyState deck={deck} deckPath={deckPath} />;
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12"><header className="border-b border-[#2D2E30]/10 pb-7"><Link to={deckPath} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:bg-[#FFF1D0] hover:text-[#C97112]"><ArrowLeft size={17} />Back to deck</Link><p className="mt-5 text-xs font-bold uppercase tracking-[.22em] text-[#C97112]">Private practice</p><h1 className="mt-3 break-words text-3xl font-bold tracking-tight sm:text-4xl">{deck.name}</h1><p className="mt-2 text-sm text-[#765F55]">{cards.length} {cards.length === 1 ? "card" : "cards"} in this practice session</p></header><FlashcardPracticeSession cards={cards} onExit={() => navigate(deckPath)} exitLabel="Back to deck" /></div>;
}

function LoadingState() { return <div className="mx-auto max-w-4xl animate-pulse px-4 py-10 sm:px-6 lg:px-10"><div className="h-5 w-32 rounded bg-[#F2EFEB]" /><div className="mt-8 h-10 w-64 rounded bg-[#F2EFEB]" /><div className="mt-8 h-96 rounded-[2rem] bg-white" /></div>; }
function FailureState({ error, retry, deckPath }) { return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-10"><Link to={deckPath} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:bg-[#FFF1D0]"><ArrowLeft size={17} />Back to deck</Link><section className="mt-6 rounded-3xl border border-red-100 bg-white px-5 py-12 text-center"><p className="text-sm text-[#765F55]">{error}</p><button type="button" onClick={retry} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]"><RefreshCw size={17} />Try again</button></section></div>; }
function EmptyState({ deck, deckPath }) { return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-10"><Link to={deckPath} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:bg-[#FFF1D0]"><ArrowLeft size={17} />Back to deck</Link><section className="mt-6 rounded-3xl border border-dashed border-[#E58C1A]/35 bg-white px-5 py-12 text-center"><h1 className="text-2xl font-bold text-[#2D2E30]">{deck.name}</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#765F55]">Add some flashcards before you start practicing.</p><Link to={deckPath} className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]">Add a card</Link></section></div>; }

export default PersonalFlashcardPractice;
