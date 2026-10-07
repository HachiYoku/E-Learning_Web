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
let mongo; let directory; let Quiz; let Course; let Lesson; let Enrollment; let QuizAttempt; let QuizAttemptGrant; let QuizAttemptRequest; let QuizGoalAchievement; let QuizSession; let QuizMedia; let Notification; let User;
let submitQuiz; let submitQuizRuntime; let startQuizSession; let studentQuizProjection; let studentQuizHistory; let courseFinalProgress; let quizController; let attemptRequestService; let cleanupQuizMedia;
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
  Quiz = require("../models/quizModel"); Course = require("../models/courseModel"); Lesson = require("../models/lessonModel"); Enrollment = require("../models/enrollmentModel"); QuizAttempt = require("../models/quizAttemptModel"); QuizAttemptGrant = require("../models/quizAttemptGrantModel"); QuizAttemptRequest = require("../models/quizAttemptRequestModel"); QuizGoalAchievement = require("../models/quizGoalAchievementModel"); QuizSession = require("../models/quizSessionModel"); QuizMedia = require("../models/quizMediaModel"); Notification = require("../models/notificationModel"); User = require("../models/userModel");
  ({ submitQuiz: submitQuizRuntime, studentQuizProjection, studentQuizHistory } = require("../services/quizRuntime"));
  ({ startQuizSession } = require("../services/quizSessionService"));
  ({ cleanupQuizMedia } = require("../services/quizMediaLifecycle"));
  submitQuiz = async (input) => {
    const started = await startQuizSession({ quizId: input.quizId, user: input.user });
    return submitQuizRuntime({ ...input, sessionId: started.sessionId });
  };
  ({ courseFinalProgress } = require("../services/courseFinalProgress"));
  attemptRequestService = require("../services/quizAttemptRequestService");
  quizController = require("../controllers/quizController");
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all([Quiz, QuizAttempt, QuizAttemptGrant, QuizAttemptRequest, QuizGoalAchievement, QuizSession, QuizMedia, Notification, User].map((Model) => Model.syncIndexes()));
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
  await assert.rejects(submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision - 1, answers: [0] }), /session/);
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
  assert.equal(history.attempts[0].snapshot.questions[0].prompt, "Question");
  assert.deepEqual(history.attempts[0].snapshot.questions[0].options, ["A", "B"]);
  assert.equal(history.attempts[0].snapshot.questions[0].image, "https://example.test/question.webp");
  assert.equal(history.attempts[0].snapshot.revision, 1);
  const other = { id: id() }; await Enrollment.create({ userId: other.id, courseId: course._id });
  assert.equal((await studentQuizHistory({ quizId: quiz._id, user: other })).attempts.length, 0);
});

test("Course Final submissions and history never reveal answers, including after exhaustion and a direct grant", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final" }); const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  assert.equal(quiz.maxAttempts, 3);
  const first = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] });
  assert.equal(first.attemptNumber, 1); assert.equal(first.review[0].isCorrect, true); assert.equal("correctAnswer" in first.review[0], false);
  assert.equal((await QuizAttempt.findOne({ quiz: quiz._id, user: user.id, attemptNumber: 1 }).lean()).submissionSnapshot.questions[0].correctAnswer, 0);
  const beforeReveal = await studentQuizHistory({ quizId: quiz._id, user });
  assert.equal("correctAnswer" in beforeReveal.attempts[0].review[0], false);
  assert.equal("correctAnswer" in beforeReveal.attempts[0].snapshot.questions[0], false);
  assert.equal(beforeReveal.attempts[0].snapshot.questions[0].prompt, "Question");
  const second = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [1] });
  assert.equal(second.attemptNumber, 2); assert.equal(second.review[0].isCorrect, false); assert.equal("correctAnswer" in second.review[0], false);
  const third = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] });
  assert.equal(third.attemptNumber, 3); assert.equal(third.maxAttempts, 3); assert.equal("correctAnswer" in third.review[0], false);
  assert.equal((await QuizAttempt.findOne({ quiz: quiz._id, user: user.id, attemptNumber: 3 }).lean()).correctAnswersRevealed, false);
  const afterReveal = await studentQuizHistory({ quizId: quiz._id, user });
  assert.equal(afterReveal.attempts.length, 3);
  assert.equal("correctAnswer" in afterReveal.attempts[0].review[0], false);
  assert.equal("correctAnswer" in afterReveal.attempts[0].snapshot.questions[0], false);
  assert.equal("explanation" in afterReveal.attempts[0].review[0], false);
  assert.equal(afterReveal.attempts[0].review[0].selectedAnswer, 0);
  assert.equal(afterReveal.attempts[0].review[0].isCorrect, true);
  await assert.rejects(submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] }), /No final quiz attempts/);
  await QuizAttemptGrant.create({ user: user.id, quiz: quiz._id, grantedBy: id() });
  const grantedSubmission = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] });
  assert.equal(grantedSubmission.attemptNumber, 4);
  assert.equal(grantedSubmission.maxAttempts, 4);
  assert.equal("correctAnswer" in grantedSubmission.review[0], false);
  assert.equal("correctAnswer" in (await studentQuizHistory({ quizId: quiz._id, user })).attempts[0].review[0], false);
  await assert.rejects(submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] }), /No final quiz attempts/);
});

