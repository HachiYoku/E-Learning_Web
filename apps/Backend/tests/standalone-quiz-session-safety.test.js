const assert = require("node:assert/strict");
const { before, beforeEach, after, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");

let mongo; let directory; let Quiz; let QuizSession; let QuizAttempt; let QuizMedia;
let revisions; let startOrResume; let shuffleSnapshotQuestions; let oldStart; let sessionSnapshot;
const id = () => new mongoose.Types.ObjectId();
const user = () => ({ id: id(), role: "user" });
const question = (prompt = "Original question") => ({ prompt, options: ["A", "B"], correctAnswer: 0,
  explanation: "Answer A", imageAlt: "Example image" });
const draft = () => ({ title: "General Practice", category: "Vocabulary", difficulty: "Beginner",
  standaloneAccess: "public", questions: [question()] });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
async function withReplacement(object, key, replacement, run) {
  const original = object[key]; object[key] = replacement;
  try { return await run(); } finally { object[key] = original; }
}
async function publishedQuiz() {
  const created = await revisions.createDraft(draft());
  return revisions.publishDraft(created._id, 1);
}

before(async () => {
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const selected = server.address().port;
      server.close((error) => error ? reject(error) : resolve(selected));
    });
  });
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-standalone-sessions-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory,
    "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/quiz_standalone_sessions?replicaSet=paymentTests`);
  Quiz = require("../models/quizModel");
  QuizSession = require("../models/quizSessionModel");
  QuizAttempt = require("../models/quizAttemptModel");
  QuizMedia = require("../models/quizMediaModel");
  revisions = { ...require("../services/standaloneQuizRevisions"),
    createDraft: require("./helpers/legacyStandaloneDraft") };
  ({ startOrResumeStandaloneQuizSession: startOrResume, shuffleSnapshotQuestions } =
    require("../services/standaloneQuizSessionService"));
  ({ startQuizSession: oldStart, sessionSnapshot } = require("../services/quizSessionService"));
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all([Quiz, QuizSession, QuizAttempt, QuizMedia].map((Model) => Model.syncIndexes()));
});

