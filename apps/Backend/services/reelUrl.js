const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com"]);
const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com"]);
const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const TIKTOK_VIDEO_ID = /^\d+$/;
const FACEBOOK_SHARE_PATH = /^\/share\/v\/[A-Za-z0-9_-]+\/?$/;
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const MAX_FACEBOOK_REDIRECTS = 4;
const FACEBOOK_RESOLUTION_TIMEOUT_MS = 5000;

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeInput(value) {
  if (typeof value !== "string" || !value.trim()) throw validationError("A public social-media URL is required.");
  if (value.length > 2048 || /[\u0000-\u001F\u007F]/.test(value)) throw validationError("The social-media URL is invalid.");

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw validationError("The social-media URL is invalid.");
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
    throw validationError("Use a public HTTPS social-media URL.");
  }
  parsed.hash = "";
  return parsed;
}

function isSafeFacebookHop(parsed) {
  return parsed.protocol === "https:"
    && !parsed.username
    && !parsed.password
    && !parsed.port
    && FACEBOOK_HOSTS.has(parsed.hostname);
}

function facebookResolutionError(message = "Unable to resolve the Facebook share URL. Paste a public Facebook video or Reel URL instead.") {
  return validationError(message);
}

async function requestFacebookRedirect(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FACEBOOK_RESOLUTION_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { method: "HEAD", redirect: "manual", signal: controller.signal });
  } catch {
    throw facebookResolutionError();
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveFacebookShareUrl(initial, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== "function") throw facebookResolutionError();
  let current = initial;

  for (let redirects = 0; redirects <= MAX_FACEBOOK_REDIRECTS; redirects += 1) {
    const response = await requestFacebookRedirect(current.href, fetchImpl);
    if (!REDIRECT_STATUS.has(response.status)) return current;
    if (redirects === MAX_FACEBOOK_REDIRECTS) throw facebookResolutionError("The Facebook share URL redirected too many times.");

    const location = response.headers?.get("location");
    if (!location) throw facebookResolutionError("The Facebook share URL did not provide a redirect destination.");

    let next;
    try {
      next = new URL(location, current);
    } catch {
      throw facebookResolutionError();
    }
    if (!isSafeFacebookHop(next)) throw facebookResolutionError("The Facebook share URL redirected to an unsupported destination.");
    current = next;
  }

  throw facebookResolutionError("The Facebook share URL redirected too many times.");
}

function canonicalYouTube(parsed) {
  let videoId = "";
  if (parsed.hostname === "youtube.com" || parsed.hostname === "www.youtube.com") {
    if (parsed.pathname === "/watch") videoId = parsed.searchParams.get("v") || "";
    if (parsed.pathname.startsWith("/shorts/")) videoId = parsed.pathname.split("/")[2] || "";
  }
  if (parsed.hostname === "youtu.be") videoId = parsed.pathname.split("/")[1] || "";
  if (!VIDEO_ID.test(videoId)) throw validationError("Use a supported public YouTube video or Short URL.");
  return { platform: "youtube", url: `https://www.youtube.com/watch?v=${videoId}` };
}

function canonicalTikTok(parsed) {
  const match = parsed.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/);
  if (!match || !TIKTOK_VIDEO_ID.test(match[1])) throw validationError("Use a supported public TikTok video URL.");
  const handle = parsed.pathname.split("/")[1];
  return { platform: "tiktok", url: `https://www.tiktok.com/${handle}/video/${match[1]}` };
}

function canonicalFacebook(parsed) {
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  const isVideo = /^\/[^/]+\/videos\/\d+$/.test(path);
  const isReel = /^\/reel\/\d+$/.test(path);
  const isWatch = path === "/watch" && /^\d+$/.test(parsed.searchParams.get("v") || "");
  if (!isVideo && !isReel && !isWatch) throw validationError("Use a supported public Facebook video or Reel URL.");
  if (isWatch) return { platform: "facebook", url: `https://www.facebook.com/watch/?v=${parsed.searchParams.get("v")}` };
  return { platform: "facebook", url: `https://www.facebook.com${path}/` };
}

function normalizeReelUrl(value) {
  const parsed = normalizeInput(value);
  if (parsed.hostname === "youtu.be" || YOUTUBE_HOSTS.has(parsed.hostname)) return canonicalYouTube(parsed);
  if (TIKTOK_HOSTS.has(parsed.hostname)) return canonicalTikTok(parsed);
  if (FACEBOOK_HOSTS.has(parsed.hostname)) return canonicalFacebook(parsed);
  throw validationError("Only public YouTube, TikTok, and Facebook video URLs are supported.");
}

async function resolveReelUrl(value, { fetchImpl } = {}) {
  const parsed = normalizeInput(value);
  if (!FACEBOOK_HOSTS.has(parsed.hostname) || !FACEBOOK_SHARE_PATH.test(parsed.pathname) || parsed.search || !isSafeFacebookHop(parsed)) {
    return normalizeReelUrl(value);
  }
  const finalUrl = await resolveFacebookShareUrl(parsed, fetchImpl);
  try {
    return canonicalFacebook(finalUrl);
  } catch {
    throw facebookResolutionError("The Facebook share URL did not resolve to a supported public video or Reel URL.");
  }
}

module.exports = { normalizeReelUrl, resolveReelUrl, resolveFacebookShareUrl };