test("unlimited Lesson Quiz rejects direct extra-attempt grants", async () => {
  const { quiz } = await setupQuiz();
  const response = responseRecorder();
  await quizController.grantQuizAttempt({ params: { quizId: String(quiz._id) }, body: { studentId: String(id()) }, user: { id: id() } }, response);
  assert.equal(response.statusCode, 404);
  assert.equal(await QuizAttemptGrant.countDocuments({ quiz: quiz._id }), 0);
});

test("Course Finals with explicit limits keep answers hidden even after the final submission", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 5 }); const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  for (let attemptNumber = 1; attemptNumber <= 4; attemptNumber += 1) {
    const submission = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] });
    assert.equal(submission.attemptNumber, attemptNumber);
    assert.equal("correctAnswer" in submission.review[0], false);
  }
  const fifth = await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] });
  assert.equal(fifth.attemptNumber, 5);
  assert.equal("correctAnswer" in fifth.review[0], false);
});

test("legacy correctAnswersRevealed state cannot expose Course Final answers", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 2 });
  const revealedUser = { id: id() }; const otherUser = { id: id() };
  await Enrollment.create([{ userId: revealedUser.id, courseId: course._id }, { userId: otherUser.id, courseId: course._id }]);
  await submitQuiz({ quizId: quiz._id, user: revealedUser, submittedRevision: quiz.revision, answers: [0] });
  await submitQuiz({ quizId: quiz._id, user: revealedUser, submittedRevision: quiz.revision, answers: [0] });
  // Emulate an already-stored legacy marker without weakening immutable model writes.
  await QuizAttempt.collection.updateOne({ quiz: quiz._id, user: revealedUser.id, attemptNumber: 2 }, { $set: { correctAnswersRevealed: true } });
  const revealedHistory = await studentQuizHistory({ quizId: quiz._id, user: revealedUser });
  assert.equal("correctAnswer" in revealedHistory.attempts[0].review[0], false);
  assert.equal("correctAnswer" in revealedHistory.attempts[1].review[0], false);
  const adminResponse = responseRecorder();
  await quizController.getQuizAttempts({ params: { quizId: String(quiz._id) } }, adminResponse);
  assert.equal(adminResponse.statusCode, 200);
  assert.equal(adminResponse.body.attempts[0].submissionSnapshot.questions[0].correctAnswer, 0);
  const otherSubmission = await submitQuiz({ quizId: quiz._id, user: otherUser, submittedRevision: quiz.revision, answers: [0] });
  assert.equal("correctAnswer" in otherSubmission.review[0], false);
  const otherHistory = await studentQuizHistory({ quizId: quiz._id, user: otherUser });
  assert.equal(otherHistory.attempts.length, 1);
  assert.equal("correctAnswer" in otherHistory.attempts[0].review[0], false);
});

test("published lesson quiz submissions unlock a course final dynamically and durably", async () => {
  const { course, lesson: firstLesson, quiz: firstLessonQuiz } = await setupQuiz();
  const secondLesson = await Lesson.create({ course: course._id, title: unique("Second lesson"), videoUrl: "https://www.youtube.com/watch?v=second", order: 2 });
  const thirdLesson = await Lesson.create({ course: course._id, title: unique("Third lesson"), videoUrl: "https://www.youtube.com/watch?v=third", order: 3 });
  const secondLessonQuiz = await Quiz.create({ course: course._id, lesson: secondLesson._id, contextType: "course_lesson", status: "published", title: unique("Second quiz"), questions: [question()] });
  const thirdLessonQuiz = await Quiz.create({ course: course._id, lesson: thirdLesson._id, contextType: "course_lesson", status: "published", title: unique("Third quiz"), questions: [question()] });
  const finalQuiz = await Quiz.create({ course: course._id, contextType: "course_final", status: "published", title: unique("Final"), questions: [question()] });
  const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  assert.deepEqual(await courseFinalProgress({ quiz: finalQuiz, userId: user.id }), { locked: true, unlocked: false, requiredCount: 3, completedCount: 0 });
  await assert.rejects(studentQuizProjection({ quiz: finalQuiz, user }), /unavailable/);
  await submitQuiz({ quizId: firstLessonQuiz._id, user, submittedRevision: firstLessonQuiz.revision, answers: [1] });
  assert.equal((await courseFinalProgress({ quiz: finalQuiz, userId: user.id })).completedCount, 1);
  await submitQuiz({ quizId: secondLessonQuiz._id, user, submittedRevision: secondLessonQuiz.revision, answers: [0] });
  assert.equal((await courseFinalProgress({ quiz: finalQuiz, userId: user.id })).completedCount, 2);
  await submitQuiz({ quizId: thirdLessonQuiz._id, user, submittedRevision: thirdLessonQuiz.revision, answers: [0] });
  assert.equal((await courseFinalProgress({ quiz: finalQuiz, userId: user.id })).unlocked, true);
  assert.equal((await studentQuizProjection({ quiz: finalQuiz, user })).title, finalQuiz.title);
  const laterLesson = await Lesson.create({ course: course._id, title: unique("Later lesson"), videoUrl: "https://www.youtube.com/watch?v=later", order: 4 });
  await Quiz.create({ course: course._id, lesson: laterLesson._id, contextType: "course_lesson", status: "published", title: unique("Later quiz"), questions: [question()] });
  const durable = await courseFinalProgress({ quiz: finalQuiz, userId: user.id });
  assert.equal(durable.unlocked, true); assert.equal(durable.requiredCount, 4); assert.equal(durable.completedCount, 3);
});

