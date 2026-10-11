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
let revisions; let start; let submit; let result; let history;
const id = () => new mongoose.Types.ObjectId();
const user = () => ({ id: id(), role: "user" });
const question = (prompt = "First question") => ({ prompt, options: ["A", "B"], correctAnswer: 0,
  explanation: "The answer is A." });
const draft = (questions = [question(), question("Second question")]) => ({ title: "Practice A",
  category: "Vocabulary", difficulty: "Beginner", standaloneAccess: "public", questions });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
async function withReplacement(object, key, replacement, run) {
  const original = object[key]; object[key] = replacement;
  try { return await run(); } finally { object[key] = original; }
}
async function publishedQuiz(questions) {
  const created = await revisions.createDraft(draft(questions));
  return revisions.publishDraft(created._id, 1);
}
async function ready({ quiz = null, learner = user(), answers = [0, 1] } = {}) {
  const published = quiz || await publishedQuiz();
  const session = await start({ quizId: published._id, user: learner });
  return { quiz: published, learner, session, args: {
    quizId: published._id, sessionId: session.sessionId, submittedRevision: session.revision,
    user: learner, answers,
  } };
}
async function pauseOnce(object, key, run) {
  const entered = deferred(); const release = deferred();
  const original = object[key]; let paused = false;
  object[key] = async function pausedCall(...args) {
    if (!paused) { paused = true; entered.resolve(); await release.promise; }
    return original.apply(this, args);
  };
  try { return await run({ entered: entered.promise, release: release.resolve }); }
  finally { release.resolve(); object[key] = original; }
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
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-standalone-submissions-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory,
    "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/quiz_standalone_submissions?replicaSet=paymentTests`);
  Quiz = require("../models/quizModel");
  QuizSession = require("../models/quizSessionModel");
  QuizAttempt = require("../models/quizAttemptModel");
  QuizMedia = require("../models/quizMediaModel");
  revisions = require("../services/standaloneQuizRevisions");
  ({ startOrResumeStandaloneQuizSession: start } = require("../services/standaloneQuizSessionService"));
  ({ submitStandaloneQuiz: submit, getStandaloneAttemptResult: result,
    getStandaloneAttemptHistory: history } = require("../services/standaloneQuizSubmissionService"));
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

test("server scores immutable snapshot and atomically releases the active slot", async () => {
  const { args, session } = await ready();
  const saved = await submit(args);
  assert.equal(saved.score, 1); assert.equal(saved.total, 2);
  assert.equal(saved.percentage, 50); assert.equal(saved.correctCount, 1); assert.equal(saved.incorrectCount, 1);
  assert.deepEqual(saved.answers, [0, 1]);
  assert.deepEqual(saved.review.map((item) => item.correctAnswer), [0, 0]);
  assert.equal(saved.review[0].explanation, "The answer is A.");
  assert.equal((await QuizSession.findById(session.sessionId)).activeSlot, false);
  const stored = await QuizAttempt.findById(saved.attemptId);
  assert.equal(String(stored.session), session.sessionId);
  assert.equal(stored.submissionSnapshot.questions[0].explanation, "The answer is A.");
  assert.equal(await QuizAttempt.countDocuments({ session: session.sessionId }), 1);
  const next = await start({ quizId: args.quizId, user: args.user });
  assert.notEqual(next.sessionId, session.sessionId);
});

test("malformed, missing, extra and out-of-range answers do not create attempts or release a slot", async () => {
  const { args, session } = await ready();
  for (const answers of [null, {}, [], [0], [0, 1, 0], [0, 2], [-1, 0], [0, null], [0, false], [0, "1"], [0, 1.5]]) {
    await assert.rejects(submit({ ...args, answers }), /valid answer/);
  }
  assert.equal(await QuizAttempt.countDocuments({ quiz: args.quizId }), 0);
  assert.equal((await QuizSession.findById(session.sessionId)).activeSlot, true);
});

test("a session-release write failure rolls back the attempt and leaves the slot retryable", async () => {
  const { args, session } = await ready();
  await assert.rejects(withReplacement(QuizSession, "updateOne", async () => {
    throw new Error("injected slot-release failure");
  }, () => submit(args)), /injected slot-release failure/);
  assert.equal(await QuizAttempt.countDocuments({ session: session.sessionId }), 0);
  assert.equal((await QuizSession.findById(session.sessionId)).activeSlot, true);
  assert.equal((await submit(args)).attemptNumber, 1);
});

test("another user and Admin cannot submit or read an attempt", async () => {
  const { args } = await ready(); const stranger = user();
  await assert.rejects(submit({ ...args, user: stranger }), /session|unavailable/i);
  await assert.rejects(submit({ ...args, user: { ...args.user, role: "admin" } }), /unavailable/i);
  assert.equal(await QuizAttempt.countDocuments({ quiz: args.quizId }), 0);
  const saved = await submit(args);
  await assert.rejects(result({ attemptId: saved.attemptId, user: stranger }), /unavailable/i);
  assert.deepEqual(await history({ user: stranger }), []);
  assert.equal((await result({ attemptId: saved.attemptId, user: args.user })).attemptId, saved.attemptId);
});

test("expiry boundary, invalidation and forged revision reject without consuming the session", async () => {
  const first = await ready();
  await assert.rejects(submit({ ...first.args, submittedRevision: first.args.submittedRevision + 1 }), /session/);
  assert.equal((await QuizSession.findById(first.session.sessionId)).activeSlot, true);
  await QuizSession.collection.updateOne({ _id: new mongoose.Types.ObjectId(first.session.sessionId) },
    { $set: { expiresAt: new Date() } });
  await assert.rejects(submit(first.args), /session/);
  const second = await ready({ quiz: first.quiz, learner: user() });
  await revisions.changeAvailability(first.quiz._id, "disable");
  await assert.rejects(submit(second.args), /unavailable|session/i);
  assert.equal(await QuizAttempt.countDocuments({ quiz: first.quiz._id }), 0);
});

test("an explicitly invalidated session is rejected while its Quiz remains published", async () => {
  const { args, session } = await ready();
  await QuizSession.updateOne({ _id: session.sessionId },
    { $set: { invalidatedAt: new Date(), activeSlot: false, invalidationReason: "test" } });
  await assert.rejects(submit(args), /session/);
  assert.equal(await QuizAttempt.countDocuments({ quiz: args.quizId }), 0);
});

test("concurrent and different-payload submissions replay one committed attempt", async () => {
  const { args, session } = await ready();
  const [first, second] = await Promise.all([submit(args), submit({ ...args, answers: [1, 1] })]);
  assert.equal(first.attemptId, second.attemptId);
  assert.deepEqual(first.answers, second.answers);
  assert.equal(await QuizAttempt.countDocuments({ session: session.sessionId }), 1);
  const repeated = await submit({ ...args, answers: null, submittedRevision: -1 });
  assert.deepEqual(repeated, first);
});

test("replay survives TTL removal, Disable and Archive without requiring the session", async () => {
  const { quiz, args, session } = await ready();
  const saved = await submit(args);
  await QuizSession.deleteOne({ _id: session.sessionId });
  await revisions.changeAvailability(quiz._id, "disable");
  assert.equal((await submit({ ...args, answers: [1, 1] })).attemptId, saved.attemptId);
  await revisions.changeAvailability(quiz._id, "archive");
  assert.deepEqual(await submit({ ...args, answers: [1, 1] }), saved);
  assert.deepEqual(await result({ attemptId: saved.attemptId, user: args.user }), saved);
  assert.equal((await history({ user: args.user, quizId: quiz._id }))[0].attemptId, saved.attemptId);
});

test("forged Quiz ID or another user's session never reveals a saved result", async () => {
  const { args } = await ready();
  await submit(args);
  await assert.rejects(submit({ ...args, quizId: id() }), /review|unavailable/i);
  await assert.rejects(submit({ ...args, user: user() }), /session|unavailable/i);
});

test("attempt numbers advance from the highest persisted number, not the count", async () => {
  const { quiz, learner, args } = await ready();
  const first = await submit(args);
  assert.equal(first.attemptNumber, 1);
  await QuizAttempt.collection.updateOne({ _id: new mongoose.Types.ObjectId(first.attemptId) }, { $set: { attemptNumber: 3 } });
  const next = await start({ quizId: quiz._id, user: learner });
  const second = await submit({ ...args, sessionId: next.sessionId, answers: [0, 0] });
  assert.equal(second.attemptNumber, 4);
  assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id, user: learner.id }), 2);
});

