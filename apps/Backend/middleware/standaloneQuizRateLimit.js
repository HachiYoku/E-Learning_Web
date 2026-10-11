const { consumeStandaloneQuizRateLimit } = require("../services/standaloneQuizRateLimit");

function standaloneQuizRateLimit(operation, consume = consumeStandaloneQuizRateLimit) {
  if (!["start", "submit"].includes(operation)) throw new Error("Unsupported Quiz rate-limit operation");
  return async function limitStandaloneQuizRequest(req, res, next) {
    // Future routes must mount validateToken before this middleware. Never use
    // a user ID supplied in params, query, or body for the shared counter.
    if (!req.user?.id) return res.status(401).json({ code: "unauthorized", message: "Authentication required." });
    try {
      const result = await consume({ userId: req.user.id, operation });
      if (!result.allowed) {
        res.set("Retry-After", String(result.retryAfter));
        return res.status(429).json({ code: "quiz_rate_limited", message: "Too many Quiz requests. Please try again later." });
      }
      return next();
    } catch (_error) {
      return res.status(503).json({ code: "quiz_rate_limit_unavailable", message: "Quiz requests are temporarily unavailable." });
    }
  };
}

module.exports = { standaloneQuizRateLimit };
