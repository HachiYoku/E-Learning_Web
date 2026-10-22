const { credentialForGuestStart, readGuestCookie, verifyCredential } = require("../services/guestQuizSecurity");
const { inspectGuestQuizReadiness } = require("../services/guestQuizReadiness");
const { consumeGuestQuizRateLimit } = require("../services/guestQuizRateLimit");

async function requireGuestQuizReady(_req, res, next) {
  const state = await inspectGuestQuizReadiness();
  if (!state.ready) return res.status(503).json({ code: "guest_quiz_unavailable",
    message: "Guest quizzes are temporarily unavailable." });
  return next();
}

function prepareGuestStart(req, res, next) {
  try {
    req.guestCredential = credentialForGuestStart(req.headers.cookie);
    req.guestOwnerHash = req.guestCredential.ownerHash;
    return next();
  } catch (_error) { return res.status(503).json({ code: "guest_quiz_unavailable", message: "Guest quizzes are temporarily unavailable." }); }
}

function requireGuestOwner(req, res, next) {
  try {
    const cookie = readGuestCookie(req.headers.cookie);
    const verified = verifyCredential(cookie);
    if (verified) {
      req.guestOwnerHash = verified.ownerHash;
      return next();
    }
  } catch (_error) { /* Invalid or unavailable credentials fail closed. */ }
  return res.status(401).json({ code: "guest_quiz_credential_required", message: "Guest quiz session unavailable." });
}

function guestQuizRateLimit(operation) {
  return async (req, res, next) => {
    try {
      // Express req.ip is trusted only after the readiness guard validates
      // the deployment's proxy setting. Never use raw forwarding headers.
      const result = await consumeGuestQuizRateLimit({ ownerHash: req.guestOwnerHash, ip: req.ip, operation });
      if (!result.allowed) {
        res.set("Retry-After", String(result.retryAfter));
        return res.status(429).json({ code: "guest_quiz_rate_limited", message: "Too many quiz requests. Try again later." });
      }
      return next();
    } catch (_error) {
      return res.status(503).json({ code: "guest_quiz_rate_unavailable", message: "Guest quizzes are temporarily unavailable." });
    }
  };
}

module.exports = { requireGuestQuizReady, prepareGuestStart, requireGuestOwner, guestQuizRateLimit };
