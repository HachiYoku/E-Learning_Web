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
    createdAt: enrollment.createdAt,
  };
}

export async function fetchMyEnrollments() {
  const enrollments = await apiClient.get("/enrollments/my");
  return enrollments.map(normalizeEnrollment);
}

export async function checkEnrollment(courseId) {
  return apiClient.get(`/enrollments/check/${courseId}`);
}