test("duplicate-key and transient conflicts retry with fresh transactional state", async () => {
  const first = await ready();
  const originalCreate = QuizAttempt.create; let duplicate = true;
  const saved = await withReplacement(QuizAttempt, "create", async function oneDuplicate(...args) {
    if (duplicate) { duplicate = false; throw Object.assign(new Error("injected duplicate"), { code: 11000 }); }
    return originalCreate.apply(this, args);
  }, () => submit(first.args));
  assert.equal(saved.attemptNumber, 1);
  const second = await ready({ quiz: first.quiz, learner: user() });
  const originalUpdate = Quiz.findOneAndUpdate; let transient = true;
  const recovered = await withReplacement(Quiz, "findOneAndUpdate", function oneConflict(...args) {
    if (transient) { transient = false; throw Object.assign(new Error("injected conflict"), { code: 112 }); }
    return originalUpdate.apply(this, args);
  }, () => submit(second.args));
  assert.equal(recovered.attemptNumber, 1);
  assert.equal(await QuizAttempt.countDocuments({ quiz: first.quiz._id }), 2);
});

test("an attempt-number collision is retried with the new highest persisted number", async () => {
  const { args } = await ready();
  const originalCreate = QuizAttempt.create; let injected = false;
  const saved = await withReplacement(QuizAttempt, "create", async function competingNumber(...values) {
    if (!injected) {
      injected = true;
      await QuizAttempt.collection.insertOne({ _id: id(), quiz: args.quizId, user: args.user.id,
        session: id(), attemptNumber: 1, answers: [0, 0], score: 2, total: 2,
        createdAt: new Date(), updatedAt: new Date() });
      throw Object.assign(new Error("injected attempt-number collision"), { code: 11000 });
    }
    return originalCreate.apply(this, values);
  }, () => submit(args));
  assert.equal(saved.attemptNumber, 2);
  assert.equal(await QuizAttempt.countDocuments({ quiz: args.quizId, user: args.user.id }), 2);
});

