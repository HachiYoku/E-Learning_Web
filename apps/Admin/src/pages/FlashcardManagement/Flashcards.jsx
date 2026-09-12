import { ArrowLeft, BookOpenText, Edit3, FolderOpen, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createFlashcard, createFlashcardCategory, deleteFlashcard, deleteFlashcardCategory, fetchFlashcardCategories, fetchFlashcards, updateFlashcard, updateFlashcardCategory } from "../../services/flashcardService";
import { validateFileSize } from "../../utils/fileValidation";
import ConfirmationModal from "../../components/ConfirmationModal";

const id = (value) => String(value?._id || value?.id || value || "");
const blankCard = (category) => ({ prompt: "", answer: "", translation: "", category: id(category), isPublished: true, image: "", imageFile: null, removeImage: false });

function Flashcards() {
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [form, setForm] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [discarding, setDiscarding] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [loadedCards, loadedCategories] = await Promise.all([fetchFlashcards(), fetchFlashcardCategories()]);
      setCards(loadedCards);
      setCategories(loadedCategories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const categoryCards = useMemo(() => cards.filter((card) => id(card.category) === id(category)), [cards, category]);
  const openCategoryModal = (item = null) => {
    setCategoryModal(item || {});
    setCategoryName(item?.name || "");
    setError("");
  };
  const closeCategoryModal = () => {
    setCategoryModal(null);
    setCategoryName("");
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    const editing = Boolean(categoryModal?._id || categoryModal?.id);
    try {
      setSaving(true);
      const saved = editing ? await updateFlashcardCategory(id(categoryModal), categoryName) : await createFlashcardCategory(categoryName);
      setCategories((items) => editing ? items.map((item) => id(item) === id(saved) ? saved : item) : [...items, saved].sort((a, b) => a.name.localeCompare(b.name)));
      if (category && id(category) === id(saved)) setCategory(saved);
      closeCategoryModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCard = async (event) => {
    event.preventDefault();
    if (!form.prompt.trim() || !form.answer.trim()) return setError("Front prompt and back answer are required.");
    try {
      setSaving(true);
      setError("");
      const saved = form.id ? await updateFlashcard(form.id, form) : await createFlashcard(form);
      setCards((items) => form.id ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items]);
      setCategories(await fetchFlashcardCategories());
      setForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      if (deleting.type === "category") {
        await deleteFlashcardCategory(id(deleting.item));
        setCategories((items) => items.filter((item) => id(item) !== id(deleting.item)));
        setCategory(null);
      } else {
        await deleteFlashcard(deleting.item.id);
        setCards((items) => items.filter((item) => item.id !== deleting.item.id));
        setCategories((items) => items.map((item) => id(item) === id(category) ? { ...item, cardCount: Math.max(0, item.cardCount - 1) } : item));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const upload = (file) => {
    if (!file) return;
    const message = validateFileSize(file, "Flashcard image");
    if (message) return setError(message);
    setForm((item) => ({ ...item, imageFile: file, image: URL.createObjectURL(file), removeImage: false }));
  };
  const removeImage = () => setForm((item) => ({ ...item, image: "", imageFile: null, removeImage: Boolean(item.id) }));
  const requestDiscard = (event) => {
    const button = event.target.closest("button");
    if (!button || event.target.closest('[aria-labelledby="confirmation-modal-title"]')) return;
    const isDismiss = button.textContent.trim() === "Cancel" || button.getAttribute("aria-label") === "Close";
    if (!isDismiss || saving || (!form && !categoryModal)) return;
    event.preventDefault();
    event.stopPropagation();
    setDiscarding(form ? "card" : "category");
  };
  const discardChanges = () => {
    if (discarding === "card") setForm(null);
    else closeCategoryModal();
    setDiscarding(null);
  };

  if (loading) return <Page><div className="rounded-3xl border border-[#2D2E30]/10 bg-white p-10 text-center text-[#765F55] shadow-sm">Loading flashcard categories...</div></Page>;

  if (!category) return <Page onClickCapture={requestDiscard}>
    <Header title="Flashcard categories" text="Create clear practice sets for your learners." actions={<button onClick={() => openCategoryModal()} className="button-primary px-5 py-3"><Plus size={18} /> Create category</button>} />
    {error && <Error error={error} />}
    {categories.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{categories.map((item) => <article key={id(item)} className="overflow-hidden rounded-3xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_14px_34px_-28px_rgba(45,46,48,.6)] transition duration-200 hover:-translate-y-1 hover:border-[#E58C1A]/40 hover:shadow-lg"><button onClick={() => { setCategory(item); setError(""); }} className="w-full text-left"><div className="flex items-start justify-between gap-3"><span className="rounded-2xl bg-[#FFF1CE] p-3 text-[#C97112]"><FolderOpen size={22} /></span><span className="rounded-full bg-[#FFF9EA] px-2.5 py-1 text-xs font-bold text-[#765F55]">{item.cardCount || 0} cards</span></div><h2 className="mt-7 text-xl font-bold text-[#2D2E30]">{item.name}</h2><p className="mt-2 text-sm text-[#765F55]">Open and manage this set <span className="font-bold text-[#C97112]">→</span></p></button></article>)}</div> : <Empty />}
    {categoryModal && <CategoryModal category={categoryModal} name={categoryName} setName={setCategoryName} onClose={closeCategoryModal} onSave={saveCategory} saving={saving} error={error} />}
    <ConfirmationModal isOpen={Boolean(discarding)} title="Leave without saving?" message="Your latest edits have not been saved. Keep editing to review them, or discard this draft to close the editor." confirmText="Discard draft" cancelText="Keep editing" onConfirm={discardChanges} onCancel={() => setDiscarding(null)} />
  </Page>;

  return <Page onClickCapture={requestDiscard}>
    <button onClick={() => { setCategory(null); setForm(null); setError(""); }} className="mb-5 inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1CE] hover:text-[#C97112]"><ArrowLeft size={17} /> All categories</button>
    <Header title={category.name} text={`${categoryCards.length} cards in this category.`} actions={<><button onClick={() => openCategoryModal(category)} className="button-secondary"><Pencil size={16} /> Rename</button><button disabled={categoryCards.length > 0} title={categoryCards.length ? "Remove all cards before deleting this category" : "Delete category"} onClick={() => setDeleting({ type: "category", item: category })} className="button-danger disabled:cursor-not-allowed disabled:opacity-45"><Trash2 size={16} /> Delete</button><button onClick={() => { setError(""); setForm(blankCard(category)); }} className="button-primary"><Plus size={18} /> Add flashcard</button></>} />
    {error && <Error error={error} />}
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#E58C1A]/15 bg-[#FFF9EA] px-4 py-3 text-sm text-[#765F55]"><BookOpenText size={18} className="shrink-0 text-[#C97112]" /> New and edited cards stay in <strong className="text-[#2D2E30]">{category.name}</strong> to keep this practice set organized.</div>
    {categoryCards.length ? <div className="grid gap-4 md:grid-cols-2">{categoryCards.map((card) => <article key={card.id} className="overflow-hidden rounded-3xl border border-[#2D2E30]/10 bg-white shadow-[0_14px_34px_-28px_rgba(45,46,48,.6)]"><div className="flex gap-4 p-5">{card.image ? <img src={card.image} alt="" className="h-20 w-20 rounded-2xl border border-[#2D2E30]/10 object-cover" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1CE] text-3xl">📝</div>}<div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9B867C]">Front</p><p className="mt-1 font-bold text-[#2D2E30]">{card.prompt}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#9B867C]">Back</p><p className="mt-1 font-semibold text-[#C97112]">{card.answer}</p>{card.translation && <p className="mt-2 text-sm text-[#765F55]">{card.translation}</p>}</div></div><div className="flex items-center justify-between gap-3 border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${card.isPublished ? "bg-[#E9F4EA] text-[#246B35]" : "bg-[#F2EFEB] text-[#765F55]"}`}>{card.isPublished ? "Published" : "Draft"}</span><div className="flex gap-2"><button onClick={() => { setError(""); setForm({ ...card, category: id(category), imageFile: null, removeImage: false }); }} className="button-secondary"><Edit3 size={15} /> Edit</button><button onClick={() => setDeleting({ type: "card", item: card })} className="button-danger"><Trash2 size={15} /> Delete</button></div></div></article>)}</div> : <Empty message="No flashcards in this category yet. Add the first one to get started." />}
    {form && <CardModal form={form} categoryName={category.name} onChange={(field, value) => setForm((item) => ({ ...item, [field]: value }))} onUpload={upload} onRemoveImage={removeImage} onSave={saveCard} onClose={() => setForm(null)} saving={saving} error={error} />}
    {categoryModal && <CategoryModal category={categoryModal} name={categoryName} setName={setCategoryName} onClose={closeCategoryModal} onSave={saveCategory} saving={saving} error={error} />}
    <ConfirmationModal isOpen={Boolean(deleting)} title={`Delete ${deleting?.type || ""}`} message="This action cannot be undone." confirmText="Delete" cancelText="Cancel" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} isDangerous />
    <ConfirmationModal isOpen={Boolean(discarding)} title="Leave without saving?" message="Your latest edits have not been saved. Keep editing to review them, or discard this draft to close the editor." confirmText="Discard draft" cancelText="Keep editing" onConfirm={discardChanges} onCancel={() => setDiscarding(null)} />
  </Page>;
}

function Page({ children, onClickCapture }) { return <div onClickCapture={onClickCapture} className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8"><div className="mx-auto max-w-7xl">{children}</div></div>; }
function Header({ title, text, actions }) { return <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#C97112]">Practice content</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">{title}</h1><p className="mt-2 text-[#765F55]">{text}</p></div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</header>; }
function ModalShell({ children, labelledBy, size = "max-w-lg" }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2E30]/60 p-4 backdrop-blur-[2px]" role="presentation"><div className={`max-h-[calc(100vh-2rem)] w-full ${size} overflow-y-auto rounded-3xl border border-[#2D2E30]/10 bg-white shadow-2xl shadow-[#2D2E30]/30`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{children}</div></div>; }
function CategoryModal({ category, name, setName, onClose, onSave, saving, error }) { const editing = Boolean(category?._id || category?.id); return <ModalShell labelledBy="category-modal-title" size="max-w-md"><form onSubmit={onSave}><div className="flex items-start justify-between border-b border-[#E58C1A]/15 bg-[#FFF9EA] p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#C97112]">Practice library</p><h2 id="category-modal-title" className="mt-1 text-xl font-bold text-[#2D2E30]">{editing ? "Rename category" : "Create category"}</h2></div><button type="button" onClick={onClose} disabled={saving} className="rounded-xl p-2 text-[#765F55] hover:bg-white hover:text-[#2D2E30]" aria-label="Close"><X size={20} /></button></div><div className="p-5">{error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}<label className="block text-sm font-bold text-[#2D2E30]">Category name<input autoFocus required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily vocabulary" className="input text-sm font-normal" /></label><p className="mt-2 text-xs leading-5 text-[#765F55]">Use a short, recognizable title so learners can find the right card set easily.</p></div><div className="flex gap-3 border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-5"><button type="button" onClick={onClose} disabled={saving} className="button-secondary flex-1">Cancel</button><button disabled={saving} className="button-primary flex-1">{saving ? "Saving..." : editing ? "Save changes" : "Create category"}</button></div></form></ModalShell>; }
function CardModal({ form, categoryName, onChange, onUpload, onSave, onClose, saving, error }) { const removePhoto = () => { onChange("image", ""); onChange("imageFile", null); onChange("removeImage", Boolean(form.id)); }; return <ModalShell labelledBy="flashcard-modal-title" size="max-w-3xl"><form onSubmit={onSave}><div className="flex items-start justify-between border-b border-[#E58C1A]/15 bg-[#FFF9EA] p-5 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#C97112]">{form.id ? "Edit card" : "New card"}</p><h2 id="flashcard-modal-title" className="mt-1 text-2xl font-bold text-[#2D2E30]">{form.id ? "Refine flashcard" : "Create flashcard"}</h2></div><button type="button" onClick={onClose} disabled={saving} className="rounded-xl p-2 text-[#765F55] hover:bg-white hover:text-[#2D2E30]" aria-label="Close"><X size={20} /></button></div><div className="space-y-5 p-5 sm:p-6">{error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}<div className="rounded-2xl border border-[#E58C1A]/15 bg-[#FFF9EA] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9A5816]">Category</p><p className="mt-1 font-bold text-[#2D2E30]">{categoryName}</p><p className="mt-1 text-xs text-[#765F55]">This card remains in its current category.</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Front / question"><input required value={form.prompt} onChange={(e) => onChange("prompt", e.target.value)} placeholder="What would the learner see?" className="input" /></Field><Field label="Back / answer"><input required value={form.answer} onChange={(e) => onChange("answer", e.target.value)} placeholder="The correct answer" className="input" /></Field><Field label="Translation (optional)" className="sm:col-span-2"><input value={form.translation} onChange={(e) => onChange("translation", e.target.value)} placeholder="Add a translation or pronunciation note" className="input" /></Field></div><section className="rounded-2xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:p-5"><div className="mb-4"><p className="text-sm font-bold text-[#2D2E30]">Card settings</p><p className="mt-1 text-xs text-[#765F55]">Control availability and add a visual cue when it helps learning.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#2D2E30]/10 bg-white p-4 transition hover:border-[#E58C1A]/35"><input type="checkbox" checked={form.isPublished} onChange={(e) => onChange("isPublished", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C97112]" /><span><span className="block text-sm font-bold text-[#2D2E30]">Published publicly</span><span className="mt-1 block text-xs leading-5 text-[#765F55]">Learners can use this card in practice.</span></span></label><div className="rounded-xl border border-[#2D2E30]/10 bg-white p-3">{form.image ? <div className="flex items-center gap-3"><img src={form.image} alt="Flashcard preview" onError={(event) => { event.currentTarget.parentElement.parentElement.style.display = "none"; }} className="h-20 w-24 rounded-lg border border-[#2D2E30]/10 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#2D2E30]">{form.imageFile?.name || "Attached photo"}</p><p className="mt-1 text-xs text-[#765F55]">{form.imageFile ? "New image ready to save" : "Current image"}</p><div className="mt-2 flex flex-wrap gap-2"><label className="cursor-pointer text-xs font-bold text-[#C97112] hover:underline">Replace<input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} className="hidden" /></label><button type="button" onClick={removePhoto} className="text-xs font-bold text-[#A34D45] hover:underline">Remove</button></div></div></div> : <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#E58C1A]/40 bg-[#FFF9EA] p-4 transition hover:bg-[#FFF1CE]"><span className="rounded-lg bg-white p-2 text-[#C97112]"><ImagePlus size={18} /></span><span><span className="block text-sm font-bold text-[#9A5816]">Add an optional visual cue</span><span className="mt-1 block text-xs text-[#765F55]">Upload a supporting image.</span></span><input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} className="hidden" /></label>}</div></div></section></div><div className="flex flex-col-reverse gap-3 border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-5 sm:flex-row sm:justify-end sm:p-6"><button type="button" onClick={onClose} disabled={saving} className="button-secondary">Cancel</button><button disabled={saving} className="button-primary px-5">{saving ? "Saving..." : form.id ? "Save changes" : "Create flashcard"}</button></div></form></ModalShell>; }
function Field({ label, children, className = "" }) { return <label className={`block text-sm font-bold text-[#2D2E30] ${className}`}>{label}{children}</label>; }
function Error({ error }) { return <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>; }
function Empty({ message = "Create a category first, then add its flashcards." }) { return <div className="rounded-3xl border border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] p-10 text-center text-[#765F55]">{message}</div>; }

export default Flashcards;
