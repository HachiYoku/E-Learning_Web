import { apiClient } from "../api/client";

export function normalizeCourse(course) {
  if (!course) {
    return null;
  }

  return {
    id: course._id,
    title: course.title,
    description: course.description || "",
    price: `${Number(course.price || 0).toLocaleString()} บาท`,
    priceValue: Number(course.price || 0),
    rating: Number(course.rating || 0),
    reviews: Number(course.reviews || 0),
    image: course.thumbnail || "",
    paymentQr: course.paymentQr || "",
    learnings: Array.isArray(course.features) ? course.features : [],
    isPublished: Boolean(course.isPublished),
    lessons: Number(course.lessonCount || 0),
    enrollmentCount: Number(course.enrollmentCount || 0),
    createdBy: course.createdBy || null,
  };
}

function buildCourseFormData(payload) {
  const formData = new FormData();

  formData.append("title", payload.title);
  formData.append("description", payload.description || "");
  formData.append("price", String(payload.price));
  formData.append("rating", String(payload.rating ?? 0));
  formData.append("isPublished", String(Boolean(payload.isPublished)));

  const features = (payload.learnings || []).filter(Boolean);
  formData.append("features", JSON.stringify(features));

  if (payload.imageFile) {
    formData.append("thumbnail", payload.imageFile);
  } else if (payload.image) {
    formData.append("thumbnail", payload.image);
  }

  if (payload.paymentQrFile) {
    formData.append("paymentQr", payload.paymentQrFile);
  } else if (payload.paymentQr) {
    formData.append("paymentQr", payload.paymentQr);
  }

  return formData;
}

export async function fetchCourses() {
  const courses = await apiClient.get("/courses");
  return courses.map(normalizeCourse);
}

export async function fetchCourseById(id) {
  const course = await apiClient.get(`/courses/${id}`);
  return normalizeCourse(course);
}

export async function createCourse(payload) {
  const course = await apiClient.post("/courses", buildCourseFormData(payload));
  return normalizeCourse(course);
}

export async function updateCourse(id, payload) {
  const course = await apiClient.put(`/courses/${id}`, buildCourseFormData(payload));
  return normalizeCourse(course);
}

export async function deleteCourse(id) {
  return apiClient.delete(`/courses/${id}`);
}
