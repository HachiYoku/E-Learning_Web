import { ArrowLeft, Brain, Check, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { countGraphemes } from "../utils/flashcardText";

const FLASHCARD_RATINGS = [
  { key: "again", label: "Again", score: 0, note: "Didn't remember", Icon: RotateCcw, style: "border-[#A34D45]/15 bg-[#FDE8E5] text-[#A34D45]" },
  { key: "hard", label: "Hard", score: 0.5, note: "Partially remembered", Icon: Brain, style: "border-[#E58C1A]/20 bg-[#FFF1CE] text-[#9A5816]" },
  { key: "easy", label: "Easy", score: 1, note: "Remembered", Icon: Check, style: "border-[#4D927F]/20 bg-[#E9F4EA] text-[#246B35]" },
];

function FlashcardPracticeSession({ cards, onRate, onExit, exitLabel = "All topics", mode = "practice" }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [ratingPending, setRatingPending] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const [unavailableCard, setUnavailableCard] = useState(null);
  const ratingInFlight = useRef(false);
  const card = cards[index];
  const complete = cards.length > 0 && index >= cards.length;
  const score = useMemo(() => ratings.reduce((total, rating) => total + rating.score, 0), [ratings]);
  const reset = () => { setIndex(0); setFlipped(false); setRatings([]); setRatingError(""); setUnavailableCard(null); };
  const choose = async (rating) => {
    if (ratingInFlight.current) return;
    ratingInFlight.current = true;
    setRatingPending(true);
    setRatingError("");
    try {
      if (onRate) await onRate(card, rating.key);
      setRatings((items) => [...items, rating]);
      setFlipped(false);
      setIndex((current) => current + 1);
    } catch (requestError) {
      if (mode === "review" && requestError?.status === 404) setUnavailableCard(card);
      else setRatingError("Couldn't save your review. Please try again.");
    } finally {
      ratingInFlight.current = false;
      setRatingPending(false);
    }
  };

  if (complete) return <Results cards={cards} score={score} ratings={ratings} reset={reset} leave={onExit} exitLabel={exitLabel} mode={mode} />;
  if (unavailableCard) return <UnavailableCard onExit={onExit} exitLabel={exitLabel} onContinue={() => { setUnavailableCard(null); setFlipped(false); setRatingError(""); setIndex((current) => current + 1); }} />;
  if (!card) return null;
  return <section className="mt-8"><button type="button" onClick={onExit} className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 py-1 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1CE] hover:text-[#C97112]"><ArrowLeft size={16} /> {exitLabel}</button><div className="mt-6 flex items-center justify-between text-sm font-semibold text-[#765F55]"><span>Card {index + 1} of {cards.length}</span><span>{ratings.length} reviewed</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9DED2]"><div className="h-full rounded-full bg-[#E58C1A] transition-all motion-reduce:transition-none" style={{ width: `${index / cards.length * 100}%` }} /></div><Flashcard card={card} flipped={flipped} disabled={ratingPending} onFlip={() => setFlipped((value) => !value)} />{flipped ? <><div className="mt-5 grid grid-cols-3 gap-2" aria-busy={ratingPending}>{FLASHCARD_RATINGS.map((rating) => { const Icon = rating.Icon; return <button key={rating.key} type="button" disabled={ratingPending} onClick={() => choose(rating)} aria-label={`${rating.label} — ${rating.note}`} className={`inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-sm font-bold transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60 sm:min-h-16 ${rating.style}`}><Icon size={18} aria-hidden="true" /><span>{rating.label}</span></button>; })}</div><p className="mt-2 min-h-6 text-center text-sm font-semibold text-[#765F55]" role={ratingError ? "alert" : "status"} aria-live="polite">{ratingError || (ratingPending ? "Saving your review..." : "")}</p></> : <p className="mt-5 text-center text-sm font-semibold text-[#765F55]">Tap the card or use Flip card to reveal the answer.</p>}</section>;
}

function textSize(value) {
  const length = countGraphemes(value);
  if (length <= 20) return "text-3xl sm:text-4xl";
  if (length <= 50) return "text-2xl sm:text-3xl";
  if (length <= 100) return "text-xl sm:text-2xl";
  return "text-base sm:text-lg";
}

function FaceText({ value, extra, hasMedia, onScroll }) {
  const contentRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const measure = () => setOverflowing(content.clientHeight > 0 && content.scrollHeight > content.clientHeight + 1);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(content);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [value, extra, hasMedia]);

  return <div ref={contentRef} className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1" onScroll={onScroll}><div className={!hasMedia && !overflowing ? "flex min-h-full flex-col justify-center" : ""}><h2 className={`break-words [overflow-wrap:anywhere] font-bold leading-[1.45] ${textSize(value)}`}>{value}</h2>{extra && <p className="mt-3 break-words [overflow-wrap:anywhere] text-base leading-[1.45] text-[#765F55] sm:text-xl">{extra}</p>}</div></div>;
}

function Flashcard({ card, flipped, disabled, onFlip }) {
  const pointer = useRef(null);
  const face = { position: "absolute", inset: 0, display: "flex", minHeight: 380, flexDirection: "column", borderRadius: "2rem", background: "white", padding: "1.75rem", textAlign: "center", boxShadow: "0 24px 55px -35px rgba(45,46,48,.55)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  const interactiveTarget = (target) => target instanceof Element && Boolean(target.closest("button, a, input, select, textarea, audio, video, [data-flashcard-no-flip]"));
  const beginPointer = (event) => {
    if (disabled || interactiveTarget(event.target)) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, cancelled: false };
  };
  const trackPointer = (event) => {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 8) active.moved = true;
  };
  const cancelPointer = (event) => {
    if (pointer.current?.id === event.pointerId) pointer.current = null;
  };
  const completePointer = (event) => {
    const active = pointer.current;
    pointer.current = null;
    if (!active || active.id !== event.pointerId || active.moved || active.cancelled || disabled || interactiveTarget(event.target)) return;
    onFlip();
  };
  const noteScroll = () => { if (pointer.current) pointer.current.moved = true; };
  const faceContent = (label, value, extra, image) => <><p className="shrink-0 text-xs font-bold uppercase tracking-[.18em] text-[#C97112]">{label}</p>{image && <img src={image} alt="Flashcard prompt" className="mx-auto mt-5 h-40 w-56 shrink-0 rounded-2xl object-cover shadow-sm" />}<FaceText value={value} extra={extra} hasMedia={Boolean(image)} onScroll={noteScroll} /></>;
  const flipLabel = flipped ? "Show flashcard front" : "Show flashcard back";
  return <div className="mt-5 w-full" style={{ perspective: "1200px" }}><div onPointerDown={beginPointer} onPointerMove={trackPointer} onPointerCancel={cancelPointer} onPointerUp={completePointer} className={`cursor-pointer rounded-[2rem] ${disabled ? "cursor-wait" : ""}`}><div className={`flashcard-flip-inner ${flipped ? "flashcard-flip-inner--flipped" : ""}`} style={{ position: "relative", minHeight: 380, width: "100%", transformStyle: "preserve-3d" }}><div style={{ ...face, pointerEvents: flipped ? "none" : "auto" }}>{faceContent("Front", card.prompt, null, card.image)}</div><div style={{ ...face, transform: "rotateY(180deg)", pointerEvents: flipped ? "auto" : "none" }}>{faceContent("Back", card.answer, card.translation)}</div></div></div><button type="button" disabled={disabled} onClick={onFlip} aria-pressed={flipped} aria-label={flipLabel} className="mx-auto mt-3 flex min-h-10 items-center rounded-full px-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1CE] hover:text-[#C97112] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/30 disabled:cursor-wait">{flipped ? "Show front" : "Flip card"}</button></div>;
}

