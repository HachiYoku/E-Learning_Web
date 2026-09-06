import { apiClient } from "../api/client";

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt || null,
    dateCreated: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "",
    purchasedCourses: Array.isArray(user.purchasedCourses) ? user.purchasedCourses : [],
    isActive: Boolean(user.isActive),
    recordType: user.recordType || "system",
    marketingOptIn: Boolean(user.marketingOptIn),
    message: user.message || "",
    avatar:
      user.avatar ||
      `https://ui-avatars.com/api/?background=f8b2c0&color=111827&name=${encodeURIComponent(user.name || "User")}`,
  };
}

export async function fetchUsers() {
  const users = await apiClient.get("/user");
  return users.map(normalizeUser);
}

export async function fetchPendingVerifications() {
  const users = await apiClient.get("/user/pending-verifications");
  return users.map((user) => ({
    ...normalizeUser(user),
    verificationTokenExpires: user.verificationTokenExpires || null,
    unverifiedExpiresAt: user.unverifiedExpiresAt || null,
  }));
}

export async function deleteUser(id, adminPassword) {
  // Pass adminPassword for server-side re-authentication when supported
  return apiClient.delete(`/user/${id}`, adminPassword ? { adminPassword } : undefined);
}

export async function updateUserStatus(id, isActive, adminPassword) {
  return apiClient.put(`/user/${id}/status`, { isActive, adminPassword });
}

export async function updateUserCourseAccess(id, courseIds, adminPassword) {
  const response = await apiClient.put(`/user/${id}/course-access`, { courseIds, adminPassword });
  return normalizeUser(response.user);
}
