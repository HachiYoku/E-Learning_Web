const assert = require("node:assert/strict");
const { before, beforeEach, after, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { Writable } = require("node:stream");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");

let processHandle; let directory; let Quiz; let QuizMedia; let QuizAttempt; let QuizSession; let oldMediaEnv; let oldCloudConfig;
let revisions; let controller; let oldController; let buildQuizSubmissionSnapshot;
const id = () => new mongoose.Types.ObjectId();
const question = (prompt = "First question") => ({ prompt, options: ["A", "B"], correctAnswer: 0, explanation: "Because A is correct." });
const draft = (title = "General Practice") => ({ title, description: "Practice description", category: "Vocabulary", difficulty: "Beginner", standaloneAccess: "students", questions: [question()] });
const response = () => ({ statusCode: 200, body: null, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });
const ownedImage = async (quiz, questionId) => {
  const recordId = id();
  const publicId = `arun_thai/testing/quiz_media/images/${recordId}`;
  const url = `https://res.cloudinary.com/du6lhdq8t/image/upload/${publicId}.webp`;
  const record = await QuizMedia.create({ _id: recordId, quiz: quiz._id, questionId, mediaType: "image",
    environment: "testing", publicId, resourceType: "image", url });
  return { record, fields: { image: url, imagePublicId: publicId } };
};
async function withReplacement(object, key, replacement, operation) {
  const original = object[key];
  object[key] = replacement;
  try { return await operation(); }
  finally { object[key] = original; }
}
function mockQuestionMedia(t, { failOn = 0 } = {}) {
  const cloudinary = require("../config/cloudinary");
  let count = 0;
  const upload = t.mock.method(cloudinary.uploader, "upload_stream", (options, callback) => new Writable({
    write(_chunk, _encoding, done) { done(); },
    final(done) {
      count += 1;
      if (count === failOn) { callback(new Error("simulated ambiguous upload")); done(); return; }
      const publicId = `${options.folder}/${options.public_id}`;
      callback(null, { public_id: publicId, resource_type: options.resource_type,
        secure_url: `https://res.cloudinary.com/du6lhdq8t/${options.resource_type}/upload/${publicId}.${options.resource_type === "image" ? "png" : "mp3"}`,
        format: options.resource_type === "image" ? "png" : "mp3" });
      done();
    },
  }));
  const destroy = t.mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));
  return { upload, destroy };
}

