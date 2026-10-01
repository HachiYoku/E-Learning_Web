export const ADMIN_RETURN_DESTINATION_KEY = "arun-thai-admin-return-destination";

export function internalDestination(location) {
  const pathname = typeof location?.pathname === "string" ? location.pathname : "";
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname === "/login" || pathname.startsWith("/login/")) return "/";
  const search = typeof location?.search === "string" ? location.search : "";
  const hash = typeof location?.hash === "string" ? location.hash : "";
  return `${pathname}${search}${hash}`;
}

export function saveAdminReturnDestination(location = window.location) {
  const destination = internalDestination(location);
  if (destination !== "/") window.sessionStorage.setItem(ADMIN_RETURN_DESTINATION_KEY, destination);
}

export function readAdminReturnDestination() {
  const destination = window.sessionStorage.getItem(ADMIN_RETURN_DESTINATION_KEY);
  if (!destination) return "/";

  try {
    const parsed = new URL(destination, "https://admin.local");
    if (parsed.origin !== "https://admin.local") return "/";
    const normalized = internalDestination(parsed);
    return normalized === destination ? normalized : "/";
  } catch {
    return "/";
  }
}

export function clearAdminReturnDestination() {
  window.sessionStorage.removeItem(ADMIN_RETURN_DESTINATION_KEY);
}