test("zero published lesson quizzes recover a course final unlock while non-published lessons do not block it", async () => {
  const { course, lesson } = await setupQuiz();
  const lessonQuiz = await Quiz.findOne({ lesson: lesson._id });
  lessonQuiz.status = "draft"; await lessonQuiz.save();
  const finalQuiz = await Quiz.create({ course: course._id, contextType: "course_final", status: "published", title: unique("Final"), questions: [question()] });
  const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  const first = await courseFinalProgress({ quiz: finalQuiz, userId: user.id });
  const second = await courseFinalProgress({ quiz: finalQuiz, userId: user.id });
  assert.equal(first.requiredCount, 0); assert.equal(first.unlocked, true); assert.equal(second.unlocked, true);
  assert.equal(await require("../models/quizUnlockModel").countDocuments({ quiz: finalQuiz._id, user: user.id }), 1);
});

test("admin grants add one final submission without changing history, goal, or base allowance", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 3, goalPercent: 50 });
  const student = await User.create({ name: unique("Student"), email: `${unique("student")}@example.test`, password: "password", role: "user" });
  const admin = { id: id(), role: "admin" };
  await Enrollment.create({ userId: student._id, courseId: course._id });
  const beforeGrant = await submitQuiz({ quizId: quiz._id, user: { id: student._id }, submittedRevision: quiz.revision, answers: [0] });
  assert.equal("correctAnswer" in beforeGrant.review[0], false);
  assert.equal("correctAnswer" in (await studentQuizHistory({ quizId: quiz._id, user: { id: student._id } })).attempts[0].review[0], false);
  const first = responseRecorder();
  await quizController.grantQuizAttempt({ params: { quizId: String(quiz._id) }, body: { studentId: String(student._id), reason: "Connection problem" }, user: admin }, first);
  assert.equal(first.statusCode, 201); assert.equal(first.body.baseMaxAttempts, 3); assert.equal(first.body.effectiveMaxAttempts, 4); assert.equal(first.body.timesTaken, 1);
  const second = responseRecorder();
  await quizController.grantQuizAttempt({ params: { quizId: String(quiz._id) }, body: { studentId: String(student._id) }, user: admin }, second);
  assert.equal(second.statusCode, 201); assert.equal(second.body.effectiveMaxAttempts, 5); assert.equal(second.body.timesTaken, 1);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id, user: student._id }), 1);
  assert.equal(await QuizAttemptGrant.countDocuments({ quiz: quiz._id, user: student._id }), 2);
  assert.equal((await Quiz.findById(quiz._id)).maxAttempts, 3);
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
  assert.equal((await QuizAttempt.findOne({ user: concurrentUser.id, quiz: quiz._id }).lean()).correctAnswersRevealed, false);
  assert.equal(await QuizGoalAchievement.countDocuments({ user: firstUser.id, quiz: quiz._id }), 1);
  quiz.goalPercent = 100; await quiz.save();
  assert.equal(await QuizGoalAchievement.countDocuments({ user: firstUser.id, quiz: quiz._id }), 1);
});

