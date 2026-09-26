import { Check, ChevronDown, Plus, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createPersonalFlashcard,
  createPersonalFlashcardDeck,
  fetchPersonalFlashcardDecks,
} from "../services/personalFlashcardService";

const cleanText = (value) => String(value || "").trim();
const setMessage = (message) => String(message || "Could not save your flashcard. Please try again.").replace(/flashcard deck/gi, "flashcard set");

function SaveFlashcardComposer({ onClose, onSaved }) {
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [isSetMenuOpen, setIsSetMenuOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [createdSet, setCreatedSet] = useState(null);
  const [loadingSets, setLoadingSets] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [formError, setFormError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [pending, setPending] = useState(false);

  const loadSets = async () => {
    setLoadingSets(true);
    setLoadingError("");
    try {
      const items = await fetchPersonalFlashcardDecks();
      setDecks(items);
    } catch (error) {
      setLoadingError(setMessage(error.message || "Could not load your flashcard sets."));
    } finally {
      setLoadingSets(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchPersonalFlashcardDecks()
      .then((items) => { if (isMounted) setDecks(items); })
      .catch((error) => { if (isMounted) setLoadingError(setMessage(error.message || "Could not load your flashcard sets.")); })
      .finally(() => { if (isMounted) setLoadingSets(false); });
    return () => { isMounted = false; };
  }, []);

  const close = () => {
    if (!pending) onClose();
  };

  const chooseExistingSet = () => {
    setIsCreatingSet(false);
    setIsSetMenuOpen(false);
    setFormError("");
    setSaveError("");
  };

  const chooseNewSet = () => {
    setIsCreatingSet(true);
    setIsSetMenuOpen(false);
    setFormError("");
    setSaveError("");
  };

  const save = async (event) => {
    event.preventDefault();
    if (pending) return;

    const prompt = cleanText(front);
    const answer = cleanText(back);
    const setName = cleanText(newSetName);
    const destinationId = isCreatingSet ? createdSet?._id : selectedDeckId;

    if (!prompt || !answer) {
      setFormError("Enter both a front and back for this flashcard.");
      return;
    }
    if (isCreatingSet && !createdSet && !setName) {
      setFormError("Enter a name for your new flashcard set.");
      return;
    }
    if (!isCreatingSet && !destinationId) {
      setFormError("Choose a flashcard set.");
      return;
    }

    setFormError("");
    setSaveError("");
    setPending(true);
    let destination = createdSet;

    try {
      if (isCreatingSet && !destination) {
        destination = await createPersonalFlashcardDeck(setName);
        setCreatedSet(destination);
        setDecks((items) => [destination, ...items]);
        setSelectedDeckId(destination._id);
      }

      const deckId = isCreatingSet ? destination._id : destinationId;
      const savedDeck = isCreatingSet ? destination : decks.find((deck) => deck._id === deckId);
      await createPersonalFlashcard(deckId, { prompt, answer });
      onSaved(savedDeck || { _id: deckId, name: "your flashcard set" });
      onClose();
    } catch (error) {
      if (destination) {
        setSaveError(`Your new set “${destination.name}” was created, but the flashcard could not be saved. Please try again.`);
      } else {
        setSaveError(setMessage(error.message));
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2D2E30]/70 p-4 backdrop-blur-[2px]" onMouseDown={close}>
      <section role="dialog" aria-modal="true" aria-labelledby="save-flashcard-title" className="w-full max-w-lg rounded-3xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#2D2E30]/10 p-5">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#C97112]">Lesson notes</p><h2 id="save-flashcard-title" className="mt-1 text-xl font-bold text-[#2D2E30]">Add to My Flashcards</h2></div>
          <button type="button" disabled={pending} onClick={close} className="flex h-10 w-10 items-center justify-center rounded-xl text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#2D2E30] disabled:opacity-60" aria-label="Close add to My Flashcards"><X size={19} /></button>
        </div>

        <form onSubmit={save} className="p-5">
          <div className="space-y-4">
            <label className="block text-sm font-bold text-[#2D2E30]">Front
              <textarea maxLength={280} value={front} onChange={(event) => { setFront(event.target.value); setFormError(""); }} rows={3} className="mt-2 w-full resize-y rounded-xl border border-[#2D2E30]/15 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15" />
            </label>
            <label className="block text-sm font-bold text-[#2D2E30]">Back
              <textarea maxLength={280} value={back} onChange={(event) => { setBack(event.target.value); setFormError(""); }} rows={3} className="mt-2 w-full resize-y rounded-xl border border-[#2D2E30]/15 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15" />
            </label>

            <div>
              <span className="block text-sm font-bold text-[#2D2E30]">Save to</span>
              {loadingSets ? <p className="mt-2 text-sm text-[#765F55]">Loading your flashcard sets...</p> : loadingError ? <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p>{loadingError}</p><button type="button" onClick={loadSets} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 font-bold text-[#A34D45] hover:bg-white"><RefreshCw size={15} />Try again</button></div> : <>
                {!isCreatingSet && <div className="relative mt-2"><button type="button" aria-haspopup="listbox" aria-expanded={isSetMenuOpen} onClick={() => setIsSetMenuOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#2D2E30]/15 bg-white px-3 text-left text-sm font-normal text-[#2D2E30] outline-none transition hover:border-[#E58C1A]/45 focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15"><span className={selectedDeckId ? "" : "text-[#9B867C]"}>{decks.find((deck) => deck._id === selectedDeckId)?.name || "Select a set"}</span><ChevronDown size={17} className={`shrink-0 text-[#765F55] transition ${isSetMenuOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button>{isSetMenuOpen && <div role="listbox" aria-label="Flashcard set" className="absolute z-10 mt-2 max-h-52 w-full overflow-y-auto rounded-xl border border-[#2D2E30]/10 bg-white p-1.5 shadow-[0_16px_30px_-18px_rgba(45,46,48,.55)]">{decks.length ? decks.map((deck) => <button key={deck._id} role="option" aria-selected={deck._id === selectedDeckId} type="button" onClick={() => { setSelectedDeckId(deck._id); setIsSetMenuOpen(false); setFormError(""); }} className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm transition ${deck._id === selectedDeckId ? "bg-[#FFF1D0] font-bold text-[#9A5816]" : "text-[#2D2E30] hover:bg-[#FFF9EA]"}`}>{deck.name}</button>) : <p className="px-3 py-2 text-sm text-[#765F55]">No flashcard sets yet.</p>}</div>}</div>}
                {isCreatingSet && (createdSet ? <div className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-[#7EAF85]/30 bg-[#F5FAF5] px-3 text-sm font-bold text-[#246B35]"><Check size={17} />{createdSet.name}</div> : <label className="mt-2 block text-sm font-bold text-[#2D2E30]">Set name<input maxLength={80} value={newSetName} onChange={(event) => { setNewSetName(event.target.value); setFormError(""); }} className="mt-2 min-h-11 w-full rounded-xl border border-[#2D2E30]/15 px-3 text-sm font-normal outline-none transition focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15" /></label>)}
                <button type="button" disabled={pending} onClick={isCreatingSet ? chooseExistingSet : chooseNewSet} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#C97112] transition hover:bg-[#FFF1D0] disabled:opacity-60"><Plus size={17} />{isCreatingSet ? "Choose an existing set" : "Create a new set"}</button>
              </>}
            </div>
          </div>

          {(formError || saveError) && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError || saveError}</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={pending} onClick={close} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold text-[#765F55] disabled:opacity-60">Cancel</button>
            <button disabled={pending || loadingSets || Boolean(loadingError)} className="min-h-11 rounded-xl bg-[#2D2E30] px-4 text-sm font-bold text-white transition hover:bg-[#E58C1A] disabled:opacity-60">{pending ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SaveFlashcardModal({ isOpen, onClose, onSaved }) {
  if (!isOpen) return null;
  return <SaveFlashcardComposer onClose={onClose} onSaved={onSaved} />;
}

export default SaveFlashcardModal;
