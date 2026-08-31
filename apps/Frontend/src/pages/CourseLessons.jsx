import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'
import { fetchCourseById } from '../services/courseService'
import { fetchLessonsByCourse } from '../services/lessonService'
import { fetchCourseQuizzes } from '../services/quizService'

function getEmbedUrl(src) {
  if (!src) {
    return ''
  }

  try {
    const url = new URL(src)

    if (url.hostname.includes('youtu.be')) {
      const videoId = url.pathname.replace('/', '')
      const params = new URLSearchParams(url.search)
      params.set('autoplay', '1')
      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
    }

    if (url.hostname.includes('youtube.com')) {
      const videoId = url.searchParams.get('v')

      if (videoId) {
        const params = new URLSearchParams(url.search)
        params.delete('v')
        params.set('autoplay', '1')
        return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
      }
    }

    if (url.hostname.includes('drive.google.com')) {
      const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/)
      const openId = url.searchParams.get('id')
      const fileId = fileMatch?.[1] || openId

      if (fileId) {
        const params = new URLSearchParams({ embedded: 'true' })
        return `https://drive.google.com/file/d/${fileId}/preview?${params.toString()}`
      }
    }
  } catch {
    return ''
  }

  return src
}

function CourseLessons() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [lessons, setLessons] = useState([])
  const [courseQuizzes, setCourseQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeLesson, setActiveLesson] = useState(null)

  const activeVideoUrl = useMemo(() => getEmbedUrl(activeLesson?.videoUrl), [activeLesson])

  useEffect(() => {
    async function loadCourseLessons() {
      try {
        setLoading(true)
        setError('')

        const [courseResponse, lessonsResponse, quizzesResponse] = await Promise.all([
          fetchCourseById(courseId),
          fetchLessonsByCourse(courseId),
          fetchCourseQuizzes(courseId),
        ])

        setCourse(courseResponse)
        setLessons(lessonsResponse)
        setCourseQuizzes(quizzesResponse)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadCourseLessons()
  }, [courseId])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner message="Loading lessons..." />
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <p className="text-2xl text-gray-600">{error || 'Course not found'}</p>
        </div>
      </div>
    )
  }

  const courseFeatures = course.features.length > 0
    ? course.features
    : [
        'Clear, step-by-step lessons',
        'Real examples and guided practice',
        'A simple structure you can follow at your own pace',
      ]

  return (
    <div className="min-h-screen bg-blue-50">
      <Navbar />

      <div className="px-4 md:px-10 pt-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate('/my-courses')}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-semibold transition-colors"
          >
            <span className="text-2xl">←</span>
            Back To My Course
          </button>
        </div>
      </div>

      <div className="px-4 md:px-10 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              Course's Lessons
            </h1>
          </div>

          {error ? (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-white rounded-2xl overflow-hidden shadow-lg p-6 sticky top-20">
                <div className="mb-6">
                  {course.image ? (
                    <img
                      src={course.image}
                      alt={course.title}
                      className="w-full h-48 object-cover rounded-xl"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                      No image
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  {course.title}
                </h2>

                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                  {course.description}
                </p>

                <div>
                  <h3 className="font-bold text-gray-900 mb-3">What you'll learn:</h3>
                  <ul className="space-y-2">
                    {courseFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-gray-600 text-xs">
                        <span className="text-pink-400 mt-1">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                {lessons.length === 0 ? (
                  <div className="text-center text-gray-500">
                    No lessons are available in this course yet.
                  </div>
                ) : (
                  <div>
                    <div className="mb-8">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Lessons</h3>
                      <div className="space-y-3">
                        {lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 transition-all hover:border-pink-300 hover:bg-gray-50"
                          >
                            <button
                              type="button"
                              onClick={() => lesson.videoUrl && setActiveLesson(lesson)}
                              className="group flex flex-1 items-center gap-4 p-1 text-left"
                            >
                            <div className="flex items-center gap-4 text-left flex-1">
                              <span className="text-gray-500 font-semibold text-sm w-8">
                                {lesson.order}.
                              </span>
                              <span className="text-gray-900 font-semibold group-hover:text-pink-400 transition-colors">
                                {lesson.title}
                              </span>
                            </div>
                            <span className="text-gray-400 group-hover:text-pink-400 transition-colors text-xl">
                              →
                            </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/course-lessons/${courseId}/quiz/${lesson.id}`)}
                              className="shrink-0 rounded-lg bg-pink-100 px-3 py-2 text-sm font-semibold text-pink-700 transition hover:bg-pink-200"
                            >
                              Quiz
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {courseQuizzes.length > 0 && (
                      <div className="border-t border-gray-200 pt-8">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Course Quizzes</h3>
                        <div className="space-y-3">
                          {courseQuizzes.map((quiz) => {
                            const quizId = quiz.id || quiz._id;
                            return (
                              <div
                                key={quizId}
                                className="flex w-full items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 transition-all hover:border-blue-400 hover:bg-blue-100"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-900 font-semibold text-sm">
                                      {quiz.title}
                                    </span>
                                    <span className="inline-block rounded-full bg-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                      Course
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/course-quiz/${courseId}/${quizId}`)}
                                  disabled={Boolean(quiz.maxAttempts) && (quiz.attemptsUsed ?? 0) >= quiz.maxAttempts}
                                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${Boolean(quiz.maxAttempts) && (quiz.attemptsUsed ?? 0) >= quiz.maxAttempts ? 'cursor-not-allowed bg-gray-300 text-gray-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                                >
                                  {Boolean(quiz.maxAttempts) && (quiz.attemptsUsed ?? 0) >= quiz.maxAttempts ? 'Closed' : 'Take'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeLesson ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => setActiveLesson(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveLesson(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-gray-900 transition hover:bg-white"
              aria-label="Close video"
            >
              ×
            </button>

            <div className="aspect-video w-full">
              <iframe
                src={activeVideoUrl || activeLesson.videoUrl}
                title={activeLesson.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="flex justify-end bg-white p-4">
              <button
                type="button"
                onClick={() => navigate(`/course-lessons/${courseId}/quiz/${activeLesson.id}`)}
                className="rounded-lg bg-pink-300 px-5 py-2.5 font-semibold text-gray-900 transition hover:bg-pink-400"
              >
                Take lesson quiz
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  )
}

export default CourseLessons
