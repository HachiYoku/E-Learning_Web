const Quiz = require("../models/quizModel");
const QuizAttempt = require("../models/quizAttemptModel");

async function hasQuizHistoryFor({ courseId, lessonId }) {
  const filter = {};
  if (courseId) filter.course = courseId;
  if (lessonId) filter.lesson = lessonId;
  const quizIds = await Quiz.find(filter).distinct("_id");

  const snapshotFilter = {
    $or: [
      ...(courseId ? [{ "submissionSnapshot.course.id": courseId }] : []),
      ...(lessonId ? [{ "submissionSnapshot.lesson.id": lessonId }] : []),
    ],
  };
  const conditions = [];
  if (quizIds.length) conditions.push({ quiz: { $in: quizIds } });
  if (snapshotFilter.$or.length) conditions.push(snapshotFilter);
  if (!conditions.length) return false;
  return Boolean(await QuizAttempt.exists({ $or: conditions }));
}

module.exports = { hasQuizHistoryFor };
