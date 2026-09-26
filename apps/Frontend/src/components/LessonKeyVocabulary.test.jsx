import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import LessonKeyVocabulary from './LessonKeyVocabulary'

describe('LessonKeyVocabulary', () => {
  it('renders a compact one-column mobile, two-column desktop grid with independently scrolling vocabulary cards', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LessonKeyVocabulary vocabulary={[
      { _id: 'vocabulary-1', thai: 'สวัสดี', transliteration: 'sa-wat-dee', translation: 'Hello' },
      { _id: 'vocabulary-2', thai: 'ขอบคุณ', transliteration: 'khop-khun', translation: 'Thank you' },
    ]} onSave={onSave} />)

    expect(screen.getByRole('heading', { name: 'Key Vocabulary' })).toBeTruthy()
    expect(screen.getAllByText(/สวัสดี|ขอบคุณ/).map((element) => element.textContent)).toEqual(['สวัสดี', 'ขอบคุณ'])
    expect(screen.getByText('sa-wat-dee')).toBeTruthy()
    expect(screen.getByText('Hello')).toBeTruthy()
    expect(screen.getByText('Thank you')).toBeTruthy()
    const grid = screen.getByText('Hello').closest('.grid')
    const scrollArea = grid.parentElement
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('md:grid-cols-2')
    expect(scrollArea.className).toContain('min-h-0')
    expect(scrollArea.className).toContain('flex-1')
    expect(scrollArea.className).toContain('overflow-y-auto')
    await user.click(screen.getByRole('button', { name: 'Save vocabulary ขอบคุณ to My Flashcards' }))
    expect(onSave).toHaveBeenCalledWith({ _id: 'vocabulary-2', thai: 'ขอบคุณ', transliteration: 'khop-khun', translation: 'Thank you' }, 'vocabulary-2')
  })

  it('does not render a section or blank transliteration placeholder for empty values', () => {
    const { rerender } = render(<LessonKeyVocabulary vocabulary={[{ _id: 'vocabulary-1', thai: 'ขอบคุณ', transliteration: '', translation: 'Thank you' }]} />)

    expect(screen.getByRole('heading', { name: 'Key Vocabulary' })).toBeTruthy()
    expect(screen.getByText('Thank you').previousElementSibling?.textContent).toBe('ขอบคุณ')

    rerender(<LessonKeyVocabulary vocabulary={[]} />)
    expect(screen.queryByRole('heading', { name: 'Key Vocabulary' })).toBeNull()
  })

  it('wraps long content and keeps Save/Saved/Undo state isolated to the matching vocabulary ID', async () => {
    const user = userEvent.setup()
    const onUndo = vi.fn()
    render(<LessonKeyVocabulary vocabulary={[
      { _id: 'vocabulary-1', thai: 'ก'.repeat(90), transliteration: 'long-transliteration-'.repeat(8), translation: 'A long translation '.repeat(12) },
      { _id: 'vocabulary-2', thai: 'ขอบคุณ', translation: 'Thank you' },
    ]} onSave={vi.fn()} onUndo={onUndo} savedVocabulary={{
      'vocabulary-1': { undoExpiresAt: Date.now() + 5000 },
    }} />)

    expect(screen.getByText('ก'.repeat(90)).className).toContain('break-words')
    expect(screen.getByText('long-transliteration-'.repeat(8)).className).toContain('break-words')
    expect(screen.getByText(/A long translation A long translation/).className).toContain('break-words')
    expect(screen.getByText('Saved')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save vocabulary ขอบคุณ to My Flashcards' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalledWith('vocabulary-1')
  })
})