function UnavailableCard({ onExit, exitLabel, onContinue }) { return <section className="mt-8 rounded-2xl border border-[#E58C1A]/25 bg-[#FFF9EA] p-6 text-center sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#C97112]">Flashcard unavailable</p><h2 className="mt-2 text-2xl font-bold text-[#2D2E30]">This flashcard is no longer available.</h2><p className="mt-2 text-sm leading-6 text-[#765F55]">It has been removed from your flashcards, so it was not added to this review.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={onExit} className="min-h-11 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm font-bold text-[#765F55] hover:bg-[#FFF9EA]">{exitLabel}</button><button type="button" onClick={onContinue} className="min-h-11 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]">Continue</button></div></section>; }

function Results({ cards, score, ratings, reset, leave, exitLabel, mode }) { const reviewMode = mode === "review"; const reviewedCount = reviewMode ? ratings.length : cards.length; return <div className="mt-8 rounded-2xl border border-[#4D927F]/20 bg-[#EDF8F3] p-6 text-center sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#397A69]">{reviewMode ? "Review Complete" : "Practice complete"}</p><h2 className="mt-2 text-3xl font-bold">{reviewedCount} {reviewedCount === 1 ? "card" : "cards"} reviewed</h2>{!reviewMode && <p className="mt-2 text-[#765F55]">Your score: {Math.round(score / cards.length * 100)}% · {score % 1 ? score.toFixed(1) : score} / {cards.length} points</p>}<div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">{FLASHCARD_RATINGS.map((rating) => <div key={rating.key} className="rounded-xl bg-white/80 p-3"><p className="text-xl font-bold">{ratings.filter((item) => item.key === rating.key).length}</p><p className="text-xs font-semibold text-[#765F55]">{rating.label}</p></div>)}</div><div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={leave} className="min-h-11 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm font-bold text-[#765F55] hover:bg-[#FFF9EA]">{exitLabel}</button>{!reviewMode && <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]"><RotateCcw size={17} />Practice again</button>}</div></div>; }

export default FlashcardPracticeSession;
