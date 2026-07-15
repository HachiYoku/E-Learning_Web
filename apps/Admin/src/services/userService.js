import { apiClient } from "../api/client";

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    dateCreated: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "",
    purchasedCourses: Array.isArray(user.purchasedCourses) ? user.purchasedCourses : [],
    isActive: Boolean(user.isActive),
    avatar:
      user.avatar ||
      `https://ui-avatars.com/api/?background=f8b2c0&color=111827&name=${encodeURIComponent(user.name || "User")}`,
  };
}

export async function fetchUsers() {
  const users = await apiClient.get("/user");
  return users.map(normalizeUser);
}

export async function deleteUser(id) {
  return apiClient.delete(`/user/${id}`);
}

export async function updateUserStatus(id, isActive) {
  return apiClient.put(`/user/${id}/status`, { isActive });
}

export async function updateUserCourseAccess(id, courseIds) {
  const response = await apiClient.put(`/user/${id}/course-access`, { courseIds });
  return normalizeUser(response.user);
}
