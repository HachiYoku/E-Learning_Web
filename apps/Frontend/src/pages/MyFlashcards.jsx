import { ArrowLeft, CalendarClock, Edit3, Layers3, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPersonalFlashcardDeck, deletePersonalFlashcardDeck, fetchPersonalFlashcardDecks, updatePersonalFlashcardDeck } from "../services/personalFlashcardService";

const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "";
const setMessage = (message) => message === "You already have a flashcard deck with that name." ? "You already have a flashcard set with that name." : message;

function MyFlashcards() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deckModal, setDeckModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pending, setPending] = useState(false);

  const load = async () => {
    setLoading(true); setError("");
    try { setDecks(await fetchPersonalFlashcardDecks()); } catch (requestError) { setError(setMessage(requestError.message)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const saveDeck = async (name) => {
    if (pending) return;
    setPending(true);
    try {
      const saved = deckModal?.deck ? await updatePersonalFlashcardDeck(deckModal.deck._id, name) : await createPersonalFlashcardDeck(name);
      setDecks((items) => deckModal?.deck ? items.map((item) => item._id === saved._id ? saved : item) : [saved, ...items]);
      setDeckModal(null);
    } catch (requestError) { setDeckModal((state) => ({ ...state, error: setMessage(requestError.message) })); } finally { setPending(false); }
  };

  const removeDeck = async () => {
    if (!deleteTarget || pending) return;
    setPending(true);
    try { await deletePersonalFlashcardDeck(deleteTarget._id); setDecks((items) => items.filter((item) => item._id !== deleteTarget._id)); setDeleteTarget(null); }
    catch (requestError) { setDeleteTarget((state) => ({ ...state, error: setMessage(requestError.message) })); } finally { setPending(false); }
  };

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
    <Link to="/app/practice/flashcards" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1CE] hover:text-[#C97112]"><ArrowLeft size={16} />Back to Flashcards</Link>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#C97112]">Practice</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">My Flashcards</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base">Create and practice your own flashcards.</p></div><button type="button" onClick={() => setDeckModal({ deck: null, error: "" })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A]"><Plus size={18} />Create a Set</button></header>
    {loading ? <DeckSkeleton /> : error ? <LoadError error={error} retry={load} /> : decks.length ? <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{decks.map((deck) => <DeckCard key={deck._id} deck={deck} onRename={() => setDeckModal({ deck, error: "" })} onDelete={() => setDeleteTarget({ ...deck, error: "" })} />)}</div> : <Empty onCreate={() => setDeckModal({ deck: null, error: "" })} />}
    {deckModal && <DeckModal deck={deckModal.deck} error={deckModal.error} pending={pending} onClose={() => !pending && setDeckModal(null)} onSave={saveDeck} />}
    {deleteTarget && <DeleteDeckModal deck={deleteTarget} pending={pending} onCancel={() => !pending && setDeleteTarget(null)} onConfirm={removeDeck} />}
  </div>;
}

function DeckCard({ deck, onRename, onDelete }) {
  const managerPath = `/app/practice/flashcards/mine/${deck._id}`;
  const canPractice = deck.cardCount > 0;

  return <article className="flex min-h-52 flex-col rounded-3xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_14px_34px_-28px_rgba(45,46,48,.5)] sm:p-6">
    <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E9F4EA] text-[#246B35]"><Layers3 size={21} /></span><div className="flex gap-2"><button type="button" onClick={onRename} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#2D2E30]/15 text-[#765F55] transition hover:border-[#E58C1A]/40 hover:bg-[#FFF9EA]" aria-label={`Rename set ${deck.name}`}><Edit3 size={17} /></button><button type="button" onClick={onDelete} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-200 text-[#A34D45] transition hover:bg-red-50" aria-label={`Delete set ${deck.name}`}><Trash2 size={17} /></button></div></div>
    <h2 className="mt-6 break-words text-xl font-bold text-[#2D2E30]">{deck.name}</h2>
    <p className="mt-2 text-sm font-bold text-[#765F55]">{deck.cardCount} {deck.cardCount === 1 ? "flashcard" : "flashcards"}</p>
    <p className="mt-2 flex items-center gap-1.5 text-xs text-[#9B867C]"><CalendarClock size={14} />Updated {formatDate(deck.updatedAt)}</p>
    <div className="mt-auto border-t border-[#2D2E30]/10 pt-5">
      <div className="grid grid-cols-2 gap-2">
        <Link to={canPractice ? `${managerPath}/practice` : managerPath} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2D2E30] px-3 text-sm font-bold text-white transition hover:bg-[#E58C1A]">{canPractice ? "Practice" : "Add Flashcards"}</Link>
        <Link to={managerPath} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#2D2E30]/15 px-3 text-sm font-bold text-[#765F55] transition hover:border-[#E58C1A]/40 hover:bg-[#FFF9EA]">Manage</Link>
      </div>
    </div>
  </article>;
}
function DeckSkeleton() { return <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-3xl border border-[#2D2E30]/10 bg-white p-6"><div className="h-11 w-11 rounded-2xl bg-[#F2EFEB]" /><div className="mt-7 h-6 w-2/3 rounded bg-[#F2EFEB]" /><div className="mt-3 h-4 w-1/2 rounded bg-[#F2EFEB]" /></div>)}</div>; }
function Empty({ onCreate }) { return <section className="mt-8 rounded-3xl border border-dashed border-[#E58C1A]/35 bg-white px-5 py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1D0] text-[#C97112]"><Layers3 size={26} /></span><h2 className="mt-5 text-xl font-bold text-[#2D2E30]">No flashcard sets yet</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#765F55]">Create a flashcard set for words you want to remember and practice.</p><button type="button" onClick={onCreate} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A]"><Plus size={17} />Create your first set</button></section>; }
function LoadError({ error, retry }) { return <section className="mt-8 rounded-3xl border border-red-100 bg-white px-5 py-12 text-center"><p className="text-sm text-[#765F55]">{error}</p><button type="button" onClick={retry} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white hover:bg-[#E58C1A]"><RefreshCw size={17} />Try again</button></section>; }
function Modal({ children, title, onClose }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/60 p-4 backdrop-blur-[2px]"><section role="dialog" aria-modal="true" aria-labelledby="flashcard-dialog-title" className="w-full max-w-md rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-[#2D2E30]/10 p-5"><h2 id="flashcard-dialog-title" className="text-xl font-bold text-[#2D2E30]">{title}</h2><button type="button" onClick={onClose} className="rounded-xl p-2 text-[#765F55] hover:bg-[#FFF1D0]" aria-label="Close"><X size={19} /></button></div>{children}</section></div>; }
function DeckModal({ deck, error, pending, onClose, onSave }) { const [name, setName] = useState(deck?.name || ""); const [localError, setLocalError] = useState(""); const submit = (event) => { event.preventDefault(); if (!name.trim()) return setLocalError("A set name is required."); onSave(name); }; return <Modal title={deck ? "Rename Set" : "Create a Flashcard Set"} onClose={onClose}><form onSubmit={submit} className="p-5"><label className="block text-sm font-bold text-[#2D2E30]">Set name<input autoFocus required maxLength={80} value={name} onChange={(event) => { setName(event.target.value); setLocalError(""); }} className="mt-2 min-h-11 w-full rounded-xl border border-[#2D2E30]/15 px-3 text-sm font-normal outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15" /></label><p className="mt-2 text-xs text-[#765F55]">Up to 80 characters.</p>{(localError || error) && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{localError || error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold text-[#765F55]">Cancel</button><button disabled={pending} className="min-h-11 rounded-xl bg-[#2D2E30] px-4 text-sm font-bold text-white hover:bg-[#E58C1A] disabled:opacity-60">{pending ? "Saving..." : deck ? "Save changes" : "Create"}</button></div></form></Modal>; }
function DeleteDeckModal({ deck, pending, onCancel, onConfirm }) { return <Modal title={`Delete “${deck.name}”?`} onClose={onCancel}><div className="p-5"><p className="text-sm leading-6 text-[#765F55]">This will permanently delete this flashcard set and all {deck.cardCount} {deck.cardCount === 1 ? "flashcard" : "flashcards"} inside it.</p>{deck.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{deck.error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={pending} onClick={onCancel} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold text-[#765F55]">Cancel</button><button type="button" disabled={pending} onClick={onConfirm} className="min-h-11 rounded-xl bg-[#A34D45] px-4 text-sm font-bold text-white hover:bg-[#8E3E37] disabled:opacity-60">{pending ? "Deleting..." : "Delete Set"}</button></div></div></Modal>; }

export default MyFlashcards;
