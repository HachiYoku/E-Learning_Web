const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");

const backendDirectory = path.resolve(__dirname, "..");
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close((error) => (error ? reject(error) : resolve(port)));
  });
});
const stop = (child) => new Promise((resolve) => {
  if (!child || child.exitCode !== null) return resolve();
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  child.once("exit", () => { clearTimeout(timer); resolve(); });
  child.kill("SIGTERM");
});

let mongo; let directory;
let Quiz; let Course; let Lesson; let HomeworkSet; let HomeworkSetAssignment;
let QuizAttempt; let QuizUnlock; let QuizAttemptGrant; let QuizGoalAchievement;
let buildQuizSubmissionSnapshot; let hasQuizHistoryFor; let quizController;
let sequence = 0;
const id = () => new mongoose.Types.ObjectId();
const unique = (value) => `${value}-${++sequence}`;
const question = (overrides = {}) => ({ prompt: "What is this?", options: ["A", "B"], correctAnswer: 0, ...overrides });
const legacyControllerQuestion = (overrides = {}) => ({
  ...question({ image: "https://res.cloudinary.com/example/image/upload/legacy.webp" }),
  ...overrides,
});
const responseRecorder = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

async function courseAndLesson() {
  const course = await Course.create({ title: unique("Course"), createdBy: id() });
  const lesson = await Lesson.create({ course: course._id, title: unique("Lesson"), videoUrl: "https://www.youtube.com/watch?v=test", order: 1 });
  return { course, lesson };
}