test("course-final extra submission requests require exhaustion, remain unique, and can be cancelled", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 2 });
  const student = { id: id() };
  await Enrollment.create({ userId: student.id, courseId: course._id });
  await assert.rejects(attemptRequestService.createRequest({ quizId: quiz._id, user: student, reason: "Please help" }), /only be requested/);
  await submitQuiz({ quizId: quiz._id, user: student, submittedRevision: quiz.revision, answers: [0] });
  await submitQuiz({ quizId: quiz._id, user: student, submittedRevision: quiz.revision, answers: [0] });
  await assert.rejects(attemptRequestService.createRequest({ quizId: quiz._id, user: student, reason: "   " }), /reason is required/i);
  const [first, duplicate] = await Promise.allSettled([
    attemptRequestService.createRequest({ quizId: quiz._id, user: student, reason: "Need one more chance" }),
    attemptRequestService.createRequest({ quizId: quiz._id, user: student, reason: "Second browser request" }),
  ]);
  assert.equal([first, duplicate].filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await QuizAttemptRequest.countDocuments({ user: student.id, quiz: quiz._id, status: "pending" }), 1);
  const request = await QuizAttemptRequest.findOne({ user: student.id, quiz: quiz._id });
  await attemptRequestService.cancelRequest({ quizId: quiz._id, requestId: request._id, user: student });
  assert.equal((await QuizAttemptRequest.findById(request._id)).status, "cancelled");
  assert.equal(await QuizAttemptGrant.countDocuments({ user: student.id, quiz: quiz._id }), 0);
  await assert.rejects(attemptRequestService.cancelRequest({ quizId: quiz._id, requestId: request._id, user: student }), /no longer be cancelled/);
});

test("approving an exhausted course-final request creates exactly one request-sourced grant and stale requests are superseded", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 1 });
  const student = await User.create({ name: unique("Student"), email: `${unique("student")}@example.test`, password: "password", role: "user" });
  const admin = id();
  await Enrollment.create({ userId: student._id, courseId: course._id });
  await submitQuiz({ quizId: quiz._id, user: { id: student._id }, submittedRevision: quiz.revision, answers: [0] });
  const created = await attemptRequestService.createRequest({ quizId: quiz._id, user: { id: student._id }, reason: "I need another learning attempt" });
  const approved = await attemptRequestService.reviewRequest({ quizId: quiz._id, requestId: created.request._id, adminId: admin, decision: "approved", note: "Approved" });
  assert.equal(approved.decision, "approved");
  assert.equal(approved.state.effectiveMaxAttempts, 2);
  const grant = await QuizAttemptGrant.findOne({ request: created.request._id }).lean();
  assert.equal(grant.source, "student_request");
  assert.equal((await QuizAttemptRequest.findById(created.request._id)).status, "approved");
  await assert.rejects(attemptRequestService.reviewRequest({ quizId: quiz._id, requestId: created.request._id, adminId: id(), decision: "approved" }), /already been reviewed/);
  const afterApproval = await submitQuiz({ quizId: quiz._id, user: { id: student._id }, submittedRevision: quiz.revision, answers: [0] });
  assert.equal("correctAnswer" in afterApproval.review[0], false);
  assert.equal("correctAnswer" in (await studentQuizHistory({ quizId: quiz._id, user: { id: student._id } })).attempts[0].review[0], false);
  const stale = await attemptRequestService.createRequest({ quizId: quiz._id, user: { id: student._id }, reason: "Another request" });
  await QuizAttemptGrant.create({ user: student._id, quiz: quiz._id, grantedBy: admin, source: "direct_admin" });
  const superseded = await attemptRequestService.reviewRequest({ quizId: quiz._id, requestId: stale.request._id, adminId: admin, decision: "approved" });
  assert.equal(superseded.decision, "superseded");
  assert.equal(await QuizAttemptGrant.countDocuments({ user: student._id, quiz: quiz._id }), 2);
});

test("request-review notifications use the authenticated Course Final route for approval and rejection", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 1 });
  const student = await User.create({ name: unique("Student"), email: `${unique("student")}@example.test`, password: "password", role: "user" });
  await Enrollment.create({ userId: student._id, courseId: course._id });
  await submitQuiz({ quizId: quiz._id, user: { id: student._id }, submittedRevision: quiz.revision, answers: [0] });
  const approvedRequest = await attemptRequestService.createRequest({ quizId: quiz._id, user: { id: student._id }, reason: "One more try" });
  const approvedResponse = responseRecorder();
  await quizController.reviewStudentAttemptRequest({ params: { quizId: String(quiz._id), requestId: String(approvedRequest.request._id) }, body: { decision: "approved", note: "Okay" }, user: { id: id(), role: "admin" } }, approvedResponse);
  assert.equal(approvedResponse.statusCode, 200);
  assert.equal((await Notification.findOne({ title: "Extra quiz submission approved" }).lean()).link, `/app/course-quiz/${course._id}/${quiz._id}`);
  await submitQuiz({ quizId: quiz._id, user: { id: student._id }, submittedRevision: quiz.revision, answers: [0] });
  const rejectedRequest = await attemptRequestService.createRequest({ quizId: quiz._id, user: { id: student._id }, reason: "Please review again" });
  const rejectedResponse = responseRecorder();
  await quizController.reviewStudentAttemptRequest({ params: { quizId: String(quiz._id), requestId: String(rejectedRequest.request._id) }, body: { decision: "rejected", note: "Complete the practice first." }, user: { id: id(), role: "admin" } }, rejectedResponse);
  assert.equal(rejectedResponse.statusCode, 200);
  assert.equal((await Notification.findOne({ title: "Extra quiz submission request declined" }).lean()).link, `/app/course-quiz/${course._id}/${quiz._id}`);
});

