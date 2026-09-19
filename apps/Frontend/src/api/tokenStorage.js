// Deliberately module-scoped: an access token must not survive a reload or be
// readable from browser storage. A refresh cookie restores it at app startup.
let accessToken = null;

export function getToken() {
  return accessToken;
}

export function setToken(token) {
  accessToken = token || null;
}

export function clearToken() {
  accessToken = null;
}
