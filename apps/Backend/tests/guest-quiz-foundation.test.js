const assert = require("node:assert/strict");
const { test, mock, afterEach } = require("node:test");
const mongoose = require("mongoose");
const security = require("../services/guestQuizSecurity");
const { assertGuestPublicQuiz } = require("../services/guestQuizAccess");
const { consumeGuestQuizRateLimit } = require("../services/guestQuizRateLimit");
const { inspectGuestQuizReadiness, sameIndex } = require("../services/guestQuizReadiness");
const GuestQuizSession = require("../models/guestQuizSessionModel");
const GuestQuizAttempt = require("../models/guestQuizAttemptModel");
const QuizAttempt = require("../models/quizAttemptModel");
const Quiz = require("../models/quizModel");
const { guestQuizHasDependencies, guestMediaIsProtected } = require("../services/guestQuizDependencies");
const { cleanupQuizMedia } = require("../services/quizMediaLifecycle");
const cloudinary = require("../config/cloudinary");

afterEach(() => mock.restoreAll());
const env = { NODE_ENV: "test", JWT_SECRET: "isolated-test-only-guest-secret", FRONTEND_URL_LOCAL: "http://localhost:5173" };
const now = Date.UTC(2026, 9, 17, 12);

test("signed guest credential is random, owner-scoped, tamper-resistant and renewable", () => {
  const a = security.createCredential({ env, now });
  const b = security.createCredential({ env, now });
  assert.notEqual(a.value, b.value);
  assert.notEqual(a.ownerHash, b.ownerHash);
  assert.equal(security.verifyCredential(a.value, { env, now })?.ownerHash, a.ownerHash);
  assert.equal(security.verifyCredential(a.value.slice(0, -1) + "x", { env, now }), null);
  const renewed = security.renewCredential(a.value, { env, now: now + 1000 });
  assert.equal(renewed.ownerHash, a.ownerHash);
  assert.equal(security.verifyCredential(a.value, { env, now: now + security.CREDENTIAL_MS }), null);
  assert.equal(security.verifyCredential(renewed.value, { env, now: now + security.CREDENTIAL_MS })?.ownerHash, a.ownerHash);
  assert.equal(security.verifyCredential(a.value, { env: { ...env, JWT_SECRET: "different-test-secret" }, now }), null);
});

test("guest cookies are host-only HttpOnly and secure in production; duplicate cookies fail closed", () => {
  const local = security.guestCookieConfig(env);
  const prod = security.guestCookieConfig({ ...env, NODE_ENV: "production" });
  assert.deepEqual([local.options.httpOnly, local.options.secure, local.options.sameSite, local.options.domain], [true, false, "lax", undefined]);
  assert.deepEqual([prod.name.startsWith("__Host-"), prod.options.secure, prod.options.sameSite, prod.options.path], [true, true, "none", "/"]);
  assert.equal(security.readGuestCookie(`${local.name}=one; other=value`, env), "one");
  assert.equal(security.readGuestCookie(`${local.name}=one; ${local.name}=two`, env), null);
  const first = security.credentialForGuestStart(null, { env, now });
  const second = security.credentialForGuestStart(`${local.name}=${first.value}`, { env, now: now + 1000 });
  assert.equal(second.ownerHash, first.ownerHash, "new attempts keep access to earlier results");
  let set;
  security.setGuestCookie({ cookie: (...args) => { set = args; } }, second, env);
  assert.equal(set[0], local.name);
  assert.equal(set[1], second.value);
  assert.equal(set[2].httpOnly, true);
});

test("guest writes require exact trusted Origin, custom header, JSON and no student bearer credential", () => {
  const request = { headers: { origin: "http://localhost:5173", "x-guest-quiz-request": "1", "content-type": "application/json" } };
  assert.equal(security.guestWriteAllowed(request, env), true);
  for (const change of [{ origin: "http://localhost:5175" }, { origin: undefined },
    { "x-guest-quiz-request": undefined }, { "content-type": "text/plain" }, { authorization: "Bearer student" }]) {
    assert.equal(security.guestWriteAllowed({ headers: { ...request.headers, ...change } }, env), false);
  }
});

