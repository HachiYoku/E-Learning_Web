const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close((error) => error ? reject(error) : resolve(port)); });
});
const stop = (child) => new Promise((resolve) => { if (!child || child.exitCode !== null) return resolve(); child.once("exit", resolve); child.kill("SIGTERM"); });
let mongo; let directory; let Quiz; let Course; let Lesson; let Enrollment; let QuizAttempt; let QuizAttemptGrant; let QuizGoalAchievement;
let submitQuiz; let studentQuizProjection; let studentQuizHistory; let quizController;
let sequence = 0;
const id = () => new mongoose.Types.ObjectId();
const unique = (value) => `${value}-${++sequence}`;
const question = (overrides = {}) => ({ prompt: "Question", image: "https://example.test/question.webp", options: ["A", "B"], correctAnswer: 0, ...overrides });
const responseRecorder = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

async function setupQuiz({ contextType = "course_lesson", maxAttempts = null, goalPercent = null } = {}) {
  const course = await Course.create({ title: unique("Course"), createdBy: id() });
  const lesson = await Lesson.create({ course: course._id, title: unique("Lesson"), videoUrl: "https://www.youtube.com/watch?v=test", order: 1 });
  const quiz = await Quiz.create({
    course: course._id,
    ...(contextType === "course_lesson" ? { lesson: lesson._id } : {}),
    contextType,
    status: "published",
    title: unique("Quiz"),
    maxAttempts,
    goalPercent,
    questions: [question()],
  });
  return { course, lesson, quiz };
}

