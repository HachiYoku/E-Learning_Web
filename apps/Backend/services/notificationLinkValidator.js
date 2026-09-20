const STATIC_NOTIFICATION_PATHS = new Set([
  "/",
  "/courses",
  "/practice",
  "/flashcards",
  "/blog",
  "/about",
  "/app",
  "/app/courses",
  "/app/explore",
  "/app/practice",
  "/app/practice/flashcards",
  "/app/blog",
  "/app/profile",
  "/app/notifications",
  "/app/orders",
  "/app/more",
  "/app/support",
  "/my-courses",
  "/my-course-order",
  "/my-profile",
  "/notifications",
]);

const DYNAMIC_NOTIFICATION_PATHS = [
  /^\/courses\/[A-Za-z0-9_-]+$/,
  /^\/practice\/[A-Za-z0-9_-]+$/,
  /^\/enroll\/[A-Za-z0-9_-]+$/,
  /^\/payment\/[A-Za-z0-9_-]+$/,
  /^\/app\/learn\/[A-Za-z0-9_-]+$/,
  /^\/app\/learn\/[A-Za-z0-9_-]+\/quiz\/[A-Za-z0-9_-]+$/,
  /^\/app\/course-quiz\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/,
  /^\/app\/orders\/[A-Za-z0-9_-]+$/,
  /^\/order-status\/[A-Za-z0-9_-]+$/,
  /^\/course-lessons\/[A-Za-z0-9_-]+$/,
  /^\/course-lessons\/[A-Za-z0-9_-]+\/quiz\/[A-Za-z0-9_-]+$/,
  /^\/course-quiz\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/,
];

const PATH_ALIASES = new Map([
  ["/profile", "/app/profile"],
]);

function decodeRepeatedly(value) {
  let decoded = value;
  for (let index = 0; index < 4; index += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      throw new Error("Notification link contains invalid URL encoding");
    }
    if (next === decoded) return decoded;
    decoded = next;
  }
  return decoded;
}

function isAllowedPath(pathname) {
  return STATIC_NOTIFICATION_PATHS.has(pathname)
    || DYNAMIC_NOTIFICATION_PATHS.some((pattern) => pattern.test(pathname));
}

function normalizeNotificationLink(link) {
  if (link === undefined || link === null || link === "") return "";
  if (typeof link !== "string") throw new Error("Notification link must be a string");

  const value = link.trim();
  if (!value) return "";
  if (value.length > 2048 || /[\u0000-\u001F\u007F]/.test(value)) {
    throw new Error("Notification link is malformed");
  }

  // Validate both the literal and repeatedly decoded forms. This prevents
  // protocol-relative and backslash bypasses such as /%252f%252fevil.test.
  const decoded = decodeRepeatedly(value);
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")
    || !decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) {
    throw new Error("Notification link must be an internal application path");
  }

  let parsed;
  try {
    parsed = new URL(value, "https://notification.invalid");
  } catch {
    throw new Error("Notification link is malformed");
  }

  if (parsed.origin !== "https://notification.invalid") {
    throw new Error("Notification link must be an internal application path");
  }

  const pathname = PATH_ALIASES.get(parsed.pathname) || parsed.pathname;
  if (!isAllowedPath(pathname)) {
    throw new Error("Notification link is not a supported application route");
  }

  return `${pathname}${parsed.search}${parsed.hash}`;
}

function isSafeNotificationLink(link) {
  try {
    normalizeNotificationLink(link);
    return true;
  } catch {
    return false;
  }
}

module.exports = { normalizeNotificationLink, isSafeNotificationLink };
