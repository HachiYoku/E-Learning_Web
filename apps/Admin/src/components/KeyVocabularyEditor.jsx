import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

export const KEY_VOCABULARY_MAX_ENTRIES = 50
export const KEY_VOCABULARY_LIMITS = {
  thai: 120,
  translation: 160,
  transliteration: 160,
}

let newVocabularySequence = 0

const emptyVocabularyEntry = () => ({
  _uiKey: `new-vocabulary-${++newVocabularySequence}`,
  thai: '',
  translation: '',
  transliteration: '',
})

export function normalizeKeyVocabulary(entries) {
  if (!Array.isArray(entries)) return []

  return entries.map((entry) => ({
    ...(entry?._id ? { _id: entry._id } : {}),
    ...(typeof entry?._uiKey === 'string' ? { _uiKey: entry._uiKey } : {}),
    thai: typeof entry?.thai === 'string' ? entry.thai : '',
    translation: typeof entry?.translation === 'string' ? entry.translation : '',
    transliteration: typeof entry?.transliteration === 'string' ? entry.transliteration : '',
  }))
}

export function validateKeyVocabulary(entries) {
  const rowErrors = normalizeKeyVocabulary(entries).map((entry) => {
    const errors = {}
    const thai = entry.thai.trim()
    const translation = entry.translation.trim()
    const transliteration = entry.transliteration.trim()

    if (!thai) errors.thai = 'Thai is required.'
    else if (thai.length > KEY_VOCABULARY_LIMITS.thai) errors.thai = 'Thai must be 120 characters or fewer.'

    if (!translation) errors.translation = 'Translation is required.'
    else if (translation.length > KEY_VOCABULARY_LIMITS.translation) errors.translation = 'Translation must be 160 characters or fewer.'

    if (transliteration.length > KEY_VOCABULARY_LIMITS.transliteration) {
      errors.transliteration = 'Transliteration must be 160 characters or fewer.'
    }

    return errors
  })

  return {
    isValid: Array.isArray(entries)
      && entries.length <= KEY_VOCABULARY_MAX_ENTRIES
      && rowErrors.every((errors) => Object.keys(errors).length === 0),
    rowErrors,
  }
}

export function buildKeyVocabularyPayload(entries) {
  return normalizeKeyVocabulary(entries).map(({ thai, translation, transliteration }) => ({
    thai: thai.trim(),
    translation: translation.trim(),
    transliteration: transliteration.trim(),
  }))
}

