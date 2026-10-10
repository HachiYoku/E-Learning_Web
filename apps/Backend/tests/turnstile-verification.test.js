const assert = require("node:assert/strict");
const { test } = require("node:test");
const { verifyRegistrationTurnstile } = require("../services/turnstileVerification");

const secretKey = "test-only-secret";
const hostnameConfig = "arunthaiedu.com,student.example.test";
const valid = { success: true, action: "register", hostname: "arunthaiedu.com" };

function siteverify(result, status = 200) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: status === 200, json: async () => result };
  };
  return { calls, fetchImpl };
}

test("valid registration token is verified server-side with the configured secret", async () => {
  const mock = siteverify(valid);
  const result = await verifyRegistrationTurnstile("token", { secretKey, hostnameConfig, fetchImpl: mock.fetchImpl });
  assert.deepEqual(result, { ok: true });
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  assert.equal(mock.calls[0].options.method, "POST");
  assert.equal(mock.calls[0].options.body.get("secret"), secretKey);
  assert.equal(mock.calls[0].options.body.get("response"), "token");
  assert.ok(mock.calls[0].options.signal);
});

test("missing or oversized token never calls Siteverify", async () => {
  const mock = siteverify(valid);
  for (const token of [undefined, "", "x".repeat(2049)]) {
    assert.deepEqual(await verifyRegistrationTurnstile(token, { secretKey, hostnameConfig, fetchImpl: mock.fetchImpl }), { ok: false, reason: "invalid" });
  }
  assert.equal(mock.calls.length, 0);
});

test("invalid, expired, and replayed tokens are rejected", async () => {
  for (const code of ["invalid-input-response", "timeout-or-duplicate"]) {
    const mock = siteverify({ success: false, "error-codes": [code] });
    assert.deepEqual(await verifyRegistrationTurnstile("token", { secretKey, hostnameConfig, fetchImpl: mock.fetchImpl }), { ok: false, reason: "invalid" });
  }
});

test("wrong action or hostname is rejected even after Cloudflare reports success", async () => {
  for (const result of [{ ...valid, action: "login" }, { ...valid, hostname: "other.example.test" }, { ...valid, hostname: undefined }]) {
    const mock = siteverify(result);
    assert.deepEqual(await verifyRegistrationTurnstile("token", { secretKey, hostnameConfig, fetchImpl: mock.fetchImpl }), { ok: false, reason: "invalid" });
  }
});

test("network, timeout, malformed response, and Cloudflare service errors fail closed", async () => {
  const failures = [
    async () => { throw new Error("network or timeout"); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new Error("invalid JSON"); } }),
    siteverify({ success: false, "error-codes": ["internal-error"] }).fetchImpl,
  ];
  for (const fetchImpl of failures) {
    assert.deepEqual(await verifyRegistrationTurnstile("token", { secretKey, hostnameConfig, fetchImpl }), { ok: false, reason: "unavailable" });
  }
});

test("missing secret or unsafe hostname configuration fails closed without a request", async () => {
  const mock = siteverify(valid);
  for (const [secret, hosts] of [["", hostnameConfig], [secretKey, ""], [secretKey, "*.vercel.app"], [secretKey, "https://arunthaiedu.com"]]) {
    assert.deepEqual(await verifyRegistrationTurnstile("token", { secretKey: secret, hostnameConfig: hosts, fetchImpl: mock.fetchImpl }), { ok: false, reason: "unavailable" });
  }
  assert.equal(mock.calls.length, 0);
});
