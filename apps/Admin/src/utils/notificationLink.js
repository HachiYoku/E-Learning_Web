const STATIC_PATHS = new Set([
  "/", "/courses", "/practice", "/flashcards", "/blog", "/about",
  "/app", "/app/courses", "/app/explore", "/app/practice", "/app/practice/flashcards",
  "/app/blog", "/app/profile", "/app/notifications", "/app/orders", "/app/more", "/app/support",
  "/my-courses", "/my-course-order", "/my-profile", "/notifications",
]);
const DYNAMIC_PATHS = [
  /^\/courses\/[A-Za-z0-9_-]+$/, /^\/practice\/[A-Za-z0-9_-]+$/,
  /^\/enroll\/[A-Za-z0-9_-]+$/, /^\/payment\/[A-Za-z0-9_-]+$/,
  /^\/app\/learn\/[A-Za-z0-9_-]+$/, /^\/app\/learn\/[A-Za-z0-9_-]+\/quiz\/[A-Za-z0-9_-]+$/,
  /^\/app\/course-quiz\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/, /^\/app\/orders\/[A-Za-z0-9_-]+$/,
  /^\/order-status\/[A-Za-z0-9_-]+$/, /^\/course-lessons\/[A-Za-z0-9_-]+$/,
  /^\/course-lessons\/[A-Za-z0-9_-]+\/quiz\/[A-Za-z0-9_-]+$/, /^\/course-quiz\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/,
];

// UX-only validation. The backend repeats and enforces this policy before storage.
export function getSafeNotificationPath(link) {
  if (typeof link !== "string") return "";
  const value = link.trim();
  if (!value || /[\u0000-\u001F\u007F]/.test(value) || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "";
  try {
    let decoded = value;
    for (let index = 0; index < 4; index += 1) decoded = decodeURIComponent(decoded);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return "";
    const parsed = new URL(value, "https://notification.invalid");
    if (parsed.origin !== "https://notification.invalid") return "";
    const pathname = parsed.pathname === "/profile" ? "/app/profile" : parsed.pathname;
    if (!STATIC_PATHS.has(pathname) && !DYNAMIC_PATHS.some((pattern) => pattern.test(pathname))) return "";
    return `${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}
