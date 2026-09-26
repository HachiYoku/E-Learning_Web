import { ArrowLeft, Edit3, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createPersonalFlashcard, deletePersonalFlashcard, deletePersonalFlashcardDeck, fetchPersonalFlashcardDecks, fetchPersonalFlashcards, updatePersonalFlashcard, updatePersonalFlashcardDeck } from "../services/personalFlashcardService";

const emptyCard = { prompt: "", answer: "" };
const setMessage = (message) => message === "Flashcard deck not found." ? "Flashcard set not found." : message === "You already have a flashcard deck with that name." ? "You already have a flashcard set with that name." : message;

function MyFlashcardDeck() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cardModal, setCardModal] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteCardTarget, setDeleteCardTarget] = useState(null);
  const [deleteDeckOpen, setDeleteDeckOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const decks = await fetchPersonalFlashcardDecks();
      const found = decks.find((item) => item._id === deckId);
      if (!found) throw new Error("Flashcard set not found.");
      const loadedCards = await fetchPersonalFlashcards(deckId);
      setDeck(found); setCards(loadedCards);
    } catch (requestError) { setError(setMessage(requestError.message)); } finally { setLoading(false); }
  }, [deckId]);
  useEffect(() => { load(); }, [load]);

  const saveCard = async (fields) => {
    if (pending) return;
    setPending(true);
    try {
      const saved = cardModal.card ? await updatePersonalFlashcard(deckId, cardModal.card._id, fields) : await createPersonalFlashcard(deckId, fields);
      setCards((items) => cardModal.card ? items.map((item) => item._id === saved._id ? saved : item) : [saved, ...items]);
      if (!cardModal.card) setDeck((item) => ({ ...item, cardCount: item.cardCount + 1 }));
      setCardModal(null);
    } catch (requestError) { setCardModal((state) => ({ ...state, error: setMessage(requestError.message) })); } finally { setPending(false); }
  };

  const renameDeck = async (name) => {
    if (pending) return;
    setPending(true);
    try { setDeck(await updatePersonalFlashcardDeck(deckId, name)); setRenameOpen(false); }
    catch (requestError) { setRenameOpen({ error: setMessage(requestError.message) }); } finally { setPending(false); }
  };

  const removeCard = async () => {
    if (!deleteCardTarget || pending) return;
    setPending(true);
    try { await deletePersonalFlashcard(deckId, deleteCardTarget._id); setCards((items) => items.filter((item) => item._id !== deleteCardTarget._id)); setDeck((item) => ({ ...item, cardCount: Math.max(0, item.cardCount - 1) })); setDeleteCardTarget(null); }
    catch (requestError) { setDeleteCardTarget((item) => ({ ...item, error: setMessage(requestError.message) })); } finally { setPending(false); }
  };

  const removeDeck = async () => {
    if (pending) return;
    setPending(true);
    try { await deletePersonalFlashcardDeck(deckId); navigate("/app/practice/flashcards/mine", { replace: true }); }
    catch (requestError) { setDeleteDeckOpen({ error: setMessage(requestError.message) }); } finally { setPending(false); }
  };

  if (loading) return <DeckLoading />;
  if (error || !deck) return <LoadError error={error || "Flashcard set not found."} retry={load} />;
  const practicePath = `/app/practice/flashcards/mine/${deckId}/practice`;
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
    <Link to="/app/practice/flashcards/mine" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:bg-[#FFF1D0] hover:text-[#C97112]"><ArrowLeft size={17} />My Flashcards</Link>
    <header className="mt-5 flex flex-col gap-5 border-b border-[#2D2E30]/10 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#C97112]">Private flashcard set</p><h1 className="mt-3 break-words text-3xl font-bold tracking-tight sm:text-4xl">{deck.name}</h1><p className="mt-2 text-sm text-[#765F55]">{deck.cardCount} {deck.cardCount === 1 ? "flashcard" : "flashcards"}</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><button type="button" onClick={() => setRenameOpen({ error: "" })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold text-[#765F55] hover:border-[#E58C1A]/40 hover:bg-[#FFF9EA]"><Edit3 size={16} />Rename Set</button><Link to={practicePath} aria-disabled={!cards.length} onClick={(event) => { if (!cards.length) event.preventDefault(); }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold ${cards.length ? "bg-[#E9F4EA] text-[#246B35] hover:bg-[#D6EFD9]" : "cursor-not-allowed bg-[#F2EFEB] text-[#9B867C]"}`}>Start practice</Link><button type="button" onClick={() => setCardModal({ card: null, error: "" })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 text-sm font-bold text-white hover:bg-[#E58C1A]"><Plus size={17} />Add card</button></div></header>
    {cards.length ? <div className="mt-6 space-y-3">{cards.map((card) => <article key={card._id} className="rounded-2xl border border-[#2D2E30]/10 bg-white p-4 shadow-[0_12px_28px_-25px_rgba(45,46,48,.5)] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9B867C]">Prompt</p><h2 className="mt-1 break-words text-lg font-bold text-[#2D2E30]">{card.prompt}</h2><p className="mt-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#9B867C]">Answer</p><p className="mt-1 break-words text-base font-semibold text-[#C97112]">{card.answer}</p></div><div className="mt-5 grid grid-cols-2 gap-2 sm:mt-0 sm:w-44"><button type="button" onClick={() => setCardModal({ card, error: "" })} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#2D2E30]/15 px-3 text-sm font-bold text-[#765F55] hover:bg-[#FFF9EA]"><Edit3 size={15} />Edit</button><button type="button" onClick={() => setDeleteCardTarget({ ...card, error: "" })} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 text-sm font-bold text-[#A34D45] hover:bg-red-50"><Trash2 size={15} />Delete</button></div></article>)}</div> : <EmptyCards onAdd={() => setCardModal({ card: null, error: "" })} />}
    <button type="button" onClick={() => setDeleteDeckOpen({ error: "" })} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#A34D45] hover:bg-red-50"><Trash2 size={16} />Delete Set</button>
    {cardModal && <CardModal card={cardModal.card} error={cardModal.error} pending={pending} onClose={() => !pending && setCardModal(null)} onSave={saveCard} />}
    {renameOpen && <DeckNameModal deck={deck} error={renameOpen.error} pending={pending} onClose={() => !pending && setRenameOpen(false)} onSave={renameDeck} />}
    {deleteCardTarget && <ConfirmModal title="Delete flashcard?" detail="This flashcard will be permanently deleted." error={deleteCardTarget.error} pending={pending} confirm="Delete card" onCancel={() => !pending && setDeleteCardTarget(null)} onConfirm={removeCard} />}
    {deleteDeckOpen && <ConfirmModal title={`Delete “${deck.name}”?`} detail={`This will permanently delete this flashcard set and all ${deck.cardCount} ${deck.cardCount === 1 ? "flashcard" : "flashcards"} inside it.`} error={deleteDeckOpen.error} pending={pending} confirm="Delete Set" onCancel={() => !pending && setDeleteDeckOpen(false)} onConfirm={removeDeck} />}
  </div>;
}

function DeckLoading() { return <div className="mx-auto max-w-5xl animate-pulse px-4 py-10 sm:px-6 lg:px-10"><div className="h-5 w-32 rounded bg-[#F2EFEB]" /><div className="mt-8 h-10 w-64 rounded bg-[#F2EFEB]" /><div className="mt-3 h-5 w-20 rounded bg-[#F2EFEB]" /><div className="mt-10 space-y-3">{[1, 2].map((item) => <div key={item} className="h-32 rounded-2xl bg-white" />)}</div></div>; }
function LoadError({ error, retry }) { return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-10"><Link to="/app/practice/flashcards/mine" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] hover:bg-[#FFF1D0]"><ArrowLeft size={17} />My Flashcards</Link><section className="mt-6 rounded-3xl border border-red-100 bg-white px-5 py-12 text-center"><p className="text-sm text-[#765F55]">{error}</p><button type="button" onClick={retry} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]"><RefreshCw size={17} />Try again</button></section></div>; }
function EmptyCards({ onAdd }) { return <section className="mt-7 rounded-3xl border border-dashed border-[#E58C1A]/35 bg-white px-5 py-12 text-center"><h2 className="text-xl font-bold text-[#2D2E30]">No flashcards in this set yet</h2><p className="mt-2 text-sm text-[#765F55]">Add the first word or phrase you want to remember.</p><button type="button" onClick={onAdd} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D2E30] px-4 text-sm font-bold text-white hover:bg-[#E58C1A]"><Plus size={17} />Add card</button></section>; }
function Modal({ title, onClose, children }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/60 p-4 backdrop-blur-[2px]"><section role="dialog" aria-modal="true" aria-labelledby="personal-card-dialog" className="w-full max-w-lg rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-[#2D2E30]/10 p-5"><h2 id="personal-card-dialog" className="text-xl font-bold text-[#2D2E30]">{title}</h2><button type="button" onClick={onClose} className="rounded-xl p-2 text-[#765F55] hover:bg-[#FFF1D0]" aria-label="Close"><X size={19} /></button></div>{children}</section></div>; }
function CardModal({ card, error, pending, onClose, onSave }) { const [fields, setFields] = useState(card ? { prompt: card.prompt, answer: card.answer } : emptyCard); const [localError, setLocalError] = useState(""); const submit = (event) => { event.preventDefault(); if (!fields.prompt.trim() || !fields.answer.trim()) return setLocalError("Prompt and answer are required."); onSave(fields); }; return <Modal title={card ? "Edit flashcard" : "Add flashcard"} onClose={onClose}><form onSubmit={submit} className="space-y-5 p-5"><label className="block text-sm font-bold text-[#2D2E30]">Prompt<input required maxLength={280} value={fields.prompt} onChange={(event) => { setFields((item) => ({ ...item, prompt: event.target.value })); setLocalError(""); }} className="mt-2 min-h-11 w-full rounded-xl border border-[#2D2E30]/15 px-3 text-sm font-normal outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15" /></label><label className="block text-sm font-bold text-[#2D2E30]">Answer<input required maxLength={280} value={fields.answer} onChange={(event) => { setFields((item) => ({ ...item, answer: event.target.value })); setLocalError(""); }} className="mt-2 min-h-11 w-full rounded-xl border border-[#2D2E30]/15 px-3 text-sm font-normal outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15" /></label><p className="-mt-3 text-xs text-[#765F55]">Up to 280 characters each.</p>{(localError || error) && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{localError || error}</p>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold text-[#765F55]">Cancel</button><button disabled={pending} className="min-h-11 rounded-xl bg-[#2D2E30] px-4 text-sm font-bold text-white hover:bg-[#E58C1A] disabled:opacity-60">{pending ? "Saving..." : card ? "Save changes" : "Add card"}</button></div></form></Modal>; }
function DeckNameModal({ deck, error, pending, onClose, onSave }) { const [name, setName] = useState(deck.name); const [localError, setLocalError] = useState(""); const submit = (event) => { event.preventDefault(); if (!name.trim()) return setLocalError("A set name is required."); onSave(name); }; return <Modal title="Rename Set" onClose={onClose}><form onSubmit={submit} className="p-5"><label className="block text-sm font-bold text-[#2D2E30]">Set name<input autoFocus required maxLength={80} value={name} onChange={(event) => { setName(event.target.value); setLocalError(""); }} className="mt-2 min-h-11 w-full rounded-xl border border-[#2D2E30]/15 px-3 text-sm font-normal outline-none focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15" /></label>{(localError || error) && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{localError || error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold text-[#765F55]">Cancel</button><button disabled={pending} className="min-h-11 rounded-xl bg-[#2D2E30] px-4 text-sm font-bold text-white hover:bg-[#E58C1A] disabled:opacity-60">{pending ? "Saving..." : "Save changes"}</button></div></form></Modal>; }
function ConfirmModal({ title, detail, error, pending, confirm, onCancel, onConfirm }) { return <Modal title={title} onClose={onCancel}><div className="p-5"><p className="text-sm leading-6 text-[#765F55]">{detail}</p>{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={pending} onClick={onCancel} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold text-[#765F55]">Cancel</button><button type="button" disabled={pending} onClick={onConfirm} className="min-h-11 rounded-xl bg-[#A34D45] px-4 text-sm font-bold text-white hover:bg-[#8E3E37] disabled:opacity-60">{pending ? "Deleting..." : confirm}</button></div></div></Modal>; }

export default MyFlashcardDeck;
