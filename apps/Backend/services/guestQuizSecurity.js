const crypto = require("crypto");
const { getTrustedUrls } = require("../config/trustedUrls");

const SESSION_MS = 24 * 60 * 60 * 1000;
const RESULT_MS = 24 * 60 * 60 * 1000;
const CREDENTIAL_MS = 7 * 24 * 60 * 60 * 1000;
const GUEST_WRITE_HEADER = "x-guest-quiz-request";

function signingKey(env = process.env) {
  if (typeof env.JWT_SECRET !== "string" || env.JWT_SECRET.length < 16) throw new Error("Guest credential signing is unavailable");
  return crypto.createHmac("sha256", env.JWT_SECRET).update("arun-thai:guest-quiz:v1").digest();
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createCredential({ env = process.env, now = Date.now(), randomBytes = crypto.randomBytes } = {}) {
  const secret = randomBytes(32).toString("base64url");
  const issuedAt = Math.floor(now / 1000);
  const payload = `v1.${issuedAt}.${secret}`;
  const signature = crypto.createHmac("sha256", signingKey(env)).update(payload).digest("base64url");
  return { value: `${payload}.${signature}`, ownerHash: digest(secret) };
}

function renewCredential(value, { env = process.env, now = Date.now() } = {}) {
  if (!verifyCredential(value, { env, now })) return null;
  const secret = value.split(".")[2];
  const issuedAt = Math.floor(now / 1000);
  const payload = `v1.${issuedAt}.${secret}`;
  const signature = crypto.createHmac("sha256", signingKey(env)).update(payload).digest("base64url");
  return { value: `${payload}.${signature}`, ownerHash: digest(secret) };
}

function verifyCredential(value, { env = process.env, now = Date.now() } = {}) {
  if (typeof value !== "string" || value.length > 256) return null;
  const match = /^v1\.(\d{10})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) return null;
  const issuedAt = Number(match[1]) * 1000;
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now || now - issuedAt >= CREDENTIAL_MS) return null;
  const expected = crypto.createHmac("sha256", signingKey(env))
    .update(`v1.${match[1]}.${match[2]}`).digest();
  const supplied = Buffer.from(match[3], "base64url");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  return { ownerHash: digest(match[2]), issuedAt };
}

function guestCookieConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  return {
    name: production ? "__Host-arun_thai_guest_quiz" : "arun_thai_guest_quiz_dev",
    options: { httpOnly: true, secure: production, sameSite: production ? "none" : "lax",
      path: "/", maxAge: CREDENTIAL_MS },
  };
}

function readGuestCookie(header, env = process.env) {
  const name = guestCookieConfig(env).name;
  if (typeof header !== "string") return null;
  const matching = header.split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${name}=`));
  if (matching.length !== 1) return null;
  try { return decodeURIComponent(matching[0].slice(name.length + 1)); }
  catch { return null; }
}

function credentialForGuestStart(cookieHeader, { env = process.env, now = Date.now() } = {}) {
  const existing = readGuestCookie(cookieHeader, env);
  return existing && verifyCredential(existing, { env, now })
    ? renewCredential(existing, { env, now }) : createCredential({ env, now });
}

function setGuestCookie(res, credential, env = process.env) {
  const { name, options } = guestCookieConfig(env);
  res.cookie(name, credential.value, options);
}

function guestWriteAllowed(req, env = process.env) {
  const origin = req?.headers?.origin;
  const expected = getTrustedUrls(env).frontendUrl;
  // A custom header forces a browser preflight; exact Origin protects cookies
  // even when the frontend/API are cross-site in production.
  return typeof origin === "string" && origin === expected
    && req.headers[GUEST_WRITE_HEADER] === "1"
    && !req.headers.authorization
    && /^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "");
}

function requireGuestWriteOrigin(req, res, next) {
  try {
    if (guestWriteAllowed(req)) return next();
  } catch (_error) { /* Invalid trusted origin configuration fails closed. */ }
  return res.status(403).json({ code: "guest_quiz_origin_denied", message: "Guest quiz request is not allowed." });
}

function ownsGuestRecord(record, ownerHash, now = new Date()) {
  return Boolean(record && typeof ownerHash === "string" && /^[a-f0-9]{64}$/.test(ownerHash)
    && typeof record.ownerHash === "string" && /^[a-f0-9]{64}$/.test(record.ownerHash)
    && crypto.timingSafeEqual(Buffer.from(record.ownerHash, "hex"), Buffer.from(ownerHash, "hex"))
    && record.expiresAt instanceof Date && record.expiresAt > now);
}

function guestSessionAvailable(record, ownerHash, now = new Date()) {
  return ownsGuestRecord(record, ownerHash, now) && record.startedAt instanceof Date
    && record.expiresAt.getTime() === record.startedAt.getTime() + SESSION_MS
    && !record.invalidatedAt && record.activeSlot === true;
}

function guestResultAvailable(record, ownerHash, now = new Date()) {
  return ownsGuestRecord(record, ownerHash, now) && record.submittedAt instanceof Date
    && record.expiresAt.getTime() === record.submittedAt.getTime() + RESULT_MS;
}

module.exports = { SESSION_MS, RESULT_MS, CREDENTIAL_MS, createCredential, verifyCredential,
  renewCredential, guestCookieConfig, readGuestCookie, credentialForGuestStart, setGuestCookie,
  guestWriteAllowed, requireGuestWriteOrigin,
  ownsGuestRecord, guestSessionAvailable, guestResultAvailable };
