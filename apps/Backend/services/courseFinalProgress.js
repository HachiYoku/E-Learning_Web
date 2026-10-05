const Quiz = require("../models/quizModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizUnlock = require("../models/quizUnlockModel");

function queryWithSession(query, session) {
  return session ? query.session(session) : query;
}

async function courseFinalProgress({ quiz, userId, session, recover = true }) {
  const requiredQuizzes = await queryWithSession(
    Quiz.find({ course: quiz.course, contextType: "course_lesson", status: "published" }).select("_id").lean(),
    session
  );
  const requiredIds = requiredQuizzes.map((item) => item._id);
  const completedQuizIds = requiredIds.length
    ? await queryWithSession(QuizAttempt.distinct("quiz", { user: userId, quiz: { $in: requiredIds } }), session)
    : [];
  const completedCount = completedQuizIds.length;
  let unlocked = Boolean(await queryWithSession(QuizUnlock.exists({ user: userId, quiz: quiz._id }), session));

  if (!unlocked && recover && completedCount === requiredIds.length) {
    try {
      await QuizUnlock.updateOne(
        { user: userId, quiz: quiz._id },
        { $setOnInsert: { user: userId, quiz: quiz._id, unlockedAt: new Date() } },
        { upsert: true, ...(session ? { session } : {}) }
      );
      unlocked = true;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      unlocked = Boolean(await queryWithSession(QuizUnlock.exists({ user: userId, quiz: quiz._id }), session));
    }
  }

  return {
    locked: !unlocked,
    unlocked,
    requiredCount: requiredIds.length,
    completedCount,
  };
}

async function recoverCourseFinalUnlocks({ courseId, userId, session }) {
  const finals = await queryWithSession(
    Quiz.find({ course: courseId, contextType: "course_final", status: "published" }).select("_id course contextType status").lean(),
    session
  );
  const progress = [];
  for (const quiz of finals) {
    progress.push(await courseFinalProgress({ quiz, userId, session, recover: true }));
  }
  return progress;
}

module.exports = { courseFinalProgress, recoverCourseFinalUnlocks };