function KeyVocabularyEditor({ value, onChange, showValidation = false }) {
  const entries = normalizeKeyVocabulary(value)
  const { rowErrors } = validateKeyVocabulary(entries)

  const updateEntry = (index, field, fieldValue) => {
    onChange(entries.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, [field]: fieldValue } : entry
    )))
  }

  const moveEntry = (index, direction) => {
    const destination = index + direction
    if (destination < 0 || destination >= entries.length) return

    const reordered = [...entries]
    ;[reordered[index], reordered[destination]] = [reordered[destination], reordered[index]]
    onChange(reordered)
  }

  const removeEntry = (index) => {
    onChange(entries.filter((_, entryIndex) => entryIndex !== index))
  }

  return (
    <section className="border-t border-[#2D2E30]/10 pt-6" aria-labelledby="key-vocabulary-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="key-vocabulary-heading" className="text-base font-bold text-[#2D2E30]">Key Vocabulary</h3>
          <p className="mt-1 text-sm text-[#765F55]">Add useful Thai words and phrases for this lesson.</p>
        </div>
        <span className="rounded-full bg-[#FFF1CE] px-3 py-1 text-xs font-bold text-[#9A5816]" aria-live="polite">
          {entries.length} / {KEY_VOCABULARY_MAX_ENTRIES}
        </span>
      </div>

      {entries.length > 0 ? (
        <div className="mt-5 space-y-4">
          {entries.map((entry, index) => {
            const errors = rowErrors[index]
            const rowKey = entry._id || entry._uiKey || `vocabulary-${index}`

            return (
              <fieldset key={rowKey} className="rounded-2xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:p-5">
                <legend className="px-1 text-sm font-bold text-[#765F55]">Vocabulary {index + 1}</legend>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-bold text-[#2D2E30]">Thai <span className="text-[#C97112]">*</span></span>
                    <input
                      type="text"
                      value={entry.thai}
                      onChange={(event) => updateEntry(index, 'thai', event.target.value)}
                      maxLength={KEY_VOCABULARY_LIMITS.thai}
                      aria-invalid={showValidation && Boolean(errors.thai)}
                      aria-describedby={errors.thai ? `vocabulary-${index}-thai-error` : undefined}
                      placeholder="e.g. สวัสดี"
                      className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10"
                    />
                    {showValidation && errors.thai ? <p id={`vocabulary-${index}-thai-error`} className="mt-1.5 text-xs font-medium text-red-700">{errors.thai}</p> : null}
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-[#2D2E30]">Translation <span className="text-[#C97112]">*</span></span>
                    <input
                      type="text"
                      value={entry.translation}
                      onChange={(event) => updateEntry(index, 'translation', event.target.value)}
                      maxLength={KEY_VOCABULARY_LIMITS.translation}
                      aria-invalid={showValidation && Boolean(errors.translation)}
                      aria-describedby={errors.translation ? `vocabulary-${index}-translation-error` : undefined}
                      placeholder="e.g. Hello"
                      className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10"
                    />
                    {showValidation && errors.translation ? <p id={`vocabulary-${index}-translation-error`} className="mt-1.5 text-xs font-medium text-red-700">{errors.translation}</p> : null}
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-sm font-bold text-[#2D2E30]">Transliteration <span className="font-medium text-[#9B867C]">(optional)</span></span>
                    <input
                      type="text"
                      value={entry.transliteration}
                      onChange={(event) => updateEntry(index, 'transliteration', event.target.value)}
                      maxLength={KEY_VOCABULARY_LIMITS.transliteration}
                      aria-invalid={showValidation && Boolean(errors.transliteration)}
                      aria-describedby={errors.transliteration ? `vocabulary-${index}-transliteration-error` : undefined}
                      placeholder="e.g. sa-wat-dee"
                      className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-sm text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10"
                    />
                    {showValidation && errors.transliteration ? <p id={`vocabulary-${index}-transliteration-error`} className="mt-1.5 text-xs font-medium text-red-700">{errors.transliteration}</p> : null}
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#2D2E30]/10 pt-4">
                  <button type="button" onClick={() => moveEntry(index, -1)} disabled={index === 0} aria-label={`Move vocabulary ${index + 1} up`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#2D2E30]/15 bg-white text-[#765F55] transition hover:border-[#E58C1A] hover:text-[#C97112] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={18} /></button>
                  <button type="button" onClick={() => moveEntry(index, 1)} disabled={index === entries.length - 1} aria-label={`Move vocabulary ${index + 1} down`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#2D2E30]/15 bg-white text-[#765F55] transition hover:border-[#E58C1A] hover:text-[#C97112] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15 disabled:cursor-not-allowed disabled:opacity-40"><ArrowDown size={18} /></button>
                  <button type="button" onClick={() => removeEntry(index)} aria-label={`Remove vocabulary ${index + 1}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100"><Trash2 size={17} /> <span>Remove</span></button>
                </div>
              </fieldset>
            )
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[#2D2E30]/15 bg-[#FFFDF8] px-4 py-3 text-sm text-[#765F55]">No vocabulary added yet.</p>
      )}

      <button type="button" onClick={() => onChange([...entries, emptyVocabularyEntry()])} disabled={entries.length >= KEY_VOCABULARY_MAX_ENTRIES} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E58C1A]/35 bg-[#FFF9EA] px-4 py-2.5 text-sm font-bold text-[#9A5816] transition hover:bg-[#FFF1CE] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/15 disabled:cursor-not-allowed disabled:opacity-45"><Plus size={17} /> Add Vocabulary</button>
    </section>
  )
}

export default KeyVocabularyEditor
