import { apiClient } from "../api/client";

function normalizeEnrollment(enrollment) {
  if (!enrollment) {
    return null;
  }

  return {
    id: enrollment._id,
    course: enrollment.courseId
      ? {
          id: enrollment.courseId._id,
          title: enrollment.courseId.title,
          description: enrollment.courseId.description || "",
          price: `${Number(enrollment.courseId.price || 0).toLocaleString()} ฿`,
          image: enrollment.courseId.thumbnail || "",
          isPublished: Boolean(enrollment.courseId.isPublished),
        }
      : null,
    payment: enrollment.paymentId
      ? {
          id: enrollment.paymentId._id,
          status: enrollment.paymentId.status,
          paymentImage: enrollment.paymentId.paymentImage,
        }
      : null,
    progress: normalizeProgress(enrollment.progress),
    createdAt: enrollment.createdAt,
  };
}

function normalizeProgress(progress) {
  if (!progress) {
    return { completedLessonIds: [], completedLessons: 0, totalLessons: 0, percentage: 0, lastOpenedLesson: null, lastOpenedAt: null };
  }

  return {
    completedLessonIds: progress.completedLessonIds || [],
    completedLessons: Number(progress.completedLessons || 0),
    totalLessons: Number(progress.totalLessons || 0),
    percentage: Number(progress.percentage || 0),
    lastOpenedLesson: progress.lastOpenedLesson
      ? { id: progress.lastOpenedLesson.id || progress.lastOpenedLesson._id, title: progress.lastOpenedLesson.title || "", order: Number(progress.lastOpenedLesson.order || 0) }
      : null,
    lastOpenedAt: progress.lastOpenedAt || null,
  };
}

export async function fetchMyEnrollments() {
  const enrollments = await apiClient.get("/enrollments/my");
  return enrollments.map(normalizeEnrollment);
}

export async function checkEnrollment(courseId) {
  return apiClient.get(`/enrollments/check/${courseId}`);
}

export async function fetchEnrollmentProgress(courseId) {
  return normalizeProgress(await apiClient.get(`/enrollments/course/${courseId}/progress`));
}

export async function saveLastOpenedLesson(courseId, lessonId) {
  return normalizeProgress(await apiClient.put(`/enrollments/course/${courseId}/progress/last-opened`, { lessonId }));
}

export async function setLessonCompleted(courseId, lessonId, completed) {
  return normalizeProgress(await apiClient.put(`/enrollments/course/${courseId}/progress/completion`, { lessonId, completed }));
}