test("a server-started session preserves its revision for ordinary edits and cannot be forged", async () => {
  const { course, quiz } = await setupQuiz();
  const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  const started = await startQuizSession({ quizId: quiz._id, user });
  assert.equal(started.questions[0].prompt, "Question");
  assert.equal("correctAnswer" in started.questions[0], false);
  assert.equal("imagePublicId" in started.questions[0], false);
  const beforeEditRevision = quiz.revision;
  quiz.questions[0].prompt = "Updated wording";
  await quiz.save();
  assert.equal(quiz.revision, beforeEditRevision + 1);
  const newer = await startQuizSession({ quizId: quiz._id, user });
  assert.equal(newer.revision, beforeEditRevision + 1);
  assert.equal(newer.questions[0].prompt, "Updated wording");

  const accepted = await submitQuizRuntime({ quizId: quiz._id, user, sessionId: started.sessionId, submittedRevision: beforeEditRevision, answers: [0] });
  assert.equal(accepted.score, 1);
  const stored = await QuizAttempt.findById(accepted.attemptId).lean();
  assert.equal(stored.submissionSnapshot.questions[0].prompt, "Question");
  await assert.rejects(
    submitQuizRuntime({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [0] }),
    /unavailable/i
  );
});

test("normal controller start and submission use the same live session after an earlier quiz revision", async () => {
  const { course, quiz } = await setupQuiz();
  const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  quiz.questions[0].prompt = "Earlier edit";
  await quiz.save();
  const started = responseRecorder();
  await quizController.startStudentQuizSession({ params: { quizId: quiz._id }, user }, started);
  assert.equal(started.statusCode, 201);
  assert.ok(started.body.sessionId);
  assert.equal(started.body.revision, quiz.revision);
  const submitted = responseRecorder();
  await quizController.submitQuiz({ params: { quizId: quiz._id }, user, body: { sessionId: started.body.sessionId, revision: started.body.revision, answers: [0] } }, submitted);
  assert.equal(submitted.statusCode, 200);
  assert.equal(submitted.body.score, 1);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id, user: user.id }), 1);
});

test("ordinary question-save wording changes preserve an existing controller session", async () => {
  const { course, quiz } = await setupQuiz();
  const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  const started = responseRecorder();
  await quizController.startStudentQuizSession({ params: { quizId: quiz._id }, user }, started);
  const edited = responseRecorder();
  await quizController.updateQuizQuestion({ params: { quizId: quiz._id, questionId: quiz.questions[0]._id }, body: { question: { ...quiz.questions[0].toObject(), prompt: "New wording" } }, files: [] }, edited);
  assert.equal(edited.statusCode, 200);
  assert.equal((await QuizSession.findById(started.body.sessionId)).invalidatedAt, null);
  const submitted = responseRecorder();
  await quizController.submitQuiz({ params: { quizId: quiz._id }, user, body: { sessionId: started.body.sessionId, revision: started.body.revision, answers: [0] } }, submitted);
  assert.equal(submitted.statusCode, 200);
  const attempt = await QuizAttempt.findById(submitted.body.attemptId).lean();
  assert.equal(attempt.submissionSnapshot.questions[0].prompt, "Question");
  const newer = await startQuizSession({ quizId: quiz._id, user });
  assert.equal(newer.questions[0].prompt, "New wording");
  assert.equal(newer.revision, edited.body.revision);
});

