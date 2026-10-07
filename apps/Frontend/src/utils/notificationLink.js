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

const LEGACY_COURSE_FINAL_REQUEST_TITLES = new Set([
  "Extra quiz submission approved",
  "Extra quiz submission request declined",
]);
const LEGACY_COURSE_FINAL_REQUEST_PATH = /^\/app\/learn\/([A-Za-z0-9_-]+)\/quiz\/([A-Za-z0-9_-]+)$/;

function decodeRepeatedly(value) {
  let decoded = value;
  for (let index = 0; index < 4; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return decoded;
      decoded = next;
    } catch {
      return null;
    }
  }
  return decoded;
}

function hasControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1F || code === 0x7F) return true;
  }
  return false;
}

// This is defence in depth. The backend is the authority and never stores or
// returns unsafe links, but clients must not trust API data blindly.
export function getSafeNotificationPath(link) {
  if (typeof link !== "string") return "";
  const value = link.trim();
  const decoded = decodeRepeatedly(value);
  if (!value || !decoded || hasControlCharacter(value)
    || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")
    || !decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return "";

  try {
    const parsed = new URL(value, "https://notification.invalid");
    if (parsed.origin !== "https://notification.invalid") return "";
    const pathname = parsed.pathname === "/profile" ? "/app/profile" : parsed.pathname;
    if (!STATIC_PATHS.has(pathname) && !DYNAMIC_PATHS.some((pattern) => pattern.test(pathname))) return "";
    return `${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}

// Phase 3B originally stored Course Final notifications using the lesson-quiz
// route. Keep those existing notifications usable without changing valid lesson
// links or accepting a target that does not agree with the notification course.
export function getSafeNotificationDestination(notification) {
  const destination = getSafeNotificationPath(notification?.link);
  if (!destination) return "";

  const legacyMatch = destination.match(LEGACY_COURSE_FINAL_REQUEST_PATH);
  if (!legacyMatch || !LEGACY_COURSE_FINAL_REQUEST_TITLES.has(notification?.title)) {
    return destination;
  }

  const [, courseId, quizId] = legacyMatch;
  if (String(notification?.courseId || "") !== courseId) return "";
  return getSafeNotificationPath(`/app/course-quiz/${courseId}/${quizId}`);
}