after(async () => {
  await mongoose.disconnect();
  if (mongo && mongo.exitCode === null) {
    await new Promise((resolve) => { mongo.once("exit", resolve); mongo.kill("SIGTERM"); });
  }
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

test("internal start stores a 24-hour snapshot, resumes it, and leaves public standalone runtime locked", async () => {
  const quiz = await publishedQuiz(); const learner = user();
  const started = await startOrResume({ quizId: quiz._id, user: learner });
  assert.equal(started.created, true);
  assert.equal(started.expiresAt.getTime() - (await QuizSession.findById(started.sessionId)).startedAt.getTime(), 24 * 60 * 60 * 1000);
  assert.equal("correctAnswer" in started.questions[0], false);
  assert.equal("explanation" in started.questions[0], false);
  assert.equal("imagePublicId" in started.questions[0], false);
  const resumed = await startOrResume({ quizId: quiz._id, user: learner });
  assert.equal(resumed.created, false);
  assert.equal(resumed.sessionId, started.sessionId);
  assert.deepEqual(resumed.questions, started.questions);
  await assert.rejects(oldStart({ quizId: quiz._id, user: learner }), /unavailable/i);
  assert.equal(await QuizSession.countDocuments({ quiz: quiz._id, user: learner.id, activeSlot: true }), 1);
});

test("Fisher-Yates uses a controlled random source without changing authored or shared-context order", () => {
  const authored = [{ questionId: "A" }, { questionId: "B" }, { questionId: "C" }, { questionId: "D" }];
  const choices = [];
  const shuffled = shuffleSnapshotQuestions({ questions: authored }, (upper) => {
    choices.push(upper);
    return 0;
  });
  assert.deepEqual(choices, [4, 3, 2]);
  assert.deepEqual(shuffled.questions.map((item) => item.questionId), ["B", "C", "D", "A"]);
  assert.deepEqual(authored.map((item) => item.questionId), ["A", "B", "C", "D"]);
  for (const contextType of ["course_lesson", "homework_lesson"]) {
    const shared = sessionSnapshot({ contextType, title: "Existing quiz", revision: 1,
      questions: authored.map((item) => ({ _id: item.questionId, prompt: item.questionId,
        options: ["A", "B"], correctAnswer: 0 })) });
    assert.deepEqual(shared.questions.map((item) => item.questionId), ["A", "B", "C", "D"]);
  }
});

test("new standalone sessions persist a complete permutation; resume preserves it", async () => {
  const created = await revisions.createDraft({ ...draft(), questions: [question("One"), question("Two"), question("Three")] });
  const quiz = await revisions.publishDraft(created._id, 1); const learner = user();
  const started = await startOrResume({ quizId: quiz._id, user: learner });
  const stored = await QuizSession.findById(started.sessionId);
  const ids = started.questions.map((item) => String(item._id));
  assert.equal(new Set(ids).size, quiz.questions.length);
  assert.deepEqual([...ids].sort(), quiz.questions.map((item) => String(item._id)).sort());
  assert.deepEqual(stored.snapshot.questions.map((item) => String(item.questionId)), ids);
  assert.deepEqual((await startOrResume({ quizId: quiz._id, user: learner })).questions, started.questions);
  assert.equal("correctAnswer" in started.questions[0], false);
});

test("an existing authored-order session keeps that order when resumed", async () => {
  const created = await revisions.createDraft({ ...draft(), questions: [question("One"), question("Two"), question("Three")] });
  const quiz = await revisions.publishDraft(created._id, 1); const learner = user();
  const started = await startOrResume({ quizId: quiz._id, user: learner });
  const stored = await QuizSession.findById(started.sessionId);
  const byId = new Map(stored.snapshot.questions.map((item) => [String(item.questionId), item]));
  const authoredOrder = quiz.questions.map((item) => byId.get(String(item._id)));
  // Emulate a session saved before randomization; the application model keeps
  // snapshots immutable, so the disposable fixture uses the collection API.
  await QuizSession.collection.updateOne({ _id: stored._id }, { $set: { "snapshot.questions": authoredOrder } });
  const resumed = await startOrResume({ quizId: quiz._id, user: learner });
  assert.equal(resumed.sessionId, started.sessionId);
  assert.deepEqual(resumed.questions.map((item) => String(item._id)), quiz.questions.map((item) => String(item._id)));
});

test("parallel starts converge on one committed session and the loser resumes it", async () => {
  const quiz = await publishedQuiz(); const learner = user();
  const results = await Promise.all([1, 2, 3].map(() => startOrResume({ quizId: quiz._id, user: learner })));
  assert.equal(new Set(results.map((result) => result.sessionId)).size, 1);
  assert.equal(results.filter((result) => result.created).length, 1);
  assert.equal(await QuizSession.countDocuments({ quiz: quiz._id, user: learner.id }), 1);
});

test("duplicate-key and transient write conflicts retry with fresh state", async () => {
  const quiz = await publishedQuiz(); const learner = user();
  let duplicate = true;
  const originalCreate = QuizSession.create;
  const first = await withReplacement(QuizSession, "create", async function createWithOneDuplicate(...args) {
    if (duplicate) { duplicate = false; throw Object.assign(new Error("injected duplicate"), { code: 11000 }); }
    return originalCreate.apply(this, args);
  }, () => startOrResume({ quizId: quiz._id, user: learner }));
  assert.equal(first.created, true);
  const originalUpdate = Quiz.findOneAndUpdate;
  let transient = true;
  const second = await withReplacement(Quiz, "findOneAndUpdate", function updateWithOneConflict(...args) {
    if (transient) { transient = false; throw Object.assign(new Error("injected write conflict"), { code: 112 }); }
    return originalUpdate.apply(this, args);
  }, () => startOrResume({ quizId: quiz._id, user: learner }));
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(second.created, false);
});

test("an ambiguous commit is resolved from persisted state without replaying the insert", async () => {
  const quiz = await publishedQuiz(); const learner = user();
  const originalStartSession = mongoose.startSession;
  let injected = false;
  const result = await withReplacement(mongoose, "startSession", async function startWithAmbiguousCommit(...args) {
    const session = await originalStartSession.apply(this, args);
    const originalCommit = session.commitTransaction.bind(session);
    session.commitTransaction = async () => {
      await originalCommit();
      if (!injected) {
        injected = true;
        const error = new Error("injected ambiguous commit");
        error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
        throw error;
      }
    };
    return session;
  }, () => startOrResume({ quizId: quiz._id, user: learner }));
  assert.equal(injected, true);
  assert.equal(result.created, true);
  assert.equal(await QuizSession.countDocuments({ quiz: quiz._id, user: learner.id }), 1);
});

test("expired active slots release at the boundary without waiting for TTL", async () => {
  const quiz = await publishedQuiz(); const learner = user();
  const first = await startOrResume({ quizId: quiz._id, user: learner });
  await QuizSession.collection.updateOne({ _id: new mongoose.Types.ObjectId(first.sessionId) }, { $set: { expiresAt: new Date() } });
  const next = await startOrResume({ quizId: quiz._id, user: learner });
  assert.notEqual(next.sessionId, first.sessionId);
  assert.equal((await QuizSession.findById(first.sessionId)).activeSlot, false);
  assert.equal(await QuizSession.countDocuments({ quiz: quiz._id, user: learner.id, activeSlot: true }), 1);
});

test("publication preserves the original session snapshot and new learners see the new revision", async () => {
  const quiz = await publishedQuiz(); const learner = user();
  const original = await startOrResume({ quizId: quiz._id, user: learner });
  await revisions.saveDraft(quiz._id, 0, { questions: [question("New question")] });
  await revisions.publishDraft(quiz._id, 1);
  const resumed = await startOrResume({ quizId: quiz._id, user: learner });
  const newer = await startOrResume({ quizId: quiz._id, user: user() });
  assert.equal(resumed.sessionId, original.sessionId);
  assert.equal(resumed.revision, 1);
  assert.equal(resumed.questions[0].prompt, "Original question");
  assert.equal(newer.revision, 2);
  assert.equal(newer.questions[0].prompt, "New question");
});

async function pauseSessionCreation(run) {
  const entered = deferred(); const release = deferred();
  const originalCreate = QuizSession.create;
  let paused = false;
  QuizSession.create = async function pausedCreate(...args) {
    if (!paused) { paused = true; entered.resolve(); await release.promise; }
    return originalCreate.apply(this, args);
  };
  try { return await run({ entered: entered.promise, release: release.resolve }); }
  finally { release.resolve(); QuizSession.create = originalCreate; }
}

for (const action of ["disable", "archive"]) {
  test(`${action} interleaved with start leaves no resumable session`, async () => {
    const quiz = await publishedQuiz(); const learner = user();
    await pauseSessionCreation(async ({ entered, release }) => {
      const starting = startOrResume({ quizId: quiz._id, user: learner });
      await entered;
      const changing = revisions.changeAvailability(quiz._id, action);
      release();
      const [started, changed] = await Promise.all([starting, changing]);
      assert.equal(changed.status, action === "archive" ? "archived" : "disabled");
      assert.ok((await QuizSession.findById(started.sessionId)).invalidatedAt);
      await assert.rejects(startOrResume({ quizId: quiz._id, user: learner }), /unavailable/i);
    });
  });
}

test("publication interleaved with creation keeps the original snapshot", async () => {
  const quiz = await publishedQuiz(); const learner = user();
  await revisions.saveDraft(quiz._id, 0, { questions: [question("Second edition")] });
  await pauseSessionCreation(async ({ entered, release }) => {
    const starting = startOrResume({ quizId: quiz._id, user: learner });
    await entered;
    const publishing = revisions.publishDraft(quiz._id, 1);
    release();
    const [started, published] = await Promise.all([starting, publishing]);
    assert.equal(published.publishedRevision, 2);
    assert.equal(started.revision, 1);
    assert.equal(started.questions[0].prompt, "Original question");
  });
});

test("deletion interleaved with start invalidates the committed session before returning", async () => {
  const quiz = await publishedQuiz(); const learner = user();
  await pauseSessionCreation(async ({ entered, release }) => {
    const starting = startOrResume({ quizId: quiz._id, user: learner });
    await entered;
    const deleting = revisions.deleteDraftOrQuiz(quiz._id);
    release();
    const [started, deleted] = await Promise.all([starting, deleting]);
    assert.deepEqual(deleted, { deleted: true });
    assert.equal(await Quiz.findById(quiz._id), null);
    assert.ok((await QuizSession.findById(started.sessionId)).invalidatedAt);
    await assert.rejects(startOrResume({ quizId: quiz._id, user: learner }), /unavailable/i);
  });
});

test("disable invalidates and releases sessions atomically; re-enable never resumes them", async () => {
  const quiz = await publishedQuiz(); const learner = user();
  const first = await startOrResume({ quizId: quiz._id, user: learner });
  await revisions.changeAvailability(quiz._id, "disable");
  const old = await QuizSession.findById(first.sessionId);
  assert.ok(old.invalidatedAt); assert.equal(old.activeSlot, false);
  await assert.rejects(startOrResume({ quizId: quiz._id, user: learner }), /unavailable/i);
  await revisions.changeAvailability(quiz._id, "enable");
  const next = await startOrResume({ quizId: quiz._id, user: learner });
  assert.notEqual(next.sessionId, first.sessionId);
  assert.ok((await QuizSession.findById(first.sessionId)).invalidatedAt);
});

test("archive rejects new starts and preserves session history and media records", async () => {
  const quiz = await publishedQuiz(); const learner = user();
  const first = await startOrResume({ quizId: quiz._id, user: learner });
  await revisions.changeAvailability(quiz._id, "archive");
  await assert.rejects(startOrResume({ quizId: quiz._id, user: learner }), /unavailable/i);
  assert.ok((await QuizSession.findById(first.sessionId)).invalidatedAt);
  assert.equal((await Quiz.findById(quiz._id)).status, "archived");
});

test("deletion refuses committed attempts and does not cascade history", async () => {
  const quiz = await publishedQuiz();
  const attempt = await QuizAttempt.create({ quiz: quiz._id, user: id(), attemptNumber: 1,
    answers: [0], score: 1, total: 1 });
  await assert.rejects(revisions.deleteDraftOrQuiz(quiz._id), /student results/);
  assert.ok(await Quiz.findById(quiz._id));
  assert.ok(await QuizAttempt.findById(attempt._id));
});

test("history-free deletion commits before cleanup; failed cleanup remains recoverable", async () => {
  const quiz = await publishedQuiz();
  const record = await QuizMedia.create({ quiz: quiz._id, questionId: quiz.questions[0]._id,
    mediaType: "image", publicId: `arun_thai/quiz_media/images/${id()}`,
    resourceType: "image", url: "https://res.cloudinary.com/example/image/upload/unused.webp" });
  const cloudinary = require("../config/cloudinary");
  const failed = await withReplacement(cloudinary.uploader, "destroy", async () => { throw new Error("injected cleanup failure"); },
    () => revisions.deleteDraftOrQuiz(quiz._id));
  assert.deepEqual(failed, { deleted: true, mediaProcessing: "retry_required" });
  assert.equal(await Quiz.findById(quiz._id), null);
  assert.equal((await QuizMedia.findById(record._id)).cleanupState, "cleanup_failed");
  const { cleanupQuizMedia } = require("../services/quizMediaLifecycle");
  const recovered = await withReplacement(cloudinary.uploader, "destroy", async () => ({ result: "ok" }),
    () => cleanupQuizMedia(record));
  assert.equal(recovered, true);
  assert.equal((await QuizMedia.findById(record._id)).cleanupState, "deleted");
});

test("stale standalone media reconciliation cannot resurrect an asset after Quiz deletion", async () => {
  const quiz = await revisions.createDraft(draft());
  const questionId = quiz.draft.questions[0]._id;
  const publicId = `arun_thai/quiz_media/images/${id()}`;
  const url = "https://res.cloudinary.com/example/image/upload/owned.webp";
  const record = await QuizMedia.create({ quiz: quiz._id, questionId, mediaType: "image",
    publicId, resourceType: "image", url });
  await revisions.saveDraft(quiz._id, 1, { questions: [{ ...question(), _id: questionId,
    image: url, imagePublicId: publicId }] });
  const stale = await Quiz.findById(quiz._id);
  const cloudinary = require("../config/cloudinary");
  await withReplacement(cloudinary.uploader, "destroy", async () => ({ result: "ok" }),
    () => revisions.deleteDraftOrQuiz(quiz._id));
  assert.equal((await QuizMedia.findById(record._id)).cleanupState, "deleted");
  const lifecycle = require("../services/quizMediaLifecycle");
  await assert.rejects(lifecycle.reconcileStandaloneQuizMedia(stale), /media ownership requires recovery/);
  assert.equal((await QuizMedia.findById(record._id)).cleanupState, "deleted");
});
