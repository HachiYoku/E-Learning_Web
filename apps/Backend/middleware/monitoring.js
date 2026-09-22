const { randomUUID } = require("crypto");

function safePath(req) {
  if (req.route?.path) return `${req.baseUrl || ""}${req.route.path}`;

  // `path` deliberately excludes the query string. Redact the only route whose
  // path currently contains a security token when Express has not resolved it.
  return req.path.replace(/^(\/auth\/reset-password)\/[^/]+$/, "$1/:token");
}

function redact(value) {
  return String(value || "unknown error")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, "[redacted-mongodb-url]")
    .replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]")
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/\b(authorization|cookie|password|token|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|reset[_-]?token|verification[_-]?token)\s*[:=]\s*[^\s,;&"']+/gi, "$1=[redacted]");
}

function logUnexpectedError(req, error) {
  const errorName = error?.name || "Error";
  const errorMessage = redact(error?.message || error);
  console.error(
    `[ERROR] requestId=${req.requestId || "unknown"} method=${req.method} path=${safePath(req)} error=${errorName}: ${errorMessage}`
  );
}

function requestId(req, res, next) {
  const id = randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-ID", id);
  next();
}

function requestCompletionLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(
      `[HTTP] requestId=${req.requestId} method=${req.method} path=${safePath(req)} status=${res.statusCode} durationMs=${Math.round(durationMs)}`
    );
  });
  next();
}

// Many existing controllers return `{ message: error.message }` directly.
// This final response boundary prevents unexpected 5xx details from reaching
// clients while those controllers are progressively migrated to `next(error)`.
function sanitizeServerErrorResponses(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    // `/health` intentionally uses this minimal 503 response to distinguish an
    // unavailable dependency from an application error.
    if (res.statusCode >= 500 && !(res.statusCode === 503 && body?.status === "unavailable")) {
      if (body?.message !== "Internal server error") {
        logUnexpectedError(req, new Error(body?.message || "Unexpected server error"));
      }
      return json({ message: "Internal server error", requestId: req.requestId });
    }
    return json(body);
  };
  next();
}

module.exports = {
  requestId,
  requestCompletionLogger,
  sanitizeServerErrorResponses,
  logUnexpectedError,
  safePath,
  redact,
};