before(async () => {
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const selectedPort = server.address().port;
      server.close((error) => error ? reject(error) : resolve(selectedPort));
    });
  });
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-standalone-revisions-"));
  processHandle = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local mongod startup timed out")), 15000);
    processHandle.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    processHandle.once("error", reject);
  });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/quiz_package_one?replicaSet=paymentTests`);
  oldMediaEnv = Object.fromEntries(["QUIZ_QUESTION_MEDIA_ENV", "NODE_ENV", "MONGO_DB", "STANDALONE_QUIZ_EXPECTED_DB",
    "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_URL"]
    .map((key) => [key, process.env[key]]));
  Object.assign(process.env, { QUIZ_QUESTION_MEDIA_ENV: "testing", NODE_ENV: "test",
    MONGO_DB: "mongodb+srv://englishkafe.xhqpzdd.mongodb.net/english_kafe",
    STANDALONE_QUIZ_EXPECTED_DB: "english_kafe", CLOUDINARY_CLOUD_NAME: "du6lhdq8t",
    CLOUDINARY_API_KEY: "x", CLOUDINARY_API_SECRET: "x" });
  delete process.env.CLOUDINARY_URL;
  const cloudinary = require("../config/cloudinary");
  oldCloudConfig = cloudinary.config;
  cloudinary.config = () => ({ cloud_name: "du6lhdq8t" });
  Quiz = require("../models/quizModel");
  QuizMedia = require("../models/quizMediaModel");
  QuizAttempt = require("../models/quizAttemptModel");
  QuizSession = require("../models/quizSessionModel");
  revisions = { ...require("../services/standaloneQuizRevisions"),
    createDraft: require("./helpers/legacyStandaloneDraft") };
  controller = require("../controllers/standaloneQuizController");
  oldController = require("../controllers/quizController");
  ({ buildQuizSubmissionSnapshot } = require("../services/quizSubmissionSnapshot"));
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all([Quiz, QuizMedia, QuizAttempt, QuizSession].map((Model) => Model.syncIndexes()));
});

after(async () => {
  require("../config/cloudinary").config = oldCloudConfig;
  for (const [key, value] of Object.entries(oldMediaEnv || {})) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await mongoose.disconnect();
  if (processHandle && processHandle.exitCode === null) {
    await new Promise((resolve) => { processHandle.once("exit", resolve); processHandle.kill("SIGTERM"); });
  }
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

test("new standalone draft is valid, unpublished, and hidden from public responses", async () => {
  await assert.rejects(revisions.createDraft({ ...draft(), standaloneAccess: "public" }), /student access/);
  const quiz = await revisions.createDraft(draft());
  assert.equal(quiz.status, "draft");
  assert.equal(quiz.publishedRevision, null);
  assert.equal(quiz.questions.length, 0);
  assert.equal(quiz.draft.version, 1);
  const list = response();
  await controller.listPublished({}, list);
  assert.deepEqual(list.body, { quizzes: [] });
  const detail = response();
  await controller.getPublished({ params: { quizId: String(quiz._id) } }, detail);
  assert.equal(detail.statusCode, 404);
  await assert.rejects(revisions.createDraft({ ...draft(), category: "Other" }), /metadata and questions/);
});

test("published content remains isolated from draft edits and stale Admin writes conflict", async () => {
  const created = await revisions.createDraft(draft());
  const published = await revisions.publishDraft(created._id, 1);
  assert.equal(published.revision, 1);
  assert.equal(published.publishedRevision, 1);
  assert.equal(published.draft, undefined);
  const edited = await revisions.saveDraft(published._id, 0, { title: "Next edition", questions: [question("Revised question")] });
  assert.equal(edited.draft.version, 1);
  assert.equal(edited.title, "General Practice");
  assert.equal(edited.questions[0].prompt, "First question");
  assert.equal(edited.revision, 1);
  await assert.rejects(revisions.saveDraft(published._id, 0, { title: "Lost edit" }), /changed/);
  await assert.rejects(revisions.publishDraft(published._id, 2), /changed/);
  const promoted = await revisions.publishDraft(published._id, 1);
  assert.equal(promoted.title, "Next edition");
  assert.equal(promoted.questions[0].prompt, "Revised question");
  assert.equal(promoted.revision, 2);
  assert.equal(promoted.publishedRevision, 2);
  await assert.rejects(revisions.publishDraft(published._id, 1), /changed/);
});

test("concurrent draft edits and publications accept only one version", async () => {
  const quiz = await revisions.createDraft(draft());
  const edits = await Promise.allSettled([
    revisions.saveDraft(quiz._id, 1, { title: "Admin A" }),
    revisions.saveDraft(quiz._id, 1, { title: "Admin B" }),
  ]);
  assert.equal(edits.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(edits.filter((item) => item.status === "rejected").length, 1);
  const publications = await Promise.allSettled([
    revisions.publishDraft(quiz._id, 2),
    revisions.publishDraft(quiz._id, 2),
  ]);
  assert.equal(publications.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(publications.filter((item) => item.status === "rejected").length, 1);
  const published = await Quiz.findById(quiz._id);
  assert.ok(["Admin A", "Admin B"].includes(published.title));
  assert.equal(published.publishedRevision, 1);
});

test("disable and re-enable preserve published revision and unpublished draft; disabled cannot publish", async () => {
  const quiz = await revisions.createDraft(draft());
  await revisions.publishDraft(quiz._id, 1);
  await revisions.saveDraft(quiz._id, 0, { title: "Unpublished future" });
  const disabled = await revisions.changeAvailability(quiz._id, "disable");
  assert.equal(disabled.status, "disabled");
  assert.equal(disabled.title, "General Practice");
  assert.equal(disabled.draft.title, "Unpublished future");
  await assert.rejects(revisions.publishDraft(quiz._id, 1), /Re-enable/);
  const enabled = await revisions.changeAvailability(quiz._id, "enable");
  assert.equal(enabled.status, "published");
  assert.equal(enabled.title, "General Practice");
  assert.equal(enabled.revision, 1);
  assert.equal(enabled.draft.title, "Unpublished future");
  const archived = await revisions.changeAvailability(quiz._id, "archive");
  assert.equal(archived.status, "archived");
  await assert.rejects(revisions.publishDraft(quiz._id, 1), /Archived/);
});

test("restoring an archived draft keeps its content and still requires publication", async () => {
  const quiz = await revisions.createDraft(draft("Saved draft"));
  const original = quiz.draft.toObject();
  await revisions.changeAvailability(quiz._id, "archive");
  const restored = await revisions.changeAvailability(quiz._id, "restore");
  assert.equal(restored.status, "draft");
  assert.deepEqual(restored.draft.toObject(), original);
  assert.equal(restored.publishedRevision, null);
  assert.equal(restored.questions.length, 0);
  const hidden = response();
  await controller.listPublished({}, hidden);
  assert.deepEqual(hidden.body, { quizzes: [] });
  const published = await revisions.publishDraft(quiz._id, original.version);
  assert.equal(published.status, "published");
  assert.equal(published.title, "Saved draft");
});

test("restoring an archived published quiz creates an unpublished draft without changing history", async () => {
  const quiz = await revisions.createDraft(draft("Saved publication"));
  const published = await revisions.publishDraft(quiz._id, 1);
  const originalQuestion = published.questions[0].toObject();
  const attempt = await QuizAttempt.create({ quiz: quiz._id, user: id(), attemptNumber: 1,
    answers: [0], score: 1, total: 1 });
  await revisions.changeAvailability(quiz._id, "archive");
  const restored = await revisions.changeAvailability(quiz._id, "restore");
  assert.equal(restored.status, "draft");
  assert.equal(restored.publishedRevision, 1);
  assert.equal(restored.revision, published.revision);
  assert.deepEqual(restored.questions[0].toObject(), originalQuestion);
  assert.deepEqual(restored.draft.questions[0].toObject(), originalQuestion);
  assert.equal(restored.draft.version, 1);
  assert.equal(restored.draft.basePublishedRevision, 1);
  assert.ok(await QuizAttempt.findById(attempt._id));
  const hidden = response();
  await controller.getPublished({ params: { quizId: String(quiz._id) } }, hidden);
  assert.equal(hidden.statusCode, 404);
  const republished = await revisions.publishDraft(quiz._id, 1);
  assert.equal(republished.status, "published");
  assert.equal(republished.publishedRevision, 2);
  assert.ok(await QuizAttempt.findById(attempt._id));
});

test("restoring an archived quiz keeps its existing unpublished revision intact", async () => {
  const quiz = await revisions.createDraft(draft("Original publication"));
  const published = await revisions.publishDraft(quiz._id, 1);
  const edited = await revisions.saveDraft(quiz._id, 0, {
    title: "Pending edition", questions: [question("Pending question")],
  });
  const pending = edited.draft.toObject();
  await revisions.changeAvailability(quiz._id, "archive");
  const restored = await revisions.changeAvailability(quiz._id, "restore");
  assert.equal(restored.status, "draft");
  assert.deepEqual(restored.draft.toObject(), pending);
  assert.equal(restored.title, published.title);
  assert.equal(restored.publishedRevision, published.publishedRevision);
  assert.equal(restored.questions[0].prompt, published.questions[0].prompt);
});

test("restore rejects invalid states and permits only one concurrent transition", async () => {
  const quiz = await revisions.createDraft(draft());
  await assert.rejects(revisions.changeAvailability(quiz._id, "restore"),
    (error) => error.status === 409 && error.code === "invalid_quiz_state");
  await revisions.publishDraft(quiz._id, 1);
  await assert.rejects(revisions.changeAvailability(quiz._id, "restore"),
    (error) => error.status === 409 && error.code === "invalid_quiz_state");
  await revisions.changeAvailability(quiz._id, "archive");
  const outcomes = await Promise.allSettled([
    revisions.changeAvailability(quiz._id, "restore"),
    revisions.changeAvailability(quiz._id, "restore"),
  ]);
  assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(outcomes.find(({ status }) => status === "rejected").reason.status, 409);
  assert.equal((await Quiz.findById(quiz._id)).status, "draft");
  await assert.rejects(revisions.changeAvailability(id(), "restore"),
    (error) => error.status === 404 && error.code === "quiz_unavailable");
});

test("published summaries omit answers and include legacy Public records for authenticated routes", async () => {
  const publicQuiz = await revisions.createDraft(draft());
  await revisions.publishDraft(publicQuiz._id, 1);
  await Quiz.updateOne({ _id: publicQuiz._id }, { $set: { standaloneAccess: "public" } });
  const studentQuiz = await revisions.createDraft({ ...draft("Student practice"), standaloneAccess: "students" });
  await revisions.publishDraft(studentQuiz._id, 1);
  const authenticated = response();
  await controller.listPublished({ user: { id: id(), role: "user" } }, authenticated);
  assert.equal(authenticated.body.quizzes.length, 2);
  assert.equal("questions" in authenticated.body.quizzes[0], false);
  assert.equal("draft" in authenticated.body.quizzes[0], false);
  const privateDetail = response();
  await controller.getPublished({ user: { id: id(), role: "user" }, params: { quizId: String(studentQuiz._id) } }, privateDetail);
  assert.equal(privateDetail.statusCode, 200);
});

test("explanations are snapshotted for standalone only and old attempts remain readable", async () => {
  const quiz = await revisions.createDraft(draft());
  const published = await revisions.publishDraft(quiz._id, 1);
  const snapshot = buildQuizSubmissionSnapshot({ quiz: published, answers: [0], score: 1, total: 1 });
  assert.equal(snapshot.questions[0].explanation, "Because A is correct.");
  const attempt = await QuizAttempt.create({ quiz: quiz._id, user: id(), attemptNumber: 1, answers: [0], score: 1, total: 1, submissionSnapshot: snapshot });
  await revisions.saveDraft(quiz._id, 0, { questions: [question("New question")] });
  await revisions.publishDraft(quiz._id, 1);
  assert.equal((await QuizAttempt.findById(attempt._id)).submissionSnapshot.questions[0].explanation, "Because A is correct.");
  const legacy = await QuizAttempt.create({ quiz: quiz._id, user: id(), attemptNumber: 1, answers: [0], score: 1, total: 1 });
  assert.equal((await QuizAttempt.findById(legacy._id)).submissionSnapshot, undefined);
});

test("draft and published media references prevent cleanup; unowned media is rejected", async () => {
  const quiz = await revisions.createDraft(draft());
  await revisions.publishDraft(quiz._id, 1);
  const questionId = quiz.draft.questions[0]._id;
  const publicId = `arun_thai/quiz_media/images/${id()}`;
  const url = "https://res.cloudinary.com/example/image/upload/owned.webp";
  const owned = await QuizMedia.create({ quiz: quiz._id, questionId, mediaType: "image", publicId, resourceType: "image", url });
  const updated = await revisions.saveDraft(quiz._id, 0, { questions: [{ ...question(), _id: questionId, image: url, imagePublicId: publicId }] });
  assert.equal(updated.draft.questions[0].imagePublicId, publicId);
  const { cleanupQuizMedia } = require("../services/quizMediaLifecycle");
  assert.equal(await cleanupQuizMedia(owned), false);
  assert.equal((await QuizMedia.findById(owned._id)).cleanupState, "active");
  await assert.rejects(revisions.saveDraft(quiz._id, 1, { questions: [{ ...question(), _id: questionId, image: "https://example.test/foreign.webp" }] }), /owned Quiz media/);
  await revisions.publishDraft(quiz._id, 1);
  await revisions.saveDraft(quiz._id, 0, { questions: [{ ...question(), _id: questionId }] });
  assert.equal(await cleanupQuizMedia(owned), false, "a replacement draft must not remove published media");
});

test("generic live mutation is blocked and deletion preserves submitted history", async () => {
  const quiz = await revisions.createDraft(draft());
  await revisions.publishDraft(quiz._id, 1);
  const change = response();
  await oldController.updateQuiz({ params: { quizId: String(quiz._id) }, body: {}, files: [] }, change);
  assert.equal(change.statusCode, 409);
  const availability = response();
  await oldController.changeQuizAvailability({ params: { quizId: String(quiz._id) }, body: { status: "disabled" } }, availability);
  assert.equal(availability.statusCode, 409);
  const { startQuizSession } = require("../services/quizSessionService");
  await assert.rejects(startQuizSession({ quizId: quiz._id, user: { id: id(), role: "admin" } }), /unavailable/);
  const attempt = await QuizAttempt.create({ quiz: quiz._id, user: id(), attemptNumber: 1, answers: [0], score: 1, total: 1 });
  await assert.rejects(revisions.deleteDraftOrQuiz(quiz._id), /student results/);
  assert.ok(await Quiz.findById(quiz._id));
  assert.ok(await QuizAttempt.findById(attempt._id));
  const disposable = await revisions.createDraft(draft("Disposable"));
  assert.deepEqual(await revisions.deleteDraftOrQuiz(disposable._id), { deleted: true });
  assert.equal(await Quiz.findById(disposable._id), null);
});

test("temporary guest activity blocks permanent standalone deletion without changing the quiz", async () => {
  const GuestQuizSession = require("../models/guestQuizSessionModel");
  const GuestQuizAttempt = require("../models/guestQuizAttemptModel");
  const quiz = await revisions.createDraft(draft("Guest protected"));
  const startedAt = new Date();
  const guestSession = await GuestQuizSession.create({ quiz: quiz._id, ownerHash: "a".repeat(64),
    revision: 1, snapshot: { questions: [] }, startedAt,
    expiresAt: new Date(startedAt.getTime() + 24 * 60 * 60 * 1000) });
  await assert.rejects(revisions.deleteDraftOrQuiz(quiz._id), /temporary guest activity/);
  assert.ok(await Quiz.findById(quiz._id));
  await GuestQuizSession.deleteOne({ _id: guestSession._id });
  const submittedAt = new Date();
  await GuestQuizAttempt.create({ quiz: quiz._id, session: guestSession._id,
    ownerHash: "a".repeat(64), answers: [0], score: 1, total: 1,
    submissionSnapshot: { questions: [] }, submittedAt,
    expiresAt: new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000) });
  await assert.rejects(revisions.deleteDraftOrQuiz(quiz._id), /temporary guest activity/);
  assert.ok(await Quiz.findById(quiz._id));
});

for (const stage of ["registration", "reconciliation"]) {
  for (const operation of ["save", "publish"]) {
    test(`${stage} failure after ${operation} keeps the committed state and permits media-only retry`, async () => {
      const quiz = await revisions.createDraft(draft());
      const questionId = quiz.draft.questions[0]._id;
      const { fields } = await ownedImage(quiz, questionId);
      if (operation === "publish") {
        await revisions.saveDraft(quiz._id, 1, { questions: [{ ...question(), _id: questionId, ...fields }] });
      }
      const method = stage === "registration" ? "updateOne" : "find";
      const committedResponse = response();
      await withReplacement(QuizMedia, method, async () => {
        throw new Error(`injected ${stage} failure`);
      }, async () => operation === "save"
        ? controller.editDraft({ params: { quizId: String(quiz._id) }, body: { expectedVersion: 1, draft: { questions: [{ ...question(), _id: questionId, ...fields }] } } }, committedResponse)
        : controller.publish({ params: { quizId: String(quiz._id) }, body: { expectedVersion: 2 } }, committedResponse));
      const persisted = await Quiz.findById(quiz._id);
      assert.equal(committedResponse.statusCode, 200);
      assert.equal(committedResponse.body.mediaProcessing, "retry_required");
      assert.ok(persisted.mediaReconciliationToken);
      if (operation === "save") {
        assert.equal(persisted.draft.version, 2);
        assert.equal(persisted.draft.questions[0].imagePublicId, fields.imagePublicId);
        assert.equal(persisted.questions.length, 0);
      } else {
        assert.equal(persisted.publishedRevision, 1);
        assert.equal(persisted.draft, undefined);
        assert.equal(persisted.questions[0].imagePublicId, fields.imagePublicId);
      }
      const admin = response();
      await controller.getAdmin({ params: { quizId: String(quiz._id) } }, admin);
      assert.equal(admin.body.mediaProcessing, "retry_required");
      const retried = response();
      await controller.retryMedia({ params: { quizId: String(quiz._id) } }, retried);
      assert.equal(retried.statusCode, 200);
      assert.equal(retried.body.mediaProcessing, "complete");
      assert.equal((await Quiz.findById(quiz._id)).mediaReconciliationToken, undefined);
      const repeated = await revisions.retryMediaReconciliation(quiz._id);
      assert.equal(repeated.mediaReconciliationToken, undefined, "recovery is idempotent");
    });
  }
}

test("failed recovery retains its marker, then succeeds without repeating the draft write", async () => {
  const quiz = await revisions.createDraft(draft());
  await withReplacement(QuizMedia, "find", async () => { throw new Error("injected failure"); },
    () => revisions.saveDraft(quiz._id, 1, { title: "Committed title" }));
  const token = (await Quiz.findById(quiz._id)).mediaReconciliationToken;
  const failed = await withReplacement(QuizMedia, "find", async () => { throw new Error("injected retry failure"); },
    () => revisions.retryMediaReconciliation(quiz._id));
  assert.equal(failed.mediaReconciliationToken, token);
  const recovered = await revisions.retryMediaReconciliation(quiz._id);
  assert.equal(recovered.mediaReconciliationToken, undefined);
  assert.equal(recovered.draft.version, 2);
  assert.equal(recovered.draft.title, "Committed title");
});

test("a stale recovery cannot clear a newer edit's media marker", async () => {
  const quiz = await revisions.createDraft(draft());
  await withReplacement(QuizMedia, "find", async () => { throw new Error("injected failure"); },
    () => revisions.saveDraft(quiz._id, 1, { title: "First edit" }));
  let release; let entered;
  const waiting = new Promise((resolve) => { entered = resolve; });
  const originalFind = QuizMedia.find;
  let calls = 0;
  QuizMedia.find = (...args) => {
    calls += 1;
    if (calls === 1) return new Promise((resolve) => {
      release = () => resolve(originalFind.apply(QuizMedia, args));
      entered();
    });
    if (calls === 2) throw new Error("injected newer operation failure");
    return originalFind.apply(QuizMedia, args);
  };
  try {
    const staleRecovery = revisions.retryMediaReconciliation(quiz._id);
    await waiting;
    const newer = await revisions.saveDraft(quiz._id, 2, { title: "Second edit" });
    const newerToken = newer.mediaReconciliationToken;
    assert.ok(newerToken);
    release();
    await staleRecovery;
    const current = await Quiz.findById(quiz._id);
    assert.equal(current.mediaReconciliationToken, newerToken);
    assert.equal(current.draft.title, "Second edit");
  } finally { QuizMedia.find = originalFind; }
  assert.equal((await revisions.retryMediaReconciliation(quiz._id)).mediaReconciliationToken, undefined);
});

test("a Quiz persistence failure does not advance the draft or create a media marker", async () => {
  const quiz = await revisions.createDraft(draft());
  await assert.rejects(withReplacement(Quiz, "findOneAndUpdate", async () => { throw new Error("injected persistence failure"); },
    () => revisions.saveDraft(quiz._id, 1, { title: "Not committed" })), /injected persistence failure/);
  const persisted = await Quiz.findById(quiz._id);
  assert.equal(persisted.draft.version, 1);
  assert.equal(persisted.draft.title, "General Practice");
  assert.equal(persisted.mediaReconciliationToken, undefined);
});

test("cleanup failure is retryable and never reports a completed media pass", async () => {
  const quiz = await revisions.createDraft(draft());
  const questionId = quiz.draft.questions[0]._id;
  const { record, fields } = await ownedImage(quiz, questionId);
  await revisions.saveDraft(quiz._id, 1, { questions: [{ ...question(), _id: questionId, ...fields }] });
  const cloudinary = require("../config/cloudinary");
  const failed = await withReplacement(cloudinary.uploader, "destroy", async () => { throw new Error("injected Cloudinary failure"); },
    () => revisions.saveDraft(quiz._id, 2, { questions: [{ ...question(), _id: questionId }] }));
  assert.ok(failed.mediaReconciliationToken);
  assert.equal((await QuizMedia.findById(record._id)).cleanupState, "cleanup_failed");
  const recovered = await withReplacement(cloudinary.uploader, "destroy", async () => ({ result: "ok" }),
    () => revisions.retryMediaReconciliation(quiz._id));
  assert.equal(recovered.mediaReconciliationToken, undefined);
  assert.equal((await QuizMedia.findById(record._id)).cleanupState, "deleted");
});

test("legacy media remains readable and does not hold an unrelated draft save open", async () => {
  const quiz = await revisions.createDraft(draft());
  const questionId = quiz.draft.questions[0]._id;
  const publicId = `arun_thai/quiz_media/images/${id()}`;
  const url = `https://res.cloudinary.com/example/image/upload/${publicId}.webp`;
  const legacy = await QuizMedia.create({ quiz: quiz._id, questionId, mediaType: "image",
    publicId, resourceType: "image", url });
  await revisions.saveDraft(quiz._id, 1, { questions: [{ ...question(), _id: questionId,
    image: url, imagePublicId: publicId }] });
  const saved = await revisions.saveDraft(quiz._id, 2, { questions: [{ ...question(), _id: questionId }] });
  assert.equal(saved.mediaReconciliationToken, undefined);
  assert.equal((await QuizMedia.findById(legacy._id)).cleanupError, "legacy_media_unverified");
});

