import { describe, expect, it, vi } from 'vitest'

vi.mock('../api/client', () => ({ apiClient: {} }))

import { normalizeLesson } from './lessonService'

describe('normalizeLesson', () => {
  it('keeps existing lessons compatible by normalizing absent vocabulary to an empty array', () => {
    expect(normalizeLesson({ _id: 'lesson-1', title: 'Greeting', videoUrl: 'https://example.com/video', order: 1, course: 'course-1' })).toMatchObject({
      id: 'lesson-1',
      keyVocabulary: [],
    })
  })

  it('keeps ordered vocabulary fields and received subdocument IDs', () => {
    expect(normalizeLesson({
      _id: 'lesson-1', title: 'Greeting', videoUrl: 'https://example.com/video', order: 1, course: 'course-1',
      keyVocabulary: [
        { _id: 'vocabulary-1', thai: 'สวัสดี', translation: 'Hello', transliteration: 'sa-wat-dee' },
        { _id: 'vocabulary-2', thai: 'ขอบคุณ', translation: 'Thank you' },
      ],
    }).keyVocabulary).toEqual([
      { _id: 'vocabulary-1', thai: 'สวัสดี', translation: 'Hello', transliteration: 'sa-wat-dee' },
      { _id: 'vocabulary-2', thai: 'ขอบคุณ', translation: 'Thank you', transliteration: '' },
    ])
  })
})
