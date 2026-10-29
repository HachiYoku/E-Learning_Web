import { expect, it } from 'vitest'
import { draftFromQuiz, draftPayload, emptyDraft, validateDraft } from './generalPracticeDraft'

it('validates required text questions, options, answers and metadata', () => {
  const form = emptyDraft()
  expect(validateDraft(form).length).toBeGreaterThan(3)
  Object.assign(form, { title: 'Thai', category: 'Vocabulary', difficulty: 'Beginner' })
  Object.assign(form.questions[0], { prompt: 'Greeting?', options: ['Hello', 'Goodbye'], correctAnswer: 0 })
  expect(validateDraft(form)).toEqual([])
  form.questions[0].options[1] = ''
  expect(validateDraft(form).join(' ')).toMatch(/non-empty answers/)
})

it('clones a published revision for editing without losing owned media fields', () => {
  const question = { _id: 'q1', prompt: '', image: 'owned-url', imagePublicId: 'owned-id', imageAlt: 'Picture', options: ['A', 'B'], correctAnswer: 1, explanation: 'Why' }
  const quiz = { published: { title: 'Live', category: 'Reading', difficulty: 'Advanced', standaloneAccess: 'students', questions: [question], revision: 3 }, draft: null }
  const form = draftFromQuiz(quiz)
  form.questions[0].options[0] = 'Changed'
  expect(quiz.published.questions[0].options[0]).toBe('A')
  const payload = draftPayload(form)
  expect(payload.standaloneAccess).toBe('students')
  expect(payload.questions[0]).toEqual({ ...question, options: ['Changed', 'B'] })
  expect(payload.questions[0].localId).toBeUndefined()
  expect(validateDraft(form)).toEqual([])
})
