const Enrollment = require("../models/enrollmentModel");

class QuizAccessError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const COURSE_CONTEXTS = new Set(["course_lesson", "course_final"]);

function unavailableQuizError() {
  return new QuizAccessError(404, "Quiz is unavailable.", "quiz_unavailable");
}

function isQuizAvailable(quiz) {
  return quiz?.status === "published";
}

async function authorizeStudentQuizAccess({ quiz, user, session, requireAvailable = true }) {
  if (!quiz) throw unavailableQuizError();
  if (requireAvailable && !isQuizAvailable(quiz)) throw unavailableQuizError();
  if (user?.role === "admin") return;

  if (COURSE_CONTEXTS.has(quiz.contextType)) {
    const enrollment = await Enrollment.exists({ userId: user?.id || user?._id, courseId: quiz.course }).session(session || null);
    // Match an unknown quiz so a guessed Quiz ID cannot confirm a private
    // course assessment exists.
    if (!enrollment) throw unavailableQuizError();
    return;
  }

  // Homework and standalone policies are deliberately not exposed until their
  // dedicated runtime integrations exist. A known Quiz ID is never enough.
  throw unavailableQuizError();
}

module.exports = {
  QuizAccessError,
  COURSE_CONTEXTS,
  isQuizAvailable,
  authorizeStudentQuizAccess,
  unavailableQuizError,
};