before(async () => {
  const port = await freePort();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-quiz-foundation-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => {
      if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); }
    });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/quiz_foundation?replicaSet=paymentTests`);
  Quiz = require("../models/quizModel"); Course = require("../models/courseModel"); Lesson = require("../models/lessonModel");
  HomeworkSet = require("../models/homeworkSetModel"); HomeworkSetAssignment = require("../models/homeworkSetAssignmentModel");
  QuizAttempt = require("../models/quizAttemptModel"); QuizUnlock = require("../models/quizUnlockModel");
  QuizAttemptGrant = require("../models/quizAttemptGrantModel"); QuizGoalAchievement = require("../models/quizGoalAchievementModel");
  ({ buildQuizSubmissionSnapshot } = require("../services/quizSubmissionSnapshot"));
  ({ hasQuizHistoryFor } = require("../services/quizHistory"));
  quizController = require("../controllers/quizController");
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all([Quiz, HomeworkSet, HomeworkSetAssignment, QuizAttempt, QuizUnlock, QuizAttemptGrant, QuizGoalAchievement].map((Model) => Model.syncIndexes()));
});

after(async () => {
  await mongoose.disconnect();
  await stop(mongo);
  if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test("Quiz context validation supports valid contexts and rejects mixed ownership", async () => {
  const { course, lesson } = await courseAndLesson();
  const homeworkSet = await HomeworkSet.create({ title: unique("Homework"), createdBy: id(), updatedBy: id() });

  await Quiz.create({ course: course._id, lesson: lesson._id, contextType: "course_lesson", title: unique("Lesson quiz"), questions: [question()] });
  const courseFinal = await Quiz.create({ course: course._id, contextType: "course_final", title: unique("Course final"), goalPercent: 80, questions: [question()] });
  await Quiz.create({ homeworkSet: homeworkSet._id, contextType: "homework_lesson", sortOrder: 1, title: unique("Homework lesson"), questions: [question()] });
  const homeworkFinal = await Quiz.create({ homeworkSet: homeworkSet._id, contextType: "homework_final", title: unique("Homework final"), goalPercent: 70, questions: [question()] });
  await Quiz.create({ contextType: "standalone", standaloneAccess: "public", title: unique("Practice"), questions: [question()] });

  assert.equal(courseFinal.maxAttempts, 3);
  assert.equal(homeworkFinal.maxAttempts, 3);

  await assert.rejects(Quiz.create({ contextType: "course_lesson", title: unique("Invalid lesson"), questions: [question()] }), /requires a course|requires a lesson/);
  await assert.rejects(Quiz.create({ course: course._id, lesson: lesson._id, contextType: "course_final", title: unique("Invalid final"), questions: [question()] }), /cannot belong to a lesson/);
  await assert.rejects(Quiz.create({ course: course._id, homeworkSet: homeworkSet._id, contextType: "homework_lesson", title: unique("Mixed"), questions: [question()] }), /cannot belong to a course/);
});

test("course lesson ownership is validated against the referenced course", async () => {
  const first = await courseAndLesson();
  const second = await courseAndLesson();
  await assert.rejects(
    Quiz.create({ course: first.course._id, lesson: second.lesson._id, contextType: "course_lesson", title: unique("Mismatch"), questions: [question()] }),
    /Lesson must belong to the quiz course/
  );
});

test("Quiz context indexes enforce one lesson/final quiz while allowing multiple homework lessons", async () => {
  const { course, lesson } = await courseAndLesson();
  const homeworkSet = await HomeworkSet.create({ title: unique("Homework"), createdBy: id(), updatedBy: id() });
  await Quiz.create({ course: course._id, lesson: lesson._id, contextType: "course_lesson", title: unique("One lesson"), questions: [question()] });
  await assert.rejects(Quiz.create({ course: course._id, lesson: lesson._id, contextType: "course_lesson", title: unique("Two lesson"), questions: [question()] }), /duplicate key/);
  await Quiz.create({ course: course._id, contextType: "course_final", title: unique("One final"), questions: [question()] });
  await assert.rejects(Quiz.create({ course: course._id, contextType: "course_final", title: unique("Two final"), questions: [question()] }), /duplicate key/);
  await Quiz.create({ homeworkSet: homeworkSet._id, contextType: "homework_final", title: unique("Homework final"), questions: [question()] });
  await assert.rejects(Quiz.create({ homeworkSet: homeworkSet._id, contextType: "homework_final", title: unique("Homework final two"), questions: [question()] }), /duplicate key/);
  await Quiz.create({ homeworkSet: homeworkSet._id, contextType: "homework_lesson", sortOrder: 1, title: unique("First homework lesson"), questions: [question()] });
  await Quiz.create({ homeworkSet: homeworkSet._id, contextType: "homework_lesson", sortOrder: 2, title: unique("Second homework lesson"), questions: [question()] });
});

test("questions accept text, image, audio, and combinations but not empty media", async () => {
  const values = [
    question({ prompt: "Text" }),
    question({ prompt: "", image: "https://res.cloudinary.com/example/image/upload/image.webp" }),
    question({ prompt: "", audio: "https://res.cloudinary.com/example/video/upload/audio.mp3", audioResourceType: "video", audioFormat: "mp3" }),
    question({ prompt: "Text", image: "https://res.cloudinary.com/example/image/upload/image.webp", audio: "https://res.cloudinary.com/example/video/upload/audio.mp3" }),
  ];
  for (const item of values) {
    await Quiz.create({ contextType: "standalone", standaloneAccess: "students", title: unique("Question type"), questions: [item] });
  }
  await assert.rejects(Quiz.create({ contextType: "standalone", standaloneAccess: "students", title: unique("Empty"), questions: [question({ prompt: "" })] }), /Each question needs text, an image, or audio/);
});

test("non-final quizzes clear attempt/goal settings, while revision changes on scoring content edits", async () => {
  const { course, lesson } = await courseAndLesson();
  const quiz = await Quiz.create({ course: course._id, lesson: lesson._id, contextType: "course_lesson", title: unique("Unlimited"), maxAttempts: 4, goalPercent: 85, questions: [question()] });
  assert.equal(quiz.maxAttempts, null); assert.equal(quiz.goalPercent, null); assert.equal(quiz.revision, 1); assert.equal(quiz.status, "draft");
  quiz.questions[0].prompt = "Changed";
  await quiz.save();
  assert.equal(quiz.revision, 2);
  quiz.questions[0].prompt = "Changed again";
  quiz.markScoringChange();
  await quiz.save();
  assert.equal(quiz.revision, 3);
});

test("assignment, unlock, grant, and durable goal records preserve per-student state", async () => {
  const homeworkSet = await HomeworkSet.create({ title: unique("Homework"), createdBy: id(), updatedBy: id() });
  const user = id(); const quiz = id();
  const assignment = await HomeworkSetAssignment.create({ homeworkSet: homeworkSet._id, user });
  assignment.markRemoved(new Date("2026-01-01")); await assignment.save();
  assignment.assign(new Date("2026-01-02")); await assignment.save();
  assert.equal(assignment.state, "active"); assert.equal(assignment.removedAt, null); assert.equal(assignment.lastAssignedAt.toISOString(), "2026-01-02T00:00:00.000Z");
  await assert.rejects(HomeworkSetAssignment.create({ homeworkSet: homeworkSet._id, user }), /duplicate key/);
  await QuizUnlock.create({ user, quiz });
  await assert.rejects(QuizUnlock.create({ user, quiz }), /duplicate key/);
  await QuizAttemptGrant.create({ user, quiz, grantedBy: id(), reason: "Reviewed request" });
  await QuizAttemptGrant.create({ user, quiz, grantedBy: id() });
  assert.equal(await QuizAttemptGrant.countDocuments({ user, quiz }), 2);
  await QuizGoalAchievement.create({ user, quiz, goalPercentAtAchievement: 70, scorePercentAtAchievement: 80 });
  await assert.rejects(QuizGoalAchievement.create({ user, quiz, goalPercentAtAchievement: 90, scorePercentAtAchievement: 90 }), /duplicate key/);
});

test("submission snapshots remain readable and immutable after the live quiz changes", async () => {
  const { course } = await courseAndLesson();
  const quiz = await Quiz.create({ course: course._id, contextType: "course_final", title: "Original title", questions: [question({ prompt: "Original question", options: ["A", "B"], correctAnswer: 1 })] });
  const snapshot = buildQuizSubmissionSnapshot({ quiz, answers: [1], course });
  const attempt = await QuizAttempt.create({ quiz: quiz._id, user: id(), attemptNumber: 1, answers: [1], score: 1, total: 1, submissionSnapshot: snapshot });
  quiz.title = "Edited title"; quiz.questions[0].prompt = "Edited question"; quiz.questions[0].options = ["C", "D"]; await quiz.save();
  attempt.submissionSnapshot.questions[0].prompt = "Tampered";
  await attempt.save();
  await assert.rejects(
    QuizAttempt.updateOne({ _id: attempt._id }, { $set: { "submissionSnapshot.questions.0.prompt": "Tampered by query" } }),
    /Quiz submissions are immutable/
  );
  const saved = await QuizAttempt.findById(attempt._id).lean();
  assert.equal(saved.submissionSnapshot.quizTitle, "Original title");
  assert.equal(saved.submissionSnapshot.questions[0].prompt, "Original question");
  assert.deepEqual(saved.submissionSnapshot.questions[0].options, ["A", "B"]);
  assert.equal(saved.submissionSnapshot.questions[0].selectedAnswer, 1);
  assert.equal(saved.submissionSnapshot.questions[0].correctAnswer, 1);
  assert.equal(saved.submissionSnapshot.questions[0].isCorrect, true);
});

test("legacy quiz fields infer a compatible context and legacy attempts remain readable", async () => {
  const { course, lesson } = await courseAndLesson();
  const quiz = await Quiz.create({ course: course._id, lesson: lesson._id, quizType: "lesson", title: unique("Legacy compatible"), questions: [question()] });
  assert.equal(quiz.contextType, "course_lesson");
  const attempt = await QuizAttempt.create({ quiz: quiz._id, user: id(), attemptNumber: 1, answers: [0], score: 1, total: 1 });
  assert.equal(attempt.submissionSnapshot, undefined);
  assert.deepEqual(attempt.answers, [0]);
});

test("legacy Quiz controller create and update paths retain valid inferred contexts", async () => {
  const { course, lesson } = await courseAndLesson();
  const lessonCreateResponse = responseRecorder();
  await quizController.createQuiz({
    body: {
      courseId: String(course._id),
      lessonId: String(lesson._id),
      title: unique("Legacy lesson controller"),
      quizType: "lesson",
      questions: [legacyControllerQuestion()],
    },
    files: [],
  }, lessonCreateResponse);
  assert.equal(lessonCreateResponse.statusCode, 201);
  assert.equal(lessonCreateResponse.body.contextType, "course_lesson");
  assert.equal(lessonCreateResponse.body.quizType, "lesson");
  assert.equal(lessonCreateResponse.body.maxAttempts, null);

  const courseCreateResponse = responseRecorder();
  await quizController.createQuiz({
    body: {
      courseId: String(course._id),
      title: unique("Legacy course controller"),
      quizType: "course",
      questions: [legacyControllerQuestion()],
    },
    files: [],
  }, courseCreateResponse);
  assert.equal(courseCreateResponse.statusCode, 201);
  assert.equal(courseCreateResponse.body.contextType, "course_final");
  assert.equal(courseCreateResponse.body.quizType, "course");
  assert.equal(courseCreateResponse.body.maxAttempts, 3);

  const explicit = await courseAndLesson();
  const explicitFinalResponse = responseRecorder();
  await quizController.createQuiz({
    body: {
      courseId: String(explicit.course._id),
      title: unique("Explicit final limit"),
      quizType: "course",
      maxAttempts: "5",
      questions: [legacyControllerQuestion()],
    },
    files: [],
  }, explicitFinalResponse);
  assert.equal(explicitFinalResponse.statusCode, 201);
  assert.equal(explicitFinalResponse.body.maxAttempts, 5);

  const duplicateResponse = responseRecorder();
  await quizController.createQuiz({
    body: {
      courseId: String(course._id),
      lessonId: String(lesson._id),
      title: unique("Duplicate legacy lesson"),
      quizType: "lesson",
      questions: [legacyControllerQuestion()],
    },
    files: [],
  }, duplicateResponse);
  assert.equal(duplicateResponse.statusCode, 400);
  assert.equal(duplicateResponse.body.message, "A quiz already exists for this lesson.");

  const originalRevision = lessonCreateResponse.body.revision;
  const updateResponse = responseRecorder();
  await quizController.updateQuiz({
    params: { quizId: lessonCreateResponse.body._id },
    body: {
      courseId: String(course._id),
      lessonId: String(lesson._id),
      title: "Updated legacy lesson controller",
      quizType: "lesson",
      questions: [legacyControllerQuestion({ prompt: "Updated scoring question" })],
    },
    files: [],
  }, updateResponse);
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.body.contextType, "course_lesson");
  assert.equal(updateResponse.body.quizType, "lesson");
  assert.equal(updateResponse.body.revision, originalRevision + 1);
});

test("history helper identifies course and lesson Quiz records with submissions", async () => {
  const { course, lesson } = await courseAndLesson();
  const quiz = await Quiz.create({ course: course._id, lesson: lesson._id, contextType: "course_lesson", title: unique("History"), questions: [question()] });
  assert.equal(await hasQuizHistoryFor({ courseId: course._id }), false);
  await QuizAttempt.create({ quiz: quiz._id, user: id(), attemptNumber: 1, answers: [0], score: 1, total: 1 });
  assert.equal(await hasQuizHistoryFor({ courseId: course._id }), true);
  assert.equal(await hasQuizHistoryFor({ lessonId: lesson._id }), true);
});

test("question-level saves isolate persisted questions and reject invalid updates without mutation", async () => {
  const { course, lesson } = await courseAndLesson();
  const quiz = await Quiz.create({ course: course._id, lesson: lesson._id, contextType: "course_lesson", title: unique("Question isolation"), questions: [question({ prompt: "A" }), question({ prompt: "B", options: ["C", "D"] })] });
  const saved = responseRecorder();
  await quizController.updateQuizQuestion({ params: { quizId: String(quiz._id), questionId: String(quiz.questions[0]._id) }, body: { question: { prompt: "A updated", image: "", audio: "", options: ["One", "Two"], correctAnswer: 1 } }, files: [] }, saved);
  assert.equal(saved.statusCode, 200);
  const afterSave = await Quiz.findById(quiz._id).lean();
  assert.equal(afterSave.questions[0].prompt, "A updated");
  assert.equal(afterSave.questions[1].prompt, "B");
  assert.deepEqual(afterSave.questions[1].options, ["C", "D"]);

  const failed = responseRecorder();
  await quizController.updateQuizQuestion({ params: { quizId: String(quiz._id), questionId: String(quiz.questions[0]._id) }, body: { question: { prompt: "Invalid", options: ["Only one"], correctAnswer: 0 } }, files: [] }, failed);
  assert.equal(failed.statusCode, 400);
  const afterFailure = await Quiz.findById(quiz._id).lean();
  assert.equal(afterFailure.questions[0].prompt, "A updated");
  assert.deepEqual(afterFailure.questions[0].options, ["One", "Two"]);
});

test("a new question is persisted only by its explicit save endpoint", async () => {
  const { course, lesson } = await courseAndLesson();
  const quiz = await Quiz.create({ course: course._id, lesson: lesson._id, status: "published", title: unique("Add question"), questions: [question({ prompt: "Existing" })] });
  assert.equal((await Quiz.findById(quiz._id)).questions.length, 1);
  const invalid = responseRecorder();
  await quizController.createQuizQuestion({ params: { quizId: quiz._id }, body: { question: question({ prompt: "", options: ["A", ""] }) }, files: [] }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal((await Quiz.findById(quiz._id)).questions.length, 1);
  const saved = responseRecorder();
  await quizController.createQuizQuestion({ params: { quizId: quiz._id }, body: { question: question({ _id: quiz.questions[0]._id, prompt: "Explicitly saved" }) }, files: [] }, saved);
  assert.equal(saved.statusCode, 201);
  const persisted = await Quiz.findById(quiz._id);
  assert.equal(persisted.questions.length, 2);
  assert.equal(persisted.questions[0].prompt, "Existing");
  assert.equal(persisted.questions[1].prompt, "Explicitly saved");
  assert.equal(String(saved.body.question._id), String(persisted.questions[1]._id));
  assert.notEqual(String(persisted.questions[0]._id), String(persisted.questions[1]._id));
});

test("question history confirmation is required before a meaningful persisted change", async () => {
  const { course, lesson } = await courseAndLesson();
  const quiz = await Quiz.create({ course: course._id, lesson: lesson._id, contextType: "course_lesson", title: unique("Question history"), questions: [question({ prompt: "Original" })] });
  await QuizAttempt.create({ quiz: quiz._id, user: id(), attemptNumber: 1, answers: [0], score: 1, total: 1, submissionSnapshot: { questions: [{ questionId: quiz.questions[0]._id, prompt: "Original", options: ["A", "B"], selectedAnswer: 0, correctAnswer: 0, isCorrect: true }] } });
  const refused = responseRecorder();
  await quizController.updateQuizQuestion({ params: { quizId: String(quiz._id), questionId: String(quiz.questions[0]._id) }, body: { question: { prompt: "Changed", options: ["A", "B"], correctAnswer: 0 } }, files: [] }, refused);
  assert.equal(refused.statusCode, 409);
  assert.equal(refused.body.code, "question_history_requires_confirmation");
  assert.equal((await Quiz.findById(quiz._id)).questions[0].prompt, "Original");
});

test("editing a question with empty answer slots preserves the selected answer and question identity after reload", async () => {
  const { course, lesson } = await courseAndLesson();
  const quiz = await Quiz.create({ course: course._id, lesson: lesson._id, title: "Edit regression", questions: [question(), question({ prompt: "Leave this alone" })] });
  const response = responseRecorder();
  await quizController.updateQuizQuestion({ params: { quizId: quiz._id, questionId: quiz.questions[0]._id }, body: { question: JSON.stringify({ ...quiz.questions[0].toObject(), prompt: "Changed", options: ["", "First", "", "Correct"], correctAnswer: 3 }) }, files: [] }, response);
  assert.equal(response.statusCode, 200);
  const persisted = await Quiz.findById(quiz._id).lean();
  assert.equal(String(persisted.questions[0]._id), String(quiz.questions[0]._id));
  assert.deepEqual(persisted.questions[0].options, ["First", "Correct"]);
  assert.equal(persisted.questions[0].correctAnswer, 1);
  assert.equal(persisted.questions[1].prompt, "Leave this alone");
});

for (const failingType of ["image", "audio"]) {
  test(`${failingType} upload failure preserves the persisted question and saved neighbour`, async (t) => {
    const { Writable } = require("node:stream");
    const cloudinary = require("../config/cloudinary");
    const { course, lesson } = await courseAndLesson();
    const quiz = await Quiz.create({ course: course._id, lesson: lesson._id, title: "Upload regression", questions: [question({ prompt: "Saved A" }), question({ prompt: "Original B", image: "https://example.test/old.jpg", audio: "https://example.test/old.mp3" })] });
    const before = await Quiz.findById(quiz._id).lean();
    t.mock.method(cloudinary.uploader, "upload_stream", (_options, callback) => new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) { done(); callback(new Error("private provider failure")); } }));
    const response = responseRecorder();
    await quizController.updateQuizQuestion({ params: { quizId: quiz._id, questionId: quiz.questions[1]._id }, body: { question: { ...quiz.questions[1].toObject(), prompt: "Unsaved B" } }, files: [{ fieldname: failingType === "image" ? "questionImage_0" : "questionAudio_0", buffer: Buffer.from("fixture") }] }, response);
    assert.equal(response.statusCode, 400);
    assert.doesNotMatch(response.body.message, /private provider/);
    assert.deepEqual(await Quiz.findById(quiz._id).lean(), before);
  });
}

for (const cleanupFails of [false, true]) {
  test(`persistence failure after upload ${cleanupFails ? "retains recoverable cleanup failure" : "cleans the newly owned asset"}`, async (t) => {
    const { Writable } = require("node:stream");
    const cloudinary = require("../config/cloudinary");
    const QuizMedia = require("../models/quizMediaModel");
    const { cleanupQuizMedia } = require("../services/quizMediaLifecycle");
    const { course, lesson } = await courseAndLesson();
    const quiz = await Quiz.create({ course: course._id, lesson: lesson._id, title: "Persistence regression", questions: [question()] });
    const before = await Quiz.findById(quiz._id).lean();
    const publicId = `arun_thai/quiz_media/images/${unique("new-upload")}`;
    t.mock.method(cloudinary.uploader, "upload_stream", (_options, callback) => new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) { done(); callback(null, { public_id: publicId, secure_url: "https://example.test/new.jpg", resource_type: "image" }); } }));
    const destroy = t.mock.method(cloudinary.uploader, "destroy", async () => { if (cleanupFails) throw new Error("provider unavailable"); return { result: "ok" }; });
    t.mock.method(Quiz.prototype, "save", async () => { throw new Error("simulated persistence error"); });
    const response = responseRecorder();
    await quizController.updateQuizQuestion({ params: { quizId: quiz._id, questionId: quiz.questions[0]._id }, body: { question: quiz.questions[0].toObject() }, files: [{ fieldname: "questionImage_0", buffer: Buffer.from("fixture") }] }, response);
    assert.equal(response.statusCode, 400);
    assert.deepEqual(await Quiz.findById(quiz._id).lean(), before);
    assert.equal(destroy.mock.calls.length, 1);
    const owned = await QuizMedia.findOne({ publicId });
    assert.equal(owned.cleanupState, cleanupFails ? "cleanup_failed" : "deleted");
    if (cleanupFails) {
      destroy.mock.mockImplementation(async () => ({ result: "ok" }));
      assert.equal(await cleanupQuizMedia(owned), true);
      assert.equal((await QuizMedia.findById(owned._id)).cleanupState, "deleted");
    }
  });
}

test("history and scoring confirmation precede replacement uploads, then confirmed scoring invalidates sessions", async (t) => {
  const { Writable } = require("node:stream");
  const cloudinary = require("../config/cloudinary");
  const QuizSession = require("../models/quizSessionModel");
  const { course, lesson } = await courseAndLesson();
  const quiz = await Quiz.create({ course: course._id, lesson: lesson._id, title: "Confirmed change", status: "published", questions: [question()] });
  const active = await QuizSession.create({ user: id(), quiz: quiz._id, revision: 1, contextType: "course_lesson", snapshot: {}, expiresAt: new Date(Date.now() + 86400000) });
  await QuizAttempt.create({ quiz: quiz._id, user: id(), attemptNumber: 1, answers: [0], score: 1, total: 1, submissionSnapshot: { questions: [{ questionId: quiz.questions[0]._id, selectedAnswer: 0, correctAnswer: 0, isCorrect: true }] } });
  const upload = t.mock.method(cloudinary.uploader, "upload_stream", (_options, callback) => new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) { done(); callback(null, { public_id: `arun_thai/quiz_media/images/${unique("confirmed")}`, secure_url: "https://example.test/new.jpg", resource_type: "image" }); } }));
  const req = { params: { quizId: quiz._id, questionId: quiz.questions[0]._id }, body: { question: { ...quiz.questions[0].toObject(), correctAnswer: 1 } }, files: [{ fieldname: "questionImage_0", buffer: Buffer.from("fixture") }] };
  const history = responseRecorder(); await quizController.updateQuizQuestion(req, history);
  assert.equal(history.body.code, "question_history_requires_confirmation"); assert.equal(upload.mock.calls.length, 0);
  req.body.confirmHistoryChange = "true";
  const scoring = responseRecorder(); await quizController.updateQuizQuestion(req, scoring);
  assert.equal(scoring.body.code, "active_sessions_require_confirmation"); assert.equal(upload.mock.calls.length, 0);
  req.body.confirmScoringChange = "true";
  const saved = responseRecorder(); await quizController.updateQuizQuestion(req, saved);
  assert.equal(saved.statusCode, 200); assert.equal(upload.mock.calls.length, 1);
  assert.ok((await QuizSession.findById(active._id)).invalidatedAt);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 1);
});
