export function findNextIncompleteLesson(lessons, currentLessonId, completedLessonIds) {
  const currentIndex = lessons.findIndex((lesson) => String(lesson.id) === String(currentLessonId));
  const completedIds = new Set((completedLessonIds || []).map(String));
  const isIncomplete = (lesson) => !completedIds.has(String(lesson.id));

  if (currentIndex < 0) return null;

  const nextLesson = lessons.slice(currentIndex + 1).find(isIncomplete);
  if (nextLesson) return { lesson: nextLesson, isAfterCurrent: true };

  const remainingEarlierLesson = lessons.slice(0, currentIndex).find(isIncomplete);
  return remainingEarlierLesson ? { lesson: remainingEarlierLesson, isAfterCurrent: false } : null;
}