test("an ambiguous commit resolves from the saved attempt rather than inserting again", async () => {
  const { args, session } = await ready();
  const originalStartSession = mongoose.startSession; let injected = false;
  const saved = await withReplacement(mongoose, "startSession", async function ambiguous(...args) {
    const transaction = await originalStartSession.apply(this, args);
    const originalCommit = transaction.commitTransaction.bind(transaction);
    transaction.commitTransaction = async () => {
      await originalCommit();
      if (!injected) {
        injected = true;
        const error = new Error("injected ambiguous commit");
        error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
        throw error;
      }
    };
    return transaction;
  }, () => submit(args));
  assert.equal(injected, true);
  assert.equal(await QuizAttempt.countDocuments({ session: session.sessionId }), 1);
  assert.equal((await submit(args)).attemptId, saved.attemptId);
});

test("unresolved ambiguous commit reports unknown outcome without blind reinsertion", async () => {
  const { args, session } = await ready();
  const originalStartSession = mongoose.startSession;
  await assert.rejects(withReplacement(mongoose, "startSession", async function unknownCommit(...values) {
    const transaction = await originalStartSession.apply(this, values);
    transaction.commitTransaction = async () => {
      const error = new Error("injected unknown outcome");
      error.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
      throw error;
    };
    return transaction;
  }, () => submit(args)), /may have completed/i);
  assert.equal(await QuizAttempt.countDocuments({ session: session.sessionId }), 0);
  assert.equal((await QuizSession.findById(session.sessionId)).activeSlot, true);
});

test("submission-first deletion rejects permanent deletion and preserves the attempt", async () => {
  const { quiz, args } = await ready();
  await pauseOnce(QuizAttempt, "create", async ({ entered, release }) => {
    const submitting = submit(args);
    await entered;
    const deleting = revisions.deleteDraftOrQuiz(quiz._id);
    release();
    const saved = await submitting;
    await assert.rejects(deleting, /student results/);
    assert.ok(await Quiz.findById(quiz._id));
    assert.ok(await QuizAttempt.findById(saved.attemptId));
  });
});

test("deletion-first submission cannot create an attempt for a deleted Quiz", async () => {
  const { quiz, args } = await ready();
  await pauseOnce(Quiz, "deleteOne", async ({ entered, release }) => {
    const deleting = revisions.deleteDraftOrQuiz(quiz._id);
    await entered;
    const submitting = submit(args);
    release();
    assert.deepEqual(await deleting, { deleted: true });
    await assert.rejects(submitting, /unavailable/i);
    assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 0);
  });
});

for (const action of ["disable", "archive"]) {
  test(`${action}-first rejects a concurrent new submission without consuming its session`, async () => {
    const { quiz, args, session } = await ready();
    await pauseOnce(QuizSession, "updateMany", async ({ entered, release }) => {
      const changing = revisions.changeAvailability(quiz._id, action);
      await entered;
      const submitting = submit(args);
      release();
      await changing;
      await assert.rejects(submitting, /unavailable|session/i);
    });
    assert.equal(await QuizAttempt.countDocuments({ quiz: quiz._id }), 0);
    assert.ok((await QuizSession.findById(session.sessionId)).invalidatedAt);
  });
  test(`submission-first remains replayable after ${action}`, async () => {
    const { quiz, args } = await ready();
    await pauseOnce(QuizAttempt, "create", async ({ entered, release }) => {
      const submitting = submit(args);
      await entered;
      const changing = revisions.changeAvailability(quiz._id, action);
      release();
      const saved = await submitting;
      await changing;
      assert.equal((await submit({ ...args, answers: [1, 1] })).attemptId, saved.attemptId);
    });
  });
}

