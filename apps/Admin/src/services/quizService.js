import { apiClient } from "../api/client";

const normalizeQuiz = (quiz) => ({
  id: quiz._id,
  title: quiz.title,
  maxAttempts: quiz.maxAttempts ?? null,
  course: quiz.course,
  lesson: quiz.lesson,
  quizType: quiz.quizType || "lesson",
  questions: quiz.questions || [],
  createdAt: quiz.createdAt,
});

function buildQuizFormData(payload) {
  const formData = new FormData();
  formData.append("courseId", payload.courseId);
  if (payload.lessonId) formData.append("lessonId", payload.lessonId);
  formData.append("title", payload.title.trim());
  formData.append("quizType", payload.quizType || "lesson");
  formData.append("maxAttempts", payload.maxAttempts === null || payload.maxAttempts === "" ? "" : String(payload.maxAttempts));
  formData.append("questions", JSON.stringify(payload.questions.map(({ imageFile, preview, ...question }) => question)));
  payload.questions.forEach((question, index) => {
    if (question.imageFile) formData.append(`questionImage_${index}`, question.imageFile);
  });
  return formData;
}

export async function fetchQuizzes() {
  return (await apiClient.get("/quizzes/admin")).map(normalizeQuiz);
}

export async function fetchQuiz(id) {
  return normalizeQuiz(await apiClient.get(`/quizzes/admin/${id}`));
}

export async function createQuiz(payload) {
  return normalizeQuiz(await apiClient.post("/quizzes/admin", buildQuizFormData(payload)));
}

export async function updateQuiz(id, payload) {
  return normalizeQuiz(await apiClient.put(`/quizzes/admin/${id}`, buildQuizFormData(payload)));
}

export async function deleteQuiz(id) {
  return apiClient.delete(`/quizzes/admin/${id}`);
}

export function fetchQuizAttempts(id) {
  return apiClient.get(`/quizzes/admin/${id}/attempts`);
}