test("confirmed scoring edits produce a recoverable session error without consuming a Final attempt", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 1 });
  const user = { id: id() }; await Enrollment.create({ userId: user.id, courseId: course._id });
  const startResponse = responseRecorder();
  await quizController.startStudentQuizSession({ params: { quizId: quiz._id }, user }, startResponse);
  assert.equal(startResponse.statusCode, 201);
  const started = startResponse.body;
  const req = { params: { quizId: quiz._id, questionId: quiz.questions[0]._id }, body: { question: { ...quiz.questions[0].toObject(), correctAnswer: 1 } }, files: [] };
  const confirmation = responseRecorder(); await quizController.updateQuizQuestion(req, confirmation);
  assert.equal(confirmation.body.code, "active_sessions_require_confirmation");
  req.body.confirmScoringChange = "true";
  const saved = responseRecorder(); await quizController.updateQuizQuestion(req, saved);
  assert.equal(saved.statusCode, 200);
  const rejected = responseRecorder();
  await quizController.submitQuiz({ params: { quizId: quiz._id }, user, body: { sessionId: started.sessionId, revision: started.revision, answers: [0] } }, rejected);
  assert.equal(rejected.statusCode, 409);
  assert.equal(rejected.body.code, "quiz_session_invalidated");
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 0);
  const restarted = await startQuizSession({ quizId: quiz._id, user });
  const accepted = await submitQuizRuntime({ quizId: quiz._id, user, submittedRevision: restarted.revision, sessionId: restarted.sessionId, answers: [1] });
  assert.equal(accepted.score, 1); assert.equal(accepted.attemptNumber, 1);
});

test("the server rejects expired, forged and other-student sessions without consuming an attempt", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 1 });
  const user = { id: id() }; const other = { id: id() };
  await Enrollment.create([{ userId: user.id, courseId: course._id }, { userId: other.id, courseId: course._id }]);
  const started = await startQuizSession({ quizId: quiz._id, user });
  const stored = await QuizSession.findById(started.sessionId).lean();
  assert.equal(stored.expiresAt - stored.startedAt, 24 * 60 * 60 * 1000);
  const input = { quizId: quiz._id, user, submittedRevision: started.revision, answers: [0] };
  for (const forged of ["invalid", String(id()), undefined]) await assert.rejects(submitQuizRuntime({ ...input, sessionId: forged }), /unavailable/);
  await assert.rejects(submitQuizRuntime({ ...input, user: other, sessionId: started.sessionId }), /unavailable/);
  // A raw update is used only in this disposable test DB to simulate time.
  await QuizSession.collection.updateOne({ _id: stored._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await assert.rejects(submitQuizRuntime({ ...input, sessionId: started.sessionId }), (error) => error.code === "quiz_session_expired");
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 0);
});

test("ordinary media edits retain active-session assets until the snapshot becomes history", async (t) => {
  const cloudinary = require("../config/cloudinary");
  const { registerQuizMedia, reconcileReplacedQuizMedia } = require("../services/quizMediaLifecycle");
  const { course, quiz } = await setupQuiz();
  const user = { id: id() }; await Enrollment.create({ userId: user.id, courseId: course._id });
  quiz.questions[0].imagePublicId = `arun_thai/quiz_media/images/${unique("active")}`;
  await quiz.save(); await registerQuizMedia(quiz);
  const previous = quiz.toObject();
  const started = await startQuizSession({ quizId: quiz._id, user });
  quiz.questions[0].image = ""; quiz.questions[0].imagePublicId = "";
  await quiz.save();
  const destroy = t.mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));
  await reconcileReplacedQuizMedia(previous, quiz);
  assert.equal(destroy.mock.calls.length, 0);
  const record = await QuizMedia.findOne({ publicId: previous.questions[0].imagePublicId });
  assert.equal(record.cleanupState, "pending_cleanup");
  await submitQuizRuntime({ quizId: quiz._id, user, submittedRevision: started.revision, sessionId: started.sessionId, answers: [0] });
  assert.equal(await cleanupQuizMedia(record), false);
  assert.equal(destroy.mock.calls.length, 0);
});

test("disabled and archived quizzes reject active sessions without consuming an attempt", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 1 });
  const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  const started = await startQuizSession({ quizId: quiz._id, user });
  quiz.status = "disabled";
  await quiz.save();
  await assert.rejects(
    submitQuizRuntime({ quizId: quiz._id, user, sessionId: started.sessionId, submittedRevision: started.revision, answers: [0] }),
    /unavailable/i
  );
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id, user: user.id }), 0);
});

