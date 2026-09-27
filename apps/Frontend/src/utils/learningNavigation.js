export function learningCoursePath(courseId, lessonId) {
  const coursePath = `/app/learn/${encodeURIComponent(String(courseId))}`
  if (!lessonId) return coursePath

  return `${coursePath}?${new URLSearchParams({ lesson: String(lessonId) }).toString()}`
}
