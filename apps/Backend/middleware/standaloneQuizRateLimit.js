const { consumeStandaloneQuizRateLimit } = require("../services/standaloneQuizRateLimit");
const mongoose = require("mongoose");
const Quiz = require("../models/quizModel");
const QuizSession = require("../models/quizSessionModel");
const QuizAttempt = require("../models/quizAttemptModel");

const unavailable = { status: 404, code: "quiz_unavailable", message: "Quiz is unavailable." };
const invalidSubmission = { status: 400, code: "invalid_quiz_submission", message: "Invalid Quiz submission." };

async function resolveCanonicalQuizId(req, operation) {
  const routeId = req.params?.quizId;
  if (typeof routeId !== "string" || !/^[a-f\d]{24}$/i.test(routeId)) return { error: unavailable };
  if (operation === "submit") {
    const sessionId = req.body?.sessionId;
    if (typeof sessionId !== "string" || !/^[a-f\d]{24}$/i.test(sessionId)) {
      return { error: invalidSubmission };
    }
    // A completed attempt outlives its TTL session and the Quiz lifecycle.
    // Never use a client-supplied Quiz ID to charge another Quiz's allowance.
    const ownedAttempt = await QuizAttempt.findOne({ session: sessionId, user: req.user.id,
      "submissionSnapshot.contextType": "standalone" }).select("quiz").lean();
    const ownedSession = ownedAttempt || await QuizSession.findOne({ _id: sessionId, user: req.user.id,
      contextType: "standalone" }).select("quiz").lean();
    if (!ownedSession || String(ownedSession.quiz) !== routeId.toLowerCase()) return { error: unavailable };
  }
  // Include Disabled/Archived/Draft records so an otherwise owned request is
  // charged before the runtime service applies its authoritative state check.
  const quiz = await Quiz.findOne({ _id: routeId, contextType: "standalone" }).select("_id").lean();
  return quiz ? { quizId: String(quiz._id) } : { error: unavailable };
}

function standaloneQuizRateLimit(operation, consume = consumeStandaloneQuizRateLimit,
  resolve = resolveCanonicalQuizId) {
  if (!["start", "submit"].includes(operation)) throw new Error("Unsupported Quiz rate-limit operation");
  return async function limitStandaloneQuizRequest(req, res, next) {
    // Future routes must mount validateToken before this middleware. Never use
    // a user ID supplied in params, query, or body for the shared counter.
    if (!mongoose.isValidObjectId(req.user?.id)) {
      return res.status(401).json({ code: "unauthorized", message: "Authentication required." });
    }
    try {
      const identity = await resolve(req, operation);
      if (identity.error) return res.status(identity.error.status).json({
        code: identity.error.code, message: identity.error.message });
      const result = await consume({ userId: req.user.id, quizId: identity.quizId, operation });
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

module.exports = { standaloneQuizRateLimit, resolveCanonicalQuizId };
