import { FolderOpen, FolderPlus, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import StudentSelect from "./StudentSelect";
import {
  createPersonalFlashcard,
  createPersonalFlashcardDeck,
  fetchPersonalFlashcardDecks,
} from "../services/personalFlashcardService";
import { countGraphemes, FLASHCARD_BACK_LIMIT, FLASHCARD_FRONT_LIMIT, validateFlashcardField } from "../utils/flashcardText";

const cleanText = (value) => String(value || "").trim();
const setMessage = (message) => String(message || "Could not save your flashcard. Please try again.").replace(/flashcard deck/gi, "flashcard set");
const lastSetStorageKey = (userId) => `arunthai:flashcards:last-set:${userId}`;

function readLastSetId(userId) {
  if (!userId || typeof window === "undefined") return "";
  try { return window.localStorage.getItem(lastSetStorageKey(userId)) || ""; } catch { return ""; }
}

function rememberLastSet(userId, deckId) {
  if (!userId || !deckId || typeof window === "undefined") return;
  try { window.localStorage.setItem(lastSetStorageKey(userId), deckId); } catch { /* Saving a preference must never block a flashcard save. */ }
}

function focusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((element) => !element.hasAttribute("hidden"));
}

function SaveFlashcardComposer({ onClose, onSaved, onCardSaved, initialFront = "", initialBack = "", userId }) {
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [mode, setMode] = useState("existing");
  const [front, setFront] = useState(() => String(initialFront || ""));
  const [back, setBack] = useState(() => String(initialBack || ""));
  const [newSetName, setNewSetName] = useState("");
  const [loadingSets, setLoadingSets] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [formError, setFormError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [pending, setPending] = useState(false);
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(null);

  const loadSets = async () => {
    setLoadingSets(true);
    setLoadingError("");
    try {
      const items = await fetchPersonalFlashcardDecks();
      const nextDecks = Array.isArray(items) ? items : [];
      const rememberedDeckId = readLastSetId(userId);
      setDecks(nextDecks);
      if (!nextDecks.length) {
        setSelectedDeckId("");
        setMode("new");
        return;
      }
      const nextSelectedId = nextDecks.some((deck) => deck._id === rememberedDeckId)
        ? rememberedDeckId
        : nextDecks.some((deck) => deck._id === selectedDeckId) ? selectedDeckId : "";
      setSelectedDeckId(nextSelectedId);
      setMode("existing");
    } catch (error) {
      setLoadingError(setMessage(error.message || "Could not load your flashcard sets."));
    } finally {
      setLoadingSets(false);
    }
  };

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => dialogRef.current?.focus(), 0);
    void Promise.resolve().then(loadSets);
    return () => {
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
    };
    // This composer is mounted for one modal open; initial values and identity are intentionally captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (!pending) onClose();
  };

  useEffect(() => {
    const dismissOnEscape = (event) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", dismissOnEscape);
    return () => window.removeEventListener("keydown", dismissOnEscape);
  }, [onClose, pending]);

  const validateCard = () => {
    if (!cleanText(front)) {
      setFormError("Enter a word or phrase for the front of this flashcard.");
      return false;
    }
    if (!cleanText(back)) {
      setFormError("Enter a meaning or answer for the back of this flashcard.");
      return false;
    }
    const frontIssue = validateFlashcardField({ value: front, limit: FLASHCARD_FRONT_LIMIT });
    const backIssue = validateFlashcardField({ value: back, limit: FLASHCARD_BACK_LIMIT });
    if (frontIssue || backIssue) {
      setFormError(frontIssue || backIssue);
      return false;
    }
    return true;
  };

  const completeSave = (deck, card) => {
    rememberLastSet(userId, deck._id);
    onSaved(deck);
    onCardSaved?.(deck, card);
    onClose();
  };

  const saveCard = async (deck) => {
    const card = await createPersonalFlashcard(deck._id, { prompt: cleanText(front), answer: cleanText(back) });
    completeSave(deck, card);
  };

  const saveToExistingSet = async (event) => {
    event.preventDefault();
    if (pending || !validateCard()) return;
    const deck = decks.find((item) => item._id === selectedDeckId);
    if (!deck) {
      setFormError("Choose a flashcard set.");
      return;
    }
    setFormError("");
    setSaveError("");
    setPending(true);
    try {
      await saveCard(deck);
    } catch (error) {
      setSaveError(setMessage(error.message));
    } finally {
      setPending(false);
    }
  };

  const createSetAndSave = async (event) => {
    event.preventDefault();
    if (pending || !validateCard()) return;
    const name = cleanText(newSetName);
    if (!name) {
      setFormError("Enter a name for your new flashcard set.");
      return;
    }
    setFormError("");
    setSaveError("");
    setPending(true);
    try {
      const deck = await createPersonalFlashcardDeck(name);
      setDecks((items) => [deck, ...items]);
      setSelectedDeckId(deck._id);
      setMode("existing");
      try {
        await saveCard(deck);
      } catch {
        setSaveError(`Your new set “${deck.name}” was created, but the flashcard could not be saved. Please try again.`);
      }
    } catch (error) {
      setSaveError(setMessage(error.message));
    } finally {
      setPending(false);
    }
  };

  const chooseMode = (nextMode) => {
    if (pending) return;
    setMode(nextMode);
    setFormError("");
    setSaveError("");
  };

  const handleDialogKeyDown = (event) => {
    if (event.key !== "Tab") return;
    const elements = focusableElements(dialogRef.current);
    if (!elements.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const hasSets = decks.length > 0;
  const frontIssue = validateFlashcardField({ value: front, limit: FLASHCARD_FRONT_LIMIT });
  const backIssue = validateFlashcardField({ value: back, limit: FLASHCARD_BACK_LIMIT });
  const actionLabel = pending
    ? mode === "new" ? "Creating set and saving..." : "Saving flashcard..."
    : mode === "new" ? "Create Set & Save" : "Save Flashcard";
  const submit = mode === "new" ? createSetAndSave : saveToExistingSet;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2D2E30]/70 p-3 backdrop-blur-[2px] sm:p-5" onMouseDown={close}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="save-flashcard-title" aria-describedby="save-flashcard-description" tabIndex={-1} onKeyDown={handleDialogKeyDown} className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none sm:max-h-[calc(100dvh-2.5rem)]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between border-b border-[#2D2E30]/10 px-5 py-4 sm:px-6">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#C97112]">Lesson flashcards</p><h2 id="save-flashcard-title" className="mt-1 text-xl font-bold leading-tight text-[#2D2E30] sm:text-2xl">Add to My Flashcards</h2><p id="save-flashcard-description" className="mt-1 text-sm text-[#765F55]">Save vocabulary for later practice.</p></div>
          <button type="button" disabled={pending} onClick={close} className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#2D2E30] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15 disabled:opacity-60" aria-label="Close add to My Flashcards"><X size={19} /></button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            <div className="space-y-4">
              <label className="block text-sm font-bold text-[#2D2E30]">Front <span className="font-normal text-[#765F55]">— Word or phrase</span>
                <textarea aria-describedby="flashcard-front-count" value={front} placeholder="Enter a word or phrase" onChange={(event) => { setFront(event.target.value); setFormError(""); }} rows={3} className={`mt-2 w-full resize-y rounded-xl border px-3 py-2.5 text-base font-normal outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15 sm:text-sm ${frontIssue ? "border-[#A34D45]" : "border-[#2D2E30]/15"}`} />
                <span id="flashcard-front-count" className={`mt-1 block text-xs font-semibold ${frontIssue ? "text-[#A34D45]" : "text-[#765F55]"}`}>{countGraphemes(front)} / {FLASHCARD_FRONT_LIMIT}{frontIssue ? ` — ${frontIssue}` : ""}</span>
              </label>
              <label className="block text-sm font-bold text-[#2D2E30]">Back <span className="font-normal text-[#765F55]">— Meaning or answer</span>
                <textarea aria-describedby="flashcard-back-count" value={back} placeholder="Enter a meaning or translation" onChange={(event) => { setBack(event.target.value); setFormError(""); }} rows={3} className={`mt-2 w-full resize-y rounded-xl border px-3 py-2.5 text-base font-normal outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15 sm:text-sm ${backIssue ? "border-[#A34D45]" : "border-[#2D2E30]/15"}`} />
                <span id="flashcard-back-count" className={`mt-1 block text-xs font-semibold ${backIssue ? "text-[#A34D45]" : "text-[#765F55]"}`}>{countGraphemes(back)} / {FLASHCARD_BACK_LIMIT}{backIssue ? ` — ${backIssue}` : ""}</span>
              </label>

              <fieldset aria-describedby="flashcard-set-help">
                <legend className="text-sm font-bold text-[#2D2E30]">Flashcard set</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Flashcard set mode">
                  <button type="button" role="radio" aria-checked={mode === "existing"} disabled={pending || (!hasSets && !loadingSets)} onClick={() => chooseMode("existing")} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15 disabled:cursor-not-allowed disabled:opacity-50 ${mode === "existing" ? "border-[#E58C1A]/60 bg-[#FFF1D0] text-[#9A5816]" : "border-[#2D2E30]/15 text-[#765F55] hover:bg-[#FFF9EA]"}`}><FolderOpen size={18} aria-hidden="true" />Existing set</button>
                  <button type="button" role="radio" aria-checked={mode === "new"} disabled={pending} onClick={() => chooseMode("new")} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15 disabled:cursor-not-allowed disabled:opacity-50 ${mode === "new" ? "border-[#E58C1A]/60 bg-[#FFF1D0] text-[#9A5816]" : "border-[#2D2E30]/15 text-[#765F55] hover:bg-[#FFF9EA]"}`}><FolderPlus size={18} aria-hidden="true" />Create new set</button>
                </div>

                {loadingSets ? <p id="flashcard-set-help" className="mt-3 text-sm text-[#765F55]">Loading your flashcard sets...</p> : loadingError ? <div id="flashcard-set-help" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p>{loadingError}</p><button type="button" onClick={loadSets} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 font-bold text-[#A34D45] hover:bg-white focus:outline-none focus:ring-4 focus:ring-red-100"><RefreshCw size={15} />Try again</button></div> : mode === "existing" ? <div className="mt-3"><StudentSelect label="Choose a set" value={selectedDeckId} options={decks.map((deck) => ({ value: deck._id, label: deck.name }))} onChange={(nextDeckId) => { setSelectedDeckId(nextDeckId); setFormError(""); }} menuPlacement="inline" disabled={pending || !hasSets} /></div> : <div className="mt-3"><label className="block text-sm font-bold text-[#2D2E30]">New set name<input maxLength={80} placeholder="e.g. Daily Thai Vocabulary" value={newSetName} onChange={(event) => { setNewSetName(event.target.value); setFormError(""); }} className="mt-2 min-h-11 w-full rounded-xl border border-[#2D2E30]/15 px-3 text-base font-normal outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/15 sm:text-sm" /></label><p id="flashcard-set-help" className="mt-2 text-xs leading-5 text-[#765F55]">Your new set will be created when you save.</p></div>}
              </fieldset>
              {(formError || saveError) && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError || saveError}</p>}
            </div>
          </div>
          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#2D2E30]/10 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" disabled={pending} onClick={close} className="min-h-11 rounded-xl border border-[#2D2E30]/15 px-4 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15 disabled:opacity-60">Cancel</button>
            <button disabled={pending || loadingSets || Boolean(loadingError) || (mode === "existing" && !selectedDeckId)} className="min-h-11 rounded-xl bg-[#2D2E30] px-4 text-sm font-bold text-white transition hover:bg-[#E58C1A] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/25 disabled:cursor-not-allowed disabled:opacity-60">{actionLabel}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function SaveFlashcardModal({ isOpen, onClose, onSaved, onCardSaved, initialFront = "", initialBack = "", userId }) {
  if (!isOpen) return null;
  return <SaveFlashcardComposer onClose={onClose} onSaved={onSaved} onCardSaved={onCardSaved} initialFront={initialFront} initialBack={initialBack} userId={userId} />;
}

export default SaveFlashcardModal;
