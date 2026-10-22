const { setGuestCookie } = require("../services/guestQuizSecurity");
const runtime = require("../services/guestQuizRuntime");

function respondError(res, error) {
  if ([400, 404, 409, 503].includes(error?.status) && typeof error.code === "string") {
    return res.status(error.status).json({ message: error.message, code: error.code });
  }
  console.error("Guest quiz request failed", { name: error?.name });
  return res.status(503).json({ code: "guest_quiz_unavailable", message: "Guest quizzes are temporarily unavailable." });
}

const start = async (req, res) => {
  try {
    const result = await runtime.startOrResumeGuestQuiz({ quizId: req.params.quizId, ownerHash: req.guestOwnerHash });
    setGuestCookie(res, req.guestCredential);
    res.set("Cache-Control", "no-store");
    return res.status(result.created ? 201 : 200).json(result);
  } catch (error) { return respondError(res, error); }
};

const getSession = async (req, res) => {
  try {
    const result = await runtime.getGuestQuizSession({ quizId: req.params.quizId,
      sessionId: req.params.sessionId, ownerHash: req.guestOwnerHash });
    res.set("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) { return respondError(res, error); }
};

const submit = async (req, res) => {
  try {
    const result = await runtime.submitGuestQuiz({ quizId: req.params.quizId,
      sessionId: req.body?.sessionId, submittedRevision: req.body?.revision,
      answers: req.body?.answers, ownerHash: req.guestOwnerHash });
    res.set("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) { return respondError(res, error); }
};

const getResult = async (req, res) => {
  try {
    const result = await runtime.getGuestQuizResult({ attemptId: req.params.attemptId,
      ownerHash: req.guestOwnerHash });
    res.set("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) { return respondError(res, error); }
};

module.exports = { start, getSession, submit, getResult };
