const { unavailableQuizError } = require("./quizAccessPolicy");

// Call within the same fenced transaction as a future guest session/attempt
// write. A preflight read alone does not prevent a lifecycle race.
function assertGuestPublicQuiz(quiz, set) {
  if (!quiz || quiz.contextType !== "standalone" || quiz.status !== "published"
    || quiz.standaloneAccess !== "public"
    || !Number.isSafeInteger(quiz.publishedRevision) || quiz.publishedRevision < 1
    || quiz.revision !== quiz.publishedRevision
    || !quiz.quizSet || !set || String(set._id) !== String(quiz.quizSet)
    || set.status !== "active") throw unavailableQuizError();
  return quiz;
}

module.exports = { assertGuestPublicQuiz };