test("multipart draft edit replaces image with a testing-owned reservation without changing published or session media", async (t) => {
  const cloud = mockQuestionMedia(t);
  const created = await revisions.createDraft(draft());
  const published = await revisions.publishDraft(created._id, 1);
  const original = published.questions[0].toObject();
  const session = await QuizSession.create({ user: id(), quiz: created._id, revision: 1,
    contextType: "standalone", snapshot: { questions: [original] }, expiresAt: new Date(Date.now() + 86400000) });
  const edited = await revisions.saveDraftWithMedia(created._id, 0,
    { questions: [{ ...original, audio: "", audioPublicId: "" }] },
    [{ fieldname: "questionImage_0", buffer: Buffer.from("image fixture"), mimetype: "image/png" }]);
  assert.equal(edited.draft.version, 1);
  assert.equal(edited.publishedRevision, 1);
  assert.equal(edited.questions[0].image || "", original.image || "");
  assert.equal((await QuizSession.findById(session._id)).snapshot.questions[0].image || "", original.image || "");
  const record = await QuizMedia.findOne({ publicId: edited.draft.questions[0].imagePublicId });
  assert.equal(record.environment, "testing");
  assert.equal(record.cleanupState, "active");
  assert.equal(String(record.questionId), String(original._id));
  assert.match(record.publicId, /^arun_thai\/testing\/quiz_media\/images\//);
  assert.equal(cloud.upload.mock.calls[0].arguments[0].overwrite, false);
  assert.equal(cloud.destroy.mock.callCount(), 0);
  const republished = await revisions.publishDraft(created._id, 1);
  assert.equal(republished.questions[0].imagePublicId, record.publicId);
  assert.equal((await QuizSession.findById(session._id)).snapshot.questions[0].image || "", original.image || "");
});

test("audio-only replacement and explicit removal preserve unrelated media and published references", async (t) => {
  const cloud = mockQuestionMedia(t);
  const created = await revisions.createDraft(draft());
  const first = created.draft.questions[0].toObject();
  const image = await ownedImage(created, first._id);
  await revisions.saveDraft(created._id, 1, { questions: [{ ...first, ...image.fields }] });
  const published = await revisions.publishDraft(created._id, 2);
  const live = published.questions[0].toObject();
  const edited = await revisions.saveDraftWithMedia(created._id, 0,
    { questions: [live] }, [{ fieldname: "questionAudio_0", buffer: Buffer.from("audio fixture"), mimetype: "audio/mpeg" }]);
  assert.equal(edited.draft.questions[0].imagePublicId, image.record.publicId);
  assert.match(edited.draft.questions[0].audioPublicId, /^arun_thai\/testing\/quiz_media\/audio\//);
  const removed = await revisions.saveDraft(created._id, 1,
    { questions: [{ ...edited.draft.questions[0].toObject(), image: "", imagePublicId: "" }] });
  assert.equal(removed.draft.questions[0].image || "", "");
  assert.equal(removed.draft.questions[0].audioPublicId, edited.draft.questions[0].audioPublicId);
  assert.equal(removed.questions[0].imagePublicId, image.record.publicId);
  assert.equal((await QuizMedia.findById(image.record._id)).cleanupState, "active");
  assert.equal(cloud.destroy.mock.callCount(), 0);
});

test("new question media validates ownership, stale versions, and ambiguous upload reservations", async (t) => {
  const cloud = mockQuestionMedia(t, { failOn: 2 });
  const quiz = await revisions.createDraft(draft());
  const original = quiz.draft.questions[0].toObject();
  const replacement = { ...draft(), questions: [original, question("New media question")] };
  await assert.rejects(revisions.saveDraftWithMedia(quiz._id, 0, replacement,
    [{ fieldname: "questionImage_1", buffer: Buffer.from("image"), mimetype: "image/png" }]),
  (error) => error.status === 409);
  assert.equal(cloud.upload.mock.callCount(), 0);
  await assert.rejects(revisions.saveDraftWithMedia(quiz._id, 1, replacement,
    [{ fieldname: "questionImage_4", buffer: Buffer.from("image"), mimetype: "image/png" }]),
  (error) => error.status === 400);
  assert.equal(cloud.upload.mock.callCount(), 0);
  const edited = await revisions.saveDraftWithMedia(quiz._id, 1, replacement,
    [{ fieldname: "questionImage_1", buffer: Buffer.from("image"), mimetype: "image/png" }]);
  assert.equal(edited.draft.questions.length, 2);
  assert.match(edited.draft.questions[1].imagePublicId, /^arun_thai\/testing\/quiz_media\/images\//);
  await assert.rejects(revisions.saveDraftWithMedia(quiz._id, 2,
    { questions: edited.draft.questions.map((item) => item.toObject()) },
    [{ fieldname: "questionAudio_1", buffer: Buffer.from("audio"), mimetype: "audio/mpeg" }]), /ambiguous upload/);
  assert.equal((await Quiz.findById(quiz._id)).draft.version, 2);
  assert.ok(await QuizMedia.exists({ quiz: quiz._id, mediaType: "audio", cleanupState: "reserved", url: "" }));
  assert.equal(cloud.destroy.mock.callCount(), 0);
  const foreign = await QuizMedia.create({ quiz: quiz._id, questionId: original._id, mediaType: "audio",
    environment: "production", publicId: `arun_thai/production/quiz_media/audio/${id()}`,
    resourceType: "video", url: "https://res.cloudinary.com/du6lhdq8t/video/upload/foreign.mp3" });
  await assert.rejects(revisions.saveDraft(quiz._id, 2,
    { questions: [{ ...edited.draft.questions[0].toObject(), audio: foreign.url,
      audioPublicId: foreign.publicId }, edited.draft.questions[1].toObject()] }),
  (error) => error.status === 400 && error.code === "invalid_quiz_media");
});

test("a partial edit upload cleans only confirmed assets and retains ambiguous reservations", async (t) => {
  const cloud = mockQuestionMedia(t, { failOn: 2 });
  const quiz = await revisions.createDraft(draft());
  const questionId = quiz.draft.questions[0]._id;
  await assert.rejects(revisions.saveDraftWithMedia(quiz._id, 1,
    { questions: [{ ...quiz.draft.questions[0].toObject(), _id: questionId }] },
    [{ fieldname: "questionImage_0", mimetype: "image/png", buffer: Buffer.from("image") },
      { fieldname: "questionAudio_0", mimetype: "audio/mpeg", buffer: Buffer.from("audio") }]),
  /ambiguous upload/);
  assert.equal((await Quiz.findById(quiz._id)).draft.version, 1);
  assert.equal(cloud.destroy.mock.callCount(), 1);
  assert.ok(await QuizMedia.exists({ quiz: quiz._id, mediaType: "image", cleanupState: "deleted" }));
  assert.ok(await QuizMedia.exists({ quiz: quiz._id, mediaType: "audio", cleanupState: "reserved", url: "" }));
});

test("uncommitted edit media stays reserved during reconciliation and activates only after the draft references it", async (t) => {
  const cloud = mockQuestionMedia(t);
  const quiz = await revisions.createDraft(draft());
  const questionId = quiz.draft.questions[0]._id;
  const record = await require("../services/quizQuestionMediaUpload").uploadOwnedQuestionMedia({
    quizId: quiz._id, questionId, mediaType: "image", buffer: Buffer.from("image"), holdForRevision: true });
  assert.equal(record.cleanupState, "reserved");
  await require("../services/quizMediaLifecycle").reconcileStandaloneQuizMedia(quiz);
  assert.equal((await QuizMedia.findById(record._id)).cleanupState, "reserved");
  assert.equal(cloud.destroy.mock.callCount(), 0);
  const saved = await revisions.saveDraft(quiz._id, 1, { questions: [{ ...quiz.draft.questions[0].toObject(),
    image: record.url, imagePublicId: record.publicId }] });
  assert.equal(saved.draft.questions[0].imagePublicId, record.publicId);
  assert.equal((await QuizMedia.findById(record._id)).cleanupState, "active");
});

test("media retry is a separate POST behind authentication and Admin authorization", async () => {
  const router = require("../routes/quiz");
  const route = router.stack.find((layer) => layer.route?.path === "/admin/standalone/:quizId/media/retry");
  assert.ok(route);
  assert.equal(route.route.methods.post, true);
  assert.deepEqual(Object.keys(route.route.methods), ["post"]);
  assert.deepEqual(route.route.stack.map((layer) => layer.name), ["validateToken", "requireAdmin", "retryMedia"]);
  const unauthenticated = response();
  await route.route.stack[0].handle({ headers: {} }, unauthenticated, () => assert.fail("unauthenticated retry proceeded"));
  assert.equal(unauthenticated.statusCode, 401);
  const nonAdmin = response();
  await route.route.stack[1].handle({ user: { role: "user" } }, nonAdmin, () => assert.fail("student retry proceeded"));
  assert.equal(nonAdmin.statusCode, 403);
});

test("draft media route retains Admin authentication and rejects unsupported or oversized files", () => {
  const router = require("../routes/quiz");
  const route = router.stack.find((layer) => layer.route?.path === "/admin/standalone/:quizId/draft");
  assert.equal(route.route.methods.put, true);
  assert.deepEqual(route.route.stack.slice(0, 2).map((layer) => layer.name), ["validateToken", "requireAdmin"]);
  const validate = require("../middleware/uploadValidation").validateQuizMediaContent;
  for (const file of [
    { fieldname: "questionImage_0", mimetype: "text/plain", buffer: Buffer.from("plain") },
    { fieldname: "questionAudio_0", mimetype: "audio/mpeg", buffer: Buffer.from("plain") },
    { fieldname: "questionImage_0", mimetype: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
  ]) {
    const res = response(); let next = false;
    validate({ files: [file] }, res, () => { next = true; });
    assert.equal(res.statusCode, 400);
    assert.equal(next, false);
  }
});