test("published edits do not change older snapshot grading or saved review", async () => {
  const { quiz, learner, args } = await ready();
  await revisions.saveDraft(quiz._id, 0, { questions: [{ ...question("New first"), correctAnswer: 1 }, question("New second")] });
  await revisions.publishDraft(quiz._id, 1);
  const saved = await submit(args);
  assert.equal(saved.score, 1);
  assert.equal(saved.review[0].prompt, "First question");
  assert.equal(saved.review[0].correctAnswer, 0);
  const newer = await start({ quizId: quiz._id, user: learner });
  assert.equal(newer.revision, 2);
  assert.equal((await result({ attemptId: saved.attemptId, user: learner })).review[0].prompt, "First question");
});

test("media remains protected across session-to-attempt transition and TTL deletion", async () => {
  const created = await revisions.createDraft(draft([question()]));
  const questionId = created.draft.questions[0]._id;
  const publicId = `arun_thai/quiz_media/images/${id()}`;
  const url = "https://res.cloudinary.com/example/image/upload/owned.webp";
  const media = await QuizMedia.create({ quiz: created._id, questionId, mediaType: "image",
    publicId, resourceType: "image", url });
  await revisions.saveDraft(created._id, 1, { questions: [{ ...question(), _id: questionId,
    image: url, imagePublicId: publicId }] });
  const quiz = await revisions.publishDraft(created._id, 2);
  const { args, session } = await ready({ quiz, answers: [0] });
  const lifecycle = require("../services/quizMediaLifecycle");
  const cloudinary = require("../config/cloudinary"); let destroyed = 0;
  await withReplacement(cloudinary.uploader, "destroy", async () => { destroyed += 1; return { result: "ok" }; }, async () => {
    await pauseOnce(QuizAttempt, "create", async ({ entered, release }) => {
      const submitting = submit(args);
      await entered;
      assert.equal(await lifecycle.cleanupQuizMedia(media), false, "active session protects before attempt commit");
      release();
      const saved = await submitting;
      assert.equal((await QuizAttempt.findById(saved.attemptId)).submissionSnapshot.questions[0].image.publicId, publicId);
    });
    await revisions.saveDraft(quiz._id, 0, { questions: [question()] });
    await revisions.publishDraft(quiz._id, 1);
    assert.equal(await lifecycle.cleanupQuizMedia(media), false, "committed attempt protects historical media");
    await QuizSession.deleteOne({ _id: session.sessionId });
    assert.equal(await lifecycle.cleanupQuizMedia(media), false, "attempt protects after session TTL removal");
  });
  assert.equal(destroyed, 0);
  assert.equal((await QuizMedia.findById(media._id)).cleanupState, "active");
});

test("history retains every result after Disable and Archive and excludes Course attempts", async () => {
  const { quiz, learner, args } = await ready();
  const first = await submit(args);
  const next = await start({ quizId: quiz._id, user: learner });
  const second = await submit({ ...args, sessionId: next.sessionId, answers: [0, 0] });
  await QuizAttempt.create({ quiz: id(), user: learner.id, attemptNumber: 1,
    answers: [0], score: 1, total: 1,
    submissionSnapshot: { contextType: "course_final", quizTitle: "Private Final", quizRevision: 1,
      score: 1, total: 1, questions: [] } });
  await revisions.changeAvailability(quiz._id, "archive");
  const records = await history({ user: learner, quizId: quiz._id });
  assert.deepEqual(new Set(records.map((item) => item.attemptId)), new Set([first.attemptId, second.attemptId]));
  assert.deepEqual(records.map((item) => item.attemptNumber).sort(), [1, 2]);
  assert.equal((await history({ user: learner })).length, 2);
  assert.equal((await history({ user: user() })).length, 0);
});

test("existing public Course routes remain closed to standalone runtime", async () => {
  const { args } = await ready();
  const { startQuizSession } = require("../services/quizSessionService");
  const { submitQuiz } = require("../services/quizRuntime");
  await assert.rejects(startQuizSession({ quizId: args.quizId, user: args.user }), /unavailable/i);
  await assert.rejects(submitQuiz(args), /unavailable/i);
});
