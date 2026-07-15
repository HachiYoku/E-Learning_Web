import { clearToken, getToken } from "./tokenStorage";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

export const SESSION_EXPIRED_EVENT = "user-session-expired";

function getFriendlyErrorMessage(status, backendMessage) {
  if (
    status === 401 &&
    ["Token has expired", "Invalid token", "User is not authorized!"].includes(
      backendMessage
    )
  ) {
    return "Your session expired. Please log in again.";
  }

  return backendMessage || "Something went wrong";
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(
        new CustomEvent(SESSION_EXPIRED_EVENT, {
          detail: {
            message: getFriendlyErrorMessage(response.status, data?.message),
          },
        })
      );
    }

    const message = getFriendlyErrorMessage(response.status, data?.message);
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const apiClient = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: (path, body) =>
    request(path, {
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: (path, body) =>
    request(path, {
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: (path) =>
    request(path, {
      method: "DELETE",
    }),
};
