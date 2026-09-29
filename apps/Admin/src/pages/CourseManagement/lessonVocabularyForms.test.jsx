import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AddLesson from './AddLesson'
import EditLesson from './EditLesson'
import * as courseService from '../../services/courseService'
import * as lessonService from '../../services/lessonService'

vi.mock('../../services/courseService', () => ({ fetchCourseById: vi.fn() }))
vi.mock('../../services/lessonService', () => ({
  createLesson: vi.fn(),
  fetchLessonsByCourse: vi.fn(),
  updateLesson: vi.fn(),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'course-1', lessonId: 'lesson-1' }),
}))

const course = {
  id: 'course-1',
  title: 'Thai basics',
  description: 'Learn Thai',
  price: '฿0',
  isPublished: true,
}

function renderAddLesson() {
  return render(<AddLesson />)
}

function renderEditLesson() {
  return render(<EditLesson />)
}

async function waitForForm() {
  await screen.findByRole('heading', { name: /^(add a lesson|edit lesson)$/i })
}

async function fillLessonDetails(user) {
  await user.type(screen.getByLabelText(/lesson title/i), 'Greeting')
  await user.type(screen.getByLabelText(/video url/i), 'https://example.com/video')
}

beforeEach(() => {
  vi.resetAllMocks()
  courseService.fetchCourseById.mockResolvedValue(course)
  lessonService.fetchLessonsByCourse.mockResolvedValue([])
  lessonService.createLesson.mockResolvedValue({ id: 'lesson-1' })
  lessonService.updateLesson.mockResolvedValue({ id: 'lesson-1' })
})

describe('lesson vocabulary forms', () => {
  it('keeps the existing Add Lesson request unchanged when no vocabulary is entered', async () => {
    const user = userEvent.setup()
    renderAddLesson()
    await waitForForm()
    await fillLessonDetails(user)
    await user.click(screen.getByRole('button', { name: /create lesson/i }))

    await waitFor(() => expect(lessonService.createLesson).toHaveBeenCalled())
    expect(lessonService.createLesson).toHaveBeenCalledWith('course-1', {
      title: 'Greeting', videoUrl: 'https://example.com/video', order: 1,
    })
  })

  it('sends valid, trimmed vocabulary in the displayed order when adding a lesson', async () => {
    const user = userEvent.setup()
    renderAddLesson()
    await waitForForm()
    await fillLessonDetails(user)
    await user.click(screen.getByRole('button', { name: /add vocabulary/i }))
    await user.type(screen.getByLabelText(/^thai/i), ' สวัสดี ')
    await user.type(screen.getByLabelText(/^translation/i), ' Hello ')
    await user.type(screen.getByLabelText(/^transliteration/i), ' sa-wat-dee ')
    await user.click(screen.getByRole('button', { name: /add vocabulary/i }))
    await user.type(screen.getAllByLabelText(/^thai/i)[1], 'ขอบคุณ')
    await user.type(screen.getAllByLabelText(/^translation/i)[1], 'Thank you')
    await user.click(screen.getByRole('button', { name: 'Move vocabulary 2 up' }))
    await user.click(screen.getByRole('button', { name: /create lesson/i }))

    await waitFor(() => expect(lessonService.createLesson).toHaveBeenCalledWith('course-1', expect.objectContaining({
      keyVocabulary: [
        { thai: 'ขอบคุณ', translation: 'Thank you', transliteration: '' },
        { thai: 'สวัสดี', translation: 'Hello', transliteration: 'sa-wat-dee' },
      ],
    })))
  })

  it('loads ordered vocabulary for editing, sends the complete updated array, and clears it with an empty array', async () => {
    const user = userEvent.setup()
    lessonService.fetchLessonsByCourse.mockResolvedValue([{
      id: 'lesson-1', title: 'Greeting', videoUrl: 'https://example.com/video', order: 1,
      keyVocabulary: [
        { _id: 'vocab-1', thai: 'สวัสดี', translation: 'Hello', transliteration: 'sa-wat-dee' },
        { _id: 'vocab-2', thai: 'ขอบคุณ', translation: 'Thank you', transliteration: '' },
      ],
    }])
    const firstEdit = renderEditLesson()
    await waitForForm()

    expect(screen.getAllByLabelText(/^thai/i).map((input) => input.value)).toEqual(['สวัสดี', 'ขอบคุณ'])
    await user.clear(screen.getAllByLabelText(/^translation/i)[0])
    await user.type(screen.getAllByLabelText(/^translation/i)[0], 'Hi')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(lessonService.updateLesson).toHaveBeenCalledWith('lesson-1', expect.objectContaining({
      keyVocabulary: [
        { thai: 'สวัสดี', translation: 'Hi', transliteration: 'sa-wat-dee' },
        { thai: 'ขอบคุณ', translation: 'Thank you', transliteration: '' },
      ],
    })))

    lessonService.updateLesson.mockClear()
    firstEdit.unmount()
    renderEditLesson()
    await waitForForm()
    await user.click(screen.getByRole('button', { name: 'Remove vocabulary 1' }))
    await user.click(screen.getByRole('button', { name: 'Remove vocabulary 1' }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(lessonService.updateLesson).toHaveBeenCalledWith('lesson-1', expect.objectContaining({ keyVocabulary: [] })))
  })
})
