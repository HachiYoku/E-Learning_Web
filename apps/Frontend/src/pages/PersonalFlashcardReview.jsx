import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FlashcardPracticeSession from "../components/FlashcardPracticeSession";
import { fetchDuePersonalFlashcards, ratePersonalFlashcard } from "../services/flashcardReviewService";

const MY_FLASHCARDS_PATH = "/app/practice/flashcards/mine";

function PersonalFlashcardReview() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchDuePersonalFlashcards(20);
      setCards(Array.isArray(response?.reviews) ? response.reviews.map((item) => item?.card).filter(Boolean) : []);
    } catch (requestError) {
      setError(requestError.message || "We couldn't load your flashcards ready for review.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <FailureState error={error} retry={load} />;
  if (!cards.length) return <CaughtUpState />;

  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
    <header className="border-b border-[#2D2E30]/10 pb-7">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-[#C97112]">Private review</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Ready to Review</h1>
      <p className="mt-2 text-sm text-[#765F55]">{cards.length} {cards.length === 1 ? "flashcard is" : "flashcards are"} ready for review.</p>
    </header>
    <FlashcardPracticeSession cards={cards} onRate={(card, rating) => ratePersonalFlashcard(card._id, rating)} onExit={() => navigate(MY_FLASHCARDS_PATH)} exitLabel="Back to My Flashcards" mode="review" />
  </div>;
}

function LoadingState() { return <div className="mx-auto max-w-4xl animate-pulse px-4 py-10 sm:px-6 lg:px-10"><div className="h-5 w-32 rounded bg-[#F2EFEB]" /><div className="mt-8 h-10 w-64 rounded bg-[#F2EFEB]" /><div className="mt-8 h-96 rounded-[2rem] bg-white" /></div>; }
function FailureState({ error, retry }) { return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-10"><Link to={MY_FLASHCARDS_PATH} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:bg-[#FFF1D0]"><ArrowLeft size={17} />Back to My Flashcards</Link><section className="mt-6 rounded-3xl border border-red-100 bg-white px-5 py-12 text-center"><p role="alert" className="text-sm text-[#765F55]">{error}</p><button type="button" onClick={retry} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]"><RefreshCw size={17} />Try again</button></section></div>; }
function CaughtUpState() { return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-10"><Link to={MY_FLASHCARDS_PATH} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:bg-[#FFF1D0]"><ArrowLeft size={17} />Back to My Flashcards</Link><section className="mt-6 rounded-3xl border border-[#4D927F]/20 bg-[#EDF8F3] px-5 py-12 text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#397A69]">Review</p><h1 className="mt-2 text-2xl font-bold text-[#2D2E30]">You&apos;re all caught up</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#765F55]">There are no personal flashcards ready for review right now.</p><Link to={MY_FLASHCARDS_PATH} className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]">Back to My Flashcards</Link></section></div>; }

export default PersonalFlashcardReview;