before(async () => {
  const port = await freePort();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-quiz-runtime-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000); mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } }); mongo.once("error", reject); });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/quiz_runtime?replicaSet=paymentTests`);
  Quiz = require("../models/quizModel"); Course = require("../models/courseModel"); Lesson = require("../models/lessonModel"); Enrollment = require("../models/enrollmentModel"); QuizAttempt = require("../models/quizAttemptModel"); QuizAttemptGrant = require("../models/quizAttemptGrantModel"); QuizGoalAchievement = require("../models/quizGoalAchievementModel");
  ({ submitQuiz, studentQuizProjection, studentQuizHistory } = require("../services/quizRuntime"));
  quizController = require("../controllers/quizController");
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all([Quiz, QuizAttempt, QuizAttemptGrant, QuizGoalAchievement].map((Model) => Model.syncIndexes()));
});
after(async () => { await mongoose.disconnect(); await stop(mongo); if (directory) await fs.rm(directory, { recursive: true, force: true }); });

test("student projection enforces enrollment/status and never includes correct answers", async () => {
  const { course, quiz } = await setupQuiz();
  const enrolled = { id: id() }; const outsider = { id: id() };
  await Enrollment.create({ userId: enrolled.id, courseId: course._id });
  const projection = await studentQuizProjection({ quiz, user: enrolled });
  assert.equal(projection.revision, quiz.revision);
  assert.equal("correctAnswer" in projection.questions[0], false);
  await assert.rejects(studentQuizProjection({ quiz, user: outsider }), /unavailable/);
  quiz.status = "draft"; await quiz.save();
  await assert.rejects(studentQuizProjection({ quiz, user: enrolled }), /unavailable/);
  quiz.status = "disabled"; await quiz.save();
  await assert.rejects(studentQuizProjection({ quiz, user: enrolled }), /unavailable/);
});

test("runtime rejects stale and malformed submissions without persisting an attempt", async () => {
  const { course, quiz } = await setupQuiz(); const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  await assert.rejects(submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision - 1, answers: [0] }), /updated/);
  await assert.rejects(submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [4] }), /valid answer/);
  assert.equal(await QuizAttempt.countDocuments(), 0);
  quiz.status = "archived"; await quiz.save();
  await assert.rejects(submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] }), /unavailable/);
  assert.equal(await QuizAttempt.countDocuments(), 0);
});

test("unlimited lesson submissions provide immediate review and immutable snapshots", async () => {
  const { course, quiz } = await setupQuiz(); const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  const first = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0], score: 99, correctness: false });
  const second = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [1] });
  assert.equal(first.score, 1); assert.equal(first.review[0].correctAnswer, 0); assert.equal(first.review[0].isCorrect, true);
  assert.equal(second.attemptNumber, 2); assert.equal(second.maxAttempts, null); assert.equal(second.review[0].correctAnswer, 0);
  quiz.questions[0].prompt = "Changed"; await quiz.save();
  const history = await studentQuizHistory({ quizId: quiz._id, user });
  assert.equal(history.timesTaken, 2); assert.equal(history.attempts[0].review[0].correctAnswer, 0);
  const other = { id: id() }; await Enrollment.create({ userId: other.id, courseId: course._id });
  assert.equal((await studentQuizHistory({ quizId: quiz._id, user: other })).attempts.length, 0);
});

test("final quizzes conceal answers until the last available submission, then reveal them durably", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final" }); const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  assert.equal(quiz.maxAttempts, 3);
  const first = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] });
  assert.equal(first.attemptNumber, 1); assert.equal(first.review[0].isCorrect, true); assert.equal("correctAnswer" in first.review[0], false);
  assert.equal((await QuizAttempt.findOne({ quiz: quiz._id, user: user.id, attemptNumber: 1 }).lean()).submissionSnapshot.questions[0].correctAnswer, 0);
  const beforeReveal = await studentQuizHistory({ quizId: quiz._id, user });
  assert.equal("correctAnswer" in beforeReveal.attempts[0].review[0], false);
  const second = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [1] });
  assert.equal(second.attemptNumber, 2); assert.equal(second.review[0].isCorrect, false); assert.equal("correctAnswer" in second.review[0], false);
  const third = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] });
  assert.equal(third.attemptNumber, 3); assert.equal(third.maxAttempts, 3); assert.equal(third.review[0].correctAnswer, 0);
  assert.equal((await QuizAttempt.findOne({ quiz: quiz._id, user: user.id, attemptNumber: 3 }).lean()).correctAnswersRevealed, true);
  const afterReveal = await studentQuizHistory({ quizId: quiz._id, user });
  assert.equal(afterReveal.attempts.length, 3);
  assert.equal(afterReveal.attempts[0].review[0].correctAnswer, 0);
  await assert.rejects(submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] }), /No final quiz attempts/);
  await QuizAttemptGrant.create({ user: user.id, quiz: quiz._id, grantedBy: id() });
  const grantedSubmission = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] });
  assert.equal(grantedSubmission.attemptNumber, 4);
  assert.equal(grantedSubmission.maxAttempts, 4);
  assert.equal(grantedSubmission.review[0].correctAnswer, 0);
  assert.equal((await studentQuizHistory({ quizId: quiz._id, user })).attempts[0].review[0].correctAnswer, 0);
  await assert.rejects(submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] }), /No final quiz attempts/);
});

test("final quizzes with explicit limits keep answers hidden until their final available submission", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 5 }); const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  for (let attemptNumber = 1; attemptNumber <= 4; attemptNumber += 1) {
    const submission = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] });
    assert.equal(submission.attemptNumber, attemptNumber);
    assert.equal("correctAnswer" in submission.review[0], false);
  }
  const fifth = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] });
  assert.equal(fifth.attemptNumber, 5);
  assert.equal(fifth.review[0].correctAnswer, 0);
});

test("final answer reveal state remains private to the student who exhausted attempts", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 2 });
  const revealedUser = { id: id() }; const otherUser = { id: id() };
  await Enrollment.create([{ userId: revealedUser.id, courseId: course._id }, { userId: otherUser.id, courseId: course._id }]);
  await submitQuiz({ quizId: quiz._id, user: revealedUser, submittedRevision: quiz.revision, answers: [0] });
  await submitQuiz({ quizId: quiz._id, user: revealedUser, submittedRevision: quiz.revision, answers: [0] });
  const otherSubmission = await submitQuiz({ quizId: quiz._id, user: otherUser, submittedRevision: quiz.revision, answers: [0] });
  assert.equal("correctAnswer" in otherSubmission.review[0], false);
  const otherHistory = await studentQuizHistory({ quizId: quiz._id, user: otherUser });
  assert.equal(otherHistory.attempts.length, 1);
  assert.equal("correctAnswer" in otherHistory.attempts[0].review[0], false);
});

test("direct student quiz requests conceal unavailable and unauthorized quiz identifiers", async () => {
  const { quiz } = await setupQuiz(); const outsider = { id: id() };
  const unauthorized = responseRecorder();
  await quizController.submitQuiz({ params: { quizId: String(quiz._id) }, body: { revision: quiz.revision, answers: [0] }, user: outsider }, unauthorized);
  const unknown = responseRecorder();
  await quizController.submitQuiz({ params: { quizId: String(id()) }, body: { revision: 1, answers: [0] }, user: outsider }, unknown);
  const malformed = responseRecorder();
  await quizController.submitQuiz({ params: { quizId: "not-a-mongo-id" }, body: { revision: 1, answers: [0] }, user: outsider }, malformed);
  assert.equal(unauthorized.statusCode, 404);
  assert.deepEqual(unauthorized.body, unknown.body);
  assert.deepEqual(malformed.body, unknown.body);
  assert.equal(malformed.body.message, "Quiz is unavailable.");
  assert.doesNotMatch(malformed.body.message, /cast|mongo|mongoose/i);
});

test("final allowance uses grants atomically and records durable goal achievement", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 1, goalPercent: 50 });
  const firstUser = { id: id() }; const secondUser = { id: id() }; const concurrentUser = { id: id() };
  await Enrollment.create([{ userId: firstUser.id, courseId: course._id }, { userId: secondUser.id, courseId: course._id }, { userId: concurrentUser.id, courseId: course._id }]);
  await QuizAttemptGrant.create({ user: firstUser.id, quiz: quiz._id, grantedBy: id() });
  const [first, second] = await Promise.all([
    submitQuiz({ quizId: quiz._id, user: firstUser, submittedRevision: quiz.revision, answers: [0] }),
    submitQuiz({ quizId: quiz._id, user: firstUser, submittedRevision: quiz.revision, answers: [0] }),
  ]);
  assert.equal(first.attemptNumber + second.attemptNumber, 3);
  await assert.rejects(submitQuiz({ quizId: quiz._id, user: firstUser, submittedRevision: quiz.revision, answers: [0] }), /No final quiz attempts/);
  await assert.rejects(submitQuiz({ quizId: quiz._id, user: secondUser, submittedRevision: quiz.revision, answers: [0] }).then(() => submitQuiz({ quizId: quiz._id, user: secondUser, submittedRevision: quiz.revision, answers: [0] })), /No final quiz attempts/);
  const concurrent = await Promise.allSettled([
    submitQuiz({ quizId: quiz._id, user: concurrentUser, submittedRevision: quiz.revision, answers: [0] }),
    submitQuiz({ quizId: quiz._id, user: concurrentUser, submittedRevision: quiz.revision, answers: [0] }),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);
  assert.equal(await QuizAttempt.countDocuments({ user: concurrentUser.id, quiz: quiz._id }), 1);
  assert.equal((await QuizAttempt.findOne({ user: concurrentUser.id, quiz: quiz._id }).lean()).correctAnswersRevealed, true);
  assert.equal(await QuizGoalAchievement.countDocuments({ user: firstUser.id, quiz: quiz._id }), 1);
  quiz.goalPercent = 100; await quiz.save();
  assert.equal(await QuizGoalAchievement.countDocuments({ user: firstUser.id, quiz: quiz._id }), 1);
});
