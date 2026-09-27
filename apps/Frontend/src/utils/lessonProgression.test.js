import { describe, expect, it } from 'vitest'
import { findNextIncompleteLesson } from './lessonProgression'

const lessons = [
  { id: 'lesson-1', title: 'Greetings', order: 1 },
  { id: 'lesson-2', title: 'Introductions', order: 4 },
  { id: 'lesson-3', title: 'Directions', order: 19 },
]

describe('findNextIncompleteLesson', () => {
  it('uses the authorized response order and selects the first incomplete lesson after the current one', () => {
    expect(findNextIncompleteLesson(lessons, 'lesson-1', ['lesson-1'])).toEqual({ lesson: lessons[1], isAfterCurrent: true })
  })

  it('skips completed lessons after the current lesson', () => {
    expect(findNextIncompleteLesson(lessons, 'lesson-1', ['lesson-1', 'lesson-2'])).toEqual({ lesson: lessons[2], isAfterCurrent: true })
  })

  it('returns an earlier incomplete lesson only when no later incomplete lesson remains', () => {
    expect(findNextIncompleteLesson(lessons, 'lesson-3', ['lesson-2', 'lesson-3'])).toEqual({ lesson: lessons[0], isAfterCurrent: false })
  })

  it('returns null when every lesson is complete, including a single-lesson course', () => {
    expect(findNextIncompleteLesson(lessons, 'lesson-3', lessons.map((lesson) => lesson.id))).toBeNull()
    expect(findNextIncompleteLesson([{ id: 'only', order: 42 }], 'only', ['only'])).toBeNull()
  })

  it('does not infer a next lesson from order arithmetic or an unknown current lesson', () => {
    expect(findNextIncompleteLesson(lessons, 'missing', ['lesson-1'])).toBeNull()
  })
})
