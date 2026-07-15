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