test("Admin availability lifecycle disables a published Final without losing history or consuming an active attempt", async () => {
  const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 3 });
  const user = { id: id() };
  await Enrollment.create({ userId: user.id, courseId: course._id });
  await submitQuiz({ quizId: quiz._id, user, submittedRevision: quiz.revision, answers: [1] });
  const originalAttempt = await QuizAttempt.findOne({ quiz: quiz._id, user: user.id }).lean();
  const started = await startQuizSession({ quizId: quiz._id, user });
  const disabled = responseRecorder();
  await quizController.changeQuizAvailability({ params: { quizId: String(quiz._id) }, body: { status: "disabled" } }, disabled);
  assert.equal(disabled.statusCode, 200);
  assert.equal(disabled.body.quiz.status, "disabled");
  assert.ok((await QuizSession.findById(started.sessionId)).invalidatedAt);
  await assert.rejects(startQuizSession({ quizId: quiz._id, user }), /unavailable/i);
  await assert.rejects(submitQuizRuntime({ quizId: quiz._id, user, sessionId: started.sessionId, submittedRevision: started.revision, answers: [0] }), /unavailable/i);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id, user: user.id }), 1);
  assert.deepEqual((await QuizAttempt.findById(originalAttempt._id).lean()).submissionSnapshot, originalAttempt.submissionSnapshot);

  const published = responseRecorder();
  await quizController.changeQuizAvailability({ params: { quizId: String(quiz._id) }, body: { status: "published" } }, published);
  assert.equal(published.statusCode, 200);
  assert.equal(published.body.quiz.status, "published");
  assert.ok((await startQuizSession({ quizId: quiz._id, user })).sessionId);
  const invalid = responseRecorder();
  await quizController.changeQuizAvailability({ params: { quizId: String(quiz._id) }, body: { status: "published" } }, invalid);
  assert.equal(invalid.statusCode, 409);
});

test("Draft may publish, while Archived cannot bypass Restore to Disabled", async () => {
  const { quiz } = await setupQuiz();
  quiz.status = "draft"; await quiz.save();
  const published = responseRecorder();
  await quizController.changeQuizAvailability({ params: { quizId: String(quiz._id) }, body: { status: "published" } }, published);
  assert.equal(published.statusCode, 200);
  quiz.status = "archived"; await quiz.save();
  const invalid = responseRecorder();
  await quizController.changeQuizAvailability({ params: { quizId: String(quiz._id) }, body: { status: "published" } }, invalid);
  assert.equal(invalid.statusCode, 409);
  const restored = responseRecorder();
  await quizController.restoreQuiz({ params: { quizId: String(quiz._id) } }, restored);
  assert.equal(restored.statusCode, 200);
  assert.equal(restored.body.quiz.status, "disabled");
});

test("historical attempt media is never physically deleted while unreferenced owned media is cleaned up", async () => {
  const { quiz } = await setupQuiz();
  const historicalPublicId = `arun_thai/quiz_media/images/${unique("historic")}`;
  const unusedPublicId = `arun_thai/quiz_media/audio/${unique("unused")}`;
  const historicMedia = await QuizMedia.create({ quiz: quiz._id, questionId: quiz.questions[0]._id, mediaType: "image", publicId: historicalPublicId, resourceType: "image", url: "https://res.cloudinary.com/example/image/upload/historic.webp", format: "webp" });
  const unusedMedia = await QuizMedia.create({ quiz: quiz._id, questionId: quiz.questions[0]._id, mediaType: "audio", publicId: unusedPublicId, resourceType: "video", url: "https://res.cloudinary.com/example/video/upload/unused.mp3", format: "mp3" });
  await QuizAttempt.create({
    quiz: quiz._id,
    user: id(),
    attemptNumber: 1,
    answers: [0],
    score: 1,
    total: 1,
    submissionSnapshot: {
      questions: [{ questionId: quiz.questions[0]._id, prompt: "Historic question", image: { url: historicMedia.url, publicId: historicalPublicId, resourceType: "image", format: "webp" }, options: ["A", "B"], selectedAnswer: 0, correctAnswer: 0, isCorrect: true }],
    },
  });

  const cloudinary = require("../config/cloudinary");
  const originalDestroy = cloudinary.uploader.destroy;
  const destroyed = [];
  cloudinary.uploader.destroy = async (publicId, options) => { destroyed.push({ publicId, options }); return { result: "ok" }; };
  try {
    assert.equal(await cleanupQuizMedia(historicMedia), false);
    assert.deepEqual(destroyed, []);
    assert.equal((await QuizMedia.findById(historicMedia._id)).cleanupState, "active");

    assert.equal(await cleanupQuizMedia(unusedMedia), true);
    assert.deepEqual(destroyed, [{ publicId: unusedPublicId, options: { resource_type: "video", type: "upload", invalidate: true } }]);
    assert.equal((await QuizMedia.findById(unusedMedia._id)).cleanupState, "deleted");
  } finally {
    cloudinary.uploader.destroy = originalDestroy;
  }
});

