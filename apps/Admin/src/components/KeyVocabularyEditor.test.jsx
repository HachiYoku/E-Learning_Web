import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import KeyVocabularyEditor, {
  KEY_VOCABULARY_MAX_ENTRIES,
  validateKeyVocabulary,
} from './KeyVocabularyEditor'

function EditorHarness({ initialValue = [] }) {
  const [value, setValue] = useState(initialValue)
  return <KeyVocabularyEditor value={value} onChange={setValue} showValidation />
}

describe('KeyVocabularyEditor', () => {
  it('adds, edits, reorders, and removes vocabulary while keeping values with their row', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.click(screen.getByRole('button', { name: /add vocabulary/i }))
    await user.type(screen.getByLabelText(/^thai/i), 'สวัสดี')
    await user.type(screen.getByLabelText(/^translation/i), 'Hello')
    await user.type(screen.getByLabelText(/^transliteration/i), 'sa-wat-dee')
    await user.click(screen.getByRole('button', { name: /add vocabulary/i }))

    const thaiInputs = screen.getAllByLabelText(/^thai/i)
    const translationInputs = screen.getAllByLabelText(/^translation/i)
    await user.type(thaiInputs[1], 'ขอบคุณ')
    await user.type(translationInputs[1], 'Thank you')
    await user.click(screen.getByRole('button', { name: 'Move vocabulary 2 up' }))

    expect(screen.getAllByLabelText(/^thai/i).map((input) => input.value)).toEqual(['ขอบคุณ', 'สวัสดี'])
    expect(screen.getAllByLabelText(/^translation/i).map((input) => input.value)).toEqual(['Thank you', 'Hello'])
    expect(screen.getAllByLabelText(/^transliteration/i)[1].value).toBe('sa-wat-dee')
    expect(screen.getByRole('button', { name: 'Move vocabulary 1 up' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Move vocabulary 2 down' }).disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Remove vocabulary 1' }))
    expect(screen.getAllByLabelText(/^thai/i)).toHaveLength(1)
    expect(screen.getByDisplayValue('สวัสดี')).not.toBeNull()
  })

  it('enforces the 50-entry limit in the editor', async () => {
    const user = userEvent.setup()
    render(<EditorHarness initialValue={Array.from({ length: KEY_VOCABULARY_MAX_ENTRIES }, () => ({ thai: 'คำ', translation: 'Word', transliteration: '' }))} />)

    expect(screen.getByText('50 / 50')).not.toBeNull()
    expect(screen.getByRole('button', { name: /add vocabulary/i }).disabled).toBe(true)
  })

  it('reports required and max-length validation errors', () => {
    const validation = validateKeyVocabulary([
      { thai: ' ', translation: '', transliteration: 'a'.repeat(161) },
      { thai: 'ก'.repeat(121), translation: 'a'.repeat(161), transliteration: '' },
    ])

    expect(validation.isValid).toBe(false)
    expect(validation.rowErrors[0]).toMatchObject({
      thai: 'Thai is required.',
      translation: 'Translation is required.',
      transliteration: 'Transliteration must be 160 characters or fewer.',
    })
    expect(validation.rowErrors[1]).toMatchObject({
      thai: 'Thai must be 120 characters or fewer.',
      translation: 'Translation must be 160 characters or fewer.',
    })
  })
})