test("ownership, invalidation and exact 24-hour lifetimes are enforced before use", async () => {
  const owner = "a".repeat(64);
  const startedAt = new Date(now);
  const submittedAt = new Date(now);
  const session = { ownerHash: owner, startedAt, expiresAt: new Date(now + security.SESSION_MS), activeSlot: true, invalidatedAt: null };
  const attempt = { ownerHash: owner, submittedAt, expiresAt: new Date(now + security.RESULT_MS) };
  assert.equal(security.guestSessionAvailable(session, owner, new Date(now + 1)), true);
  assert.equal(security.guestResultAvailable(attempt, owner, new Date(now + 1)), true);
  assert.equal(security.guestSessionAvailable(session, "b".repeat(64), new Date(now + 1)), false);
  assert.equal(security.guestResultAvailable(attempt, "b".repeat(64), new Date(now + 1)), false);
  assert.equal(security.guestSessionAvailable({ ...session, invalidatedAt: new Date() }, owner, new Date(now + 1)), false);
  assert.equal(security.guestSessionAvailable(session, owner, session.expiresAt), false);
  assert.equal(security.guestResultAvailable(attempt, owner, attempt.expiresAt), false);
  const quizId = new mongoose.Types.ObjectId();
  const validSession = new GuestQuizSession({ quiz: quizId, ownerHash: owner, revision: 1,
    snapshot: { questions: [] }, startedAt, expiresAt: session.expiresAt });
  await validSession.validate();
  validSession.expiresAt = new Date(now + security.SESSION_MS + 1);
  await assert.rejects(validSession.validate());
  const validAttempt = new GuestQuizAttempt({ quiz: quizId, session: new mongoose.Types.ObjectId(),
    ownerHash: owner, answers: [0], score: 1, total: 1, submissionSnapshot: { questions: [] },
    submittedAt, expiresAt: attempt.expiresAt });
  await validAttempt.validate();
  validAttempt.expiresAt = new Date(now + security.RESULT_MS + 1);
  await assert.rejects(validAttempt.validate());
});

test("guest authorization permits only current Public standalone quiz in its Active Set", () => {
  const setId = new mongoose.Types.ObjectId();
  const quiz = { contextType: "standalone", status: "published", standaloneAccess: "public",
    revision: 2, publishedRevision: 2, quizSet: setId };
  const set = { _id: setId, status: "active" };
  assert.equal(assertGuestPublicQuiz(quiz, set), quiz);
  for (const changed of [{ standaloneAccess: "students" }, { status: "disabled" },
    { contextType: "course_final" }, { revision: 3 }, { quizSet: null }]) {
    assert.throws(() => assertGuestPublicQuiz({ ...quiz, ...changed }, set));
  }
  assert.throws(() => assertGuestPublicQuiz(quiz, { ...set, status: "archived" }));
});

test("guest dependency checks block deletion when a temporary session or result exists", async () => {
  const quizId = new mongoose.Types.ObjectId();
  const query = (value) => ({ setOptions: () => Promise.resolve(value) });
  mock.method(GuestQuizSession, "exists", () => query({ _id: quizId }));
  assert.equal(await guestQuizHasDependencies(quizId, {}), true);
  GuestQuizSession.exists.mock.restore();
  mock.method(GuestQuizSession, "exists", () => query(null));
  mock.method(GuestQuizAttempt, "exists", () => query({ _id: quizId }));
  assert.equal(await guestQuizHasDependencies(quizId, {}), true);
});

test("live guest session or unexpired guest result prevents media destruction", async () => {
  mock.method(QuizAttempt, "exists", async () => null);
  mock.method(Quiz, "exists", async () => null);
  mock.method(GuestQuizSession, "exists", async () => ({ _id: 1 }));
  mock.method(GuestQuizAttempt, "exists", async () => null);
  const destroy = mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));
  assert.equal(await guestMediaIsProtected("owned/public-id"), true);
  assert.equal(await cleanupQuizMedia({ _id: new mongoose.Types.ObjectId(), publicId: "owned/public-id", cleanupState: "active" }), false);
  assert.equal(destroy.mock.callCount(), 0);
});

test("an unexpired guest result alone protects its snapshotted media", async () => {
  mock.method(GuestQuizSession, "exists", async () => null);
  mock.method(GuestQuizAttempt, "exists", async () => ({ _id: 1 }));
  assert.equal(await guestMediaIsProtected("owned/public-id"), true);
  assert.equal(GuestQuizAttempt.exists.mock.calls[0].arguments[0].$or[0]["submissionSnapshot.questions.image.publicId"], "owned/public-id");
});

