const assert = require("node:assert/strict");
const { test } = require("node:test");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { getTrustedUrls, buildVerificationUrl, buildPasswordResetUrl } = require("../config/trustedUrls");

const backendDirectory = path.resolve(__dirname, "..");
const trustedProductionEnv = {
  NODE_ENV: "production",
  BACKEND_URL: "https://api.example.test/",
  FRONTEND_URL_PROD: "https://student.example.test/",
};

function startupOutput(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["server.js"], {
      cwd: backendDirectory,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, output }));
  });
}

test("trusted production origins are normalized and require HTTPS", () => {
  const urls = getTrustedUrls(trustedProductionEnv);
  assert.equal(urls.backendUrl, "https://api.example.test");
  assert.equal(urls.frontendUrl, "https://student.example.test");
  assert.throws(
    () => getTrustedUrls({ ...trustedProductionEnv, BACKEND_URL: "ftp://api.example.test" }),
    /must use HTTP or HTTPS/
  );
  assert.throws(
    () => getTrustedUrls({ ...trustedProductionEnv, BACKEND_URL: "http://api.example.test" }),
    /must use HTTPS in production/
  );
  assert.throws(
    () => getTrustedUrls({ ...trustedProductionEnv, BACKEND_URL: "https://api.example.test/path" }),
    /must be an origin/
  );
  assert.throws(
    () => getTrustedUrls({ ...trustedProductionEnv, BACKEND_URL: "not a URL" }),
    /must be a valid absolute URL/
  );
  assert.deepEqual(getTrustedUrls({ NODE_ENV: "development" }), {
    backendUrl: "http://localhost:3000",
    frontendUrl: "http://localhost:5173",
    adminUrl: null,
  });
});

test("host and forwarded-host headers cannot alter verification or reset links", () => {
  const hostileRequest = {
    protocol: "https",
    headers: {
      host: "attacker.example.test",
      "x-forwarded-host": "attacker.example.test",
      origin: "https://attacker.example.test",
    },
    get: () => "attacker.example.test",
  };

  assert.equal(
    buildVerificationUrl("verification-token", trustedProductionEnv, hostileRequest),
    "https://api.example.test/auth/verify-email?token=verification-token"
  );
  assert.equal(
    buildPasswordResetUrl("reset-token", trustedProductionEnv, hostileRequest),
    "https://student.example.test/reset-password/reset-token"
  );
});

test("production startup fails when BACKEND_URL is missing or invalid", async () => {
  const baseEnv = {
    ...process.env,
    NODE_ENV: "production",
    FRONTEND_URL_PROD: "https://student.example.test",
    MONGO_DB: "mongodb://127.0.0.1:1/not-used",
    JWT_SECRET: "test-secret",
  };
  delete baseEnv.BACKEND_URL;

  const missing = await startupOutput(baseEnv);
  assert.notEqual(missing.code, 0);
  assert.match(missing.output, /BACKEND_URL must be explicitly configured in production/);

  const invalid = await startupOutput({ ...baseEnv, BACKEND_URL: "http://api.example.test" });
  assert.notEqual(invalid.code, 0);
  assert.match(invalid.output, /BACKEND_URL must use HTTPS in production/);
});
