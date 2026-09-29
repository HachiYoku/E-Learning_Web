import { apiClient } from "../api/client";

export function normalizeLesson(lesson) {
  if (!lesson) {
    return null;
  }

  return {
    id: lesson._id,
    title: lesson.title,
    videoUrl: lesson.videoUrl,
    order: Number(lesson.order || 0),
    courseId: lesson.course,
    keyVocabulary: Array.isArray(lesson.keyVocabulary)
      ? lesson.keyVocabulary.map((entry) => ({
        ...(entry?._id ? { _id: entry._id } : {}),
        thai: typeof entry?.thai === 'string' ? entry.thai : '',
        translation: typeof entry?.translation === 'string' ? entry.translation : '',
        transliteration: typeof entry?.transliteration === 'string' ? entry.transliteration : '',
      }))
      : [],
  };
}

export async function fetchLessonsByCourse(courseId) {
  const lessons = await apiClient.get(`/lessons/course/${courseId}`);
  return lessons.map(normalizeLesson);
}

export async function createLesson(courseId, payload) {
  const lesson = await apiClient.post(`/lessons/course/${courseId}`, payload);
  return normalizeLesson(lesson);
}

export async function updateLesson(lessonId, payload) {
  const lesson = await apiClient.put(`/lessons/${lessonId}`, payload);
  return normalizeLesson(lesson);
}

export async function deleteLesson(lessonId) {
  return apiClient.delete(`/lessons/${lessonId}`);
}