test("guest rate limiter and runtime readiness fail closed without verified distributed indexes", async () => {
  const ownerHash = "a".repeat(64);
  await assert.rejects(consumeGuestQuizRateLimit({ ownerHash, ip: "127.0.0.1", operation: "start",
    connection: { readyState: 0 }, env }));
  const db = { databaseName: "isolated_test", listCollections: () => ({ toArray: async () => [] }) };
  await assert.rejects(consumeGuestQuizRateLimit({ ownerHash, ip: "127.0.0.1", operation: "start",
    connection: { readyState: 1, db }, env }));
  assert.deepEqual(await inspectGuestQuizReadiness({ connection: { readyState: 1, db }, env: { ...env,
    STANDALONE_QUIZ_EXPECTED_DB: "isolated_test" } }), { ready: false, reason: "disabled" });
  assert.deepEqual(await inspectGuestQuizReadiness({ connection: { readyState: 1, db }, env: { ...env,
    GUEST_QUIZ_RUNTIME_ENABLED: "true", STANDALONE_QUIZ_EXPECTED_DB: "isolated_test" } }),
  { ready: false, reason: "indexes_unverified" });
});

test("production guest readiness requires explicit trusted-proxy verification", async () => {
  const db = { databaseName: "arunthai" };
  assert.deepEqual(await inspectGuestQuizReadiness({ connection: { readyState: 1, db },
    env: { NODE_ENV: "production", JWT_SECRET: "isolated-test-only-secret",
      GUEST_QUIZ_RUNTIME_ENABLED: "true", STANDALONE_QUIZ_EXPECTED_DB: "arunthai",
      TRUST_PROXY: "true", BACKEND_URL: "https://api.example.test",
      FRONTEND_URL_PROD: "https://student.example.test" } }),
  { ready: false, reason: "invalid_configuration" });
});

test("readiness matches explicit index definitions and unnamed lookup indexes", () => {
  assert.equal(sameIndex({ name: "quiz_1_expiresAt_1", key: { quiz: 1, expiresAt: 1 } },
    { quiz: 1, expiresAt: 1 }, {}), true);
  assert.equal(sameIndex({ name: "one_guest_attempt_per_session", key: { session: 1 }, unique: true },
    { session: 1 }, { name: "one_guest_attempt_per_session", unique: true }), true);
  assert.equal(sameIndex({ name: "one_guest_attempt_per_session", key: { session: 1 } },
    { session: 1 }, { name: "one_guest_attempt_per_session", unique: true }), false);
});

test("distributed guest rate window denies a saturated key and rejects uncertain storage writes", async () => {
  const ownerHash = "a".repeat(64);
  const expiresAt = new Date(15 * 60 * 1000);
  let failWrite = false;
  let writeCount = 0;
  const collection = {
    listIndexes: () => ({ toArray: async () => [
      { name: "one_guest_quiz_rate_window", key: { keyHash: 1, operation: 1, windowStart: 1 }, unique: true },
      { name: "guest_quiz_rate_window_expiry", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
    ] }),
    findOne: async () => failWrite ? null : { _id: 1, count: 20, expiresAt },
    insertOne: async () => { writeCount += 1; throw new Error("uncertain write"); },
  };
  const db = {
    listCollections: () => ({ toArray: async () => [{ name: "guestquizratewindows" }] }),
    collection: () => collection,
    admin: () => ({ command: async () => ({ localTime: new Date(1000) }) }),
  };
  const input = { ownerHash, ip: "127.0.0.1", operation: "start", connection: { readyState: 1, db }, env };
  const result = await consumeGuestQuizRateLimit(input);
  assert.equal(result.allowed, false);
  assert.equal(writeCount, 0);
  failWrite = true;
  await assert.rejects(consumeGuestQuizRateLimit(input), /uncertain write/);
  assert.equal(writeCount, 1);
});

test("IP saturation blocks new guest identities even when their owner window is fresh", async () => {
  let reads = 0;
  let inserts = 0;
  const collection = {
    listIndexes: () => ({ toArray: async () => [
      { name: "one_guest_quiz_rate_window", key: { keyHash: 1, operation: 1, windowStart: 1 }, unique: true },
      { name: "guest_quiz_rate_window_expiry", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
    ] }),
    findOne: async () => { reads += 1; return reads === 1 ? null
      : { count: 20, expiresAt: new Date(15 * 60 * 1000) }; },
    insertOne: async () => { inserts += 1; },
  };
  const db = {
    listCollections: () => ({ toArray: async () => [{ name: "guestquizratewindows" }] }),
    collection: () => collection,
    admin: () => ({ command: async () => ({ localTime: new Date(1000) }) }),
  };
  const result = await consumeGuestQuizRateLimit({ ownerHash: "a".repeat(64), ip: "127.0.0.1",
    operation: "start", connection: { readyState: 1, db }, env });
  assert.equal(result.allowed, false);
  assert.equal(inserts, 1);
  assert.equal(reads, 2);
});