test("quiz deletion preserves history, archives safely, and only cleans history-free owned media", async () => {
  const { quiz: disposableQuiz } = await setupQuiz();
  const disposableMedia = await QuizMedia.create({ quiz: disposableQuiz._id, questionId: disposableQuiz.questions[0]._id, mediaType: "image", publicId: `arun_thai/quiz_media/images/${unique("disposable")}`, resourceType: "image", url: "https://res.cloudinary.com/example/image/upload/disposable.webp", format: "webp" });
  const cloudinary = require("../config/cloudinary");
  const originalDestroy = cloudinary.uploader.destroy;
  const destroyed = [];
  cloudinary.uploader.destroy = async (publicId) => { destroyed.push(publicId); return { result: "ok" }; };
  try {
    const deleted = responseRecorder();
    await quizController.deleteQuiz({ params: { quizId: String(disposableQuiz._id) } }, deleted);
    assert.equal(deleted.statusCode, 200);
    assert.equal(await Quiz.findById(disposableQuiz._id), null);
    assert.deepEqual(destroyed, [disposableMedia.publicId]);
    assert.equal((await QuizMedia.findById(disposableMedia._id)).cleanupState, "deleted");

    const { course, quiz } = await setupQuiz({ contextType: "course_final", maxAttempts: 1 });
    const student = { id: id() };
    await Enrollment.create({ userId: student.id, courseId: course._id });
    const historicMedia = await QuizMedia.create({ quiz: quiz._id, questionId: quiz.questions[0]._id, mediaType: "image", publicId: `arun_thai/quiz_media/images/${unique("archive")}`, resourceType: "image", url: "https://res.cloudinary.com/example/image/upload/archive.webp", format: "webp" });
    await QuizAttempt.create({ quiz: quiz._id, user: student.id, attemptNumber: 1, answers: [0], score: 1, total: 1, submissionSnapshot: { questions: [{ questionId: quiz.questions[0]._id, prompt: "Historic", image: { url: historicMedia.url, publicId: historicMedia.publicId, resourceType: "image", format: "webp" }, options: ["A", "B"], selectedAnswer: 0, correctAnswer: 0, isCorrect: true }] } });
    const started = await startQuizSession({ quizId: quiz._id, user: student });
    const refused = responseRecorder();
    await quizController.deleteQuiz({ params: { quizId: String(quiz._id) } }, refused);
    assert.equal(refused.statusCode, 409);
    assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 1);
    assert.ok(await Quiz.findById(quiz._id));
    assert.deepEqual(destroyed, [disposableMedia.publicId]);

    const archived = responseRecorder();
    await quizController.archiveQuiz({ params: { quizId: String(quiz._id) } }, archived);
    assert.equal(archived.statusCode, 200);
    assert.equal((await Quiz.findById(quiz._id)).status, "archived");
    const listed = responseRecorder();
    await quizController.getAdminQuizzes({}, listed);
    assert.equal(listed.statusCode, 200);
    assert.ok(listed.body.some((item) => String(item._id) === String(quiz._id) && item.status === "archived"));
    assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 1);
    assert.equal((await QuizMedia.findById(historicMedia._id)).cleanupState, "active");
    await assert.rejects(startQuizSession({ quizId: quiz._id, user: student }), /unavailable/i);
    await assert.rejects(submitQuizRuntime({ quizId: quiz._id, user: student, sessionId: started.sessionId, submittedRevision: started.revision, answers: [0] }), /unavailable/i);
    assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 1);
    const restored = responseRecorder();
    const archivedRevision = (await Quiz.findById(quiz._id)).revision;
    await quizController.restoreQuiz({ params: { quizId: String(quiz._id) } }, restored);
    assert.equal(restored.statusCode, 200);
    assert.equal((await Quiz.findById(quiz._id)).status, "disabled");
    assert.equal((await Quiz.findById(quiz._id)).revision, archivedRevision + 1);
    assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 1);
    assert.equal((await QuizMedia.findById(historicMedia._id)).cleanupState, "active");
    await assert.rejects(startQuizSession({ quizId: quiz._id, user: student }), /unavailable/i);
    const invalidRestore = responseRecorder();
    await quizController.restoreQuiz({ params: { quizId: String(quiz._id) } }, invalidRestore);
    assert.equal(invalidRestore.statusCode, 409);
  } finally {
    cloudinary.uploader.destroy = originalDestroy;
  }
});

test("failed physical media cleanup is retained as a recoverable lifecycle record", async () => {
  const { quiz } = await setupQuiz();
  const media = await QuizMedia.create({ quiz: quiz._id, questionId: quiz.questions[0]._id, mediaType: "image", publicId: `arun_thai/quiz_media/images/${unique("cleanup-failure")}`, resourceType: "image", url: "https://res.cloudinary.com/example/image/upload/cleanup-failure.webp", format: "webp" });
  const cloudinary = require("../config/cloudinary");
  const originalDestroy = cloudinary.uploader.destroy;
  cloudinary.uploader.destroy = async () => { throw new Error("temporary provider failure"); };
  try {
    assert.equal(await cleanupQuizMedia(media), false);
    const retained = await QuizMedia.findById(media._id).lean();
    assert.equal(retained.cleanupState, "cleanup_failed");
    assert.equal(retained.cleanupError, "Error");
  } finally {
    cloudinary.uploader.destroy = originalDestroy;
  }
});
