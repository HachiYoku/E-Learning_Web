import { Check, Plus } from 'lucide-react'

function vocabularyKey(entry, index) {
  return entry._id || `${entry.thai}-${entry.translation}-${index}`
}

function VocabularyCard({ entry, vocabularyId, saveState, onSave, onUndo }) {
  const isUndoing = Boolean(saveState?.isUndoing)
  const canUndo = Boolean(saveState?.undoExpiresAt)

  return (
    <article className="min-w-0 rounded-xl border border-[#2D2E30]/10 bg-white p-2.5 shadow-sm">
      <p className="break-words text-base font-bold leading-tight text-[#2D2E30]">{entry.thai}</p>
      {entry.transliteration ? <p className="mt-0.5 break-words text-[11px] font-medium leading-snug text-[#9A8775]">{entry.transliteration}</p> : null}
      <p className="mt-1 break-words text-xs font-semibold leading-snug text-[#765F55]">{entry.translation}</p>
      {saveState ? <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#246B35]"><span className="inline-flex items-center gap-1"><Check size={14} aria-hidden="true" />Saved</span>{canUndo ? <button type="button" onClick={onUndo} disabled={isUndoing} className="min-h-8 rounded-md px-1.5 text-xs font-bold text-[#9A5816] underline-offset-2 transition hover:bg-[#FFF4D8] hover:underline focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15 disabled:cursor-not-allowed disabled:opacity-60">{isUndoing ? 'Undoing...' : 'Undo'}</button> : null}</div> : onSave ? <button type="button" onClick={() => onSave(entry, vocabularyId)} className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-md border border-[#E58C1A]/30 px-2 py-1 text-xs font-bold text-[#9A5816] transition hover:bg-[#FFF4D8] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15" aria-label={`Save vocabulary ${entry.thai} to My Flashcards`}><Plus size={14} />Save</button> : null}
      {saveState?.undoError ? <p role="alert" className="mt-1.5 break-words text-[11px] leading-snug text-red-700">{saveState.undoError}</p> : null}
    </article>
  )
}

function LessonKeyVocabulary({ vocabulary, onSave, savedVocabulary = {}, onUndo }) {
  if (!Array.isArray(vocabulary) || vocabulary.length === 0) return null

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#FFF9EA] px-4 py-4 sm:px-6" aria-labelledby="lesson-key-vocabulary-heading">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Lesson notes</p>
        <h2 id="lesson-key-vocabulary-heading" className="mt-1 text-lg font-bold text-[#2D2E30]">Key Vocabulary</h2>
        <div className="mt-3 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {vocabulary.map((entry, index) => {
              const key = vocabularyKey(entry, index)
              return <VocabularyCard key={key} entry={entry} vocabularyId={key} saveState={savedVocabulary[key]} onSave={onSave} onUndo={() => onUndo?.(key)} />
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default LessonKeyVocabulary
