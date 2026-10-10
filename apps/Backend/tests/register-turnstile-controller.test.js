const assert = require("node:assert/strict");
const { test } = require("node:test");

const userPath = require.resolve("../models/userModel");
const emailPath = require.resolve("../services/sendEmail");
const verificationPath = require.resolve("../services/turnstileVerification");
const { verifyRegistrationTurnstile } = require(verificationPath);
let lookups = 0;
let creations = 0;
let emails = 0;
let verificationResult = { ok: false, reason: "invalid" };

require.cache[userPath] = { id: userPath, filename: userPath, loaded: true, exports: {
  findOne: async () => { lookups += 1; return null; },
  create: async () => { creations += 1; },
} };
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: async () => { emails += 1; } };
require.cache[verificationPath] = { id: verificationPath, filename: verificationPath, loaded: true, exports: {
  verifyRegistrationTurnstile: async () => verificationResult,
} };

const { register } = require("../controllers/authController");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("rejected Turnstile verification never looks up or creates a user or sends email", async () => {
  for (const reason of ["invalid", "unavailable"]) {
    lookups = 0; creations = 0; emails = 0;
    verificationResult = { ok: false, reason };
    const res = response();
    await register({ body: {
      name: "Student", email: "student@example.test", password: "CorrectHorseBattery1",
      ageGroup: "18_plus", ageConfirmed: true, turnstileToken: "test-token",
    } }, res);
    assert.equal(res.statusCode, reason === "unavailable" ? 503 : 400);
    assert.equal(lookups, 0);
    assert.equal(creations, 0);
    assert.equal(emails, 0);
  }
});

test("a Siteverify timeout aborts and cannot create a user or send email", async () => {
  const originalTimeout = AbortSignal.timeout;
  let aborted = false;
  lookups = 0; creations = 0; emails = 0;
  AbortSignal.timeout = (milliseconds) => {
    assert.equal(milliseconds, 5000);
    return originalTimeout(1);
  };
  // AbortSignal.timeout uses an unref'd timer; keep the test process alive until it fires.
  const keepAlive = setTimeout(() => {}, 50);
  try {
    verificationResult = verifyRegistrationTurnstile("test-token", {
      secretKey: "test-only-secret",
      hostnameConfig: "student.example.test",
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(signal.reason);
        }, { once: true });
      }),
    });
    const res = response();
    await register({ body: {
      name: "Student", email: "student@example.test", password: "CorrectHorseBattery1",
      ageGroup: "18_plus", ageConfirmed: true, turnstileToken: "test-token",
    } }, res);
    assert.equal(aborted, true);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, "TURNSTILE_UNAVAILABLE");
    assert.equal(lookups, 0);
    assert.equal(creations, 0);
    assert.equal(emails, 0);
  } finally {
    clearTimeout(keepAlive);
    AbortSignal.timeout = originalTimeout;
  }
});
