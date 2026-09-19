const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const backendDirectory = path.resolve(__dirname, "..");
const projectDirectory = path.resolve(backendDirectory, "..", "..");
const jwtSecret = "auth-security-test-secret-only-not-for-production";
let mongoDirectory;
let mongoProcess;
let apiProcess;
let apiBaseUrl;
let mongoUri;
let User;
let RefreshSession;

const password = "CorrectHorseBattery1";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function waitForOutput(child, text) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${text}`)), 15000);
    const onData = (chunk) => {
      if (chunk.toString().includes(text)) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Process exited before ready (${code})`));
    });
  });
}

function cookieValue(response) {
  const setCookie = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()[0]
    : response.headers.get("set-cookie");
  assert.ok(setCookie, "expected a refresh Set-Cookie header");
  return setCookie.split(";", 1)[0];
}

async function request(route, { method = "GET", body, cookie, token, origin } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;
  return fetch(`${apiBaseUrl}${route}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function responseJson(response) {
  return response.json().catch(() => null);
}

async function createUser({ email, role = "user" }) {
  return User.create({
    name: email.split("@")[0],
    email,
    password: await bcrypt.hash(password, 10),
    role,
    isActive: true,
    isVerified: true,
  });
}

async function login(email) {
  const response = await request("/auth/login", { method: "POST", body: { email, password }, origin: "https://student.example.test" });
  assert.equal(response.status, 200);
  return { response, body: await responseJson(response), cookie: cookieValue(response) };
}

before(async () => {
  const mongoPort = await freePort();
  const apiPort = await freePort();
  mongoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-auth-test-"));
  mongoUri = `mongodb://127.0.0.1:${mongoPort}/auth_security_test`;

  mongoProcess = spawn("mongod", ["--port", String(mongoPort), "--dbpath", mongoDirectory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await waitForOutput(mongoProcess, "Waiting for connections");

  apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  apiProcess = spawn(process.execPath, ["server.js"], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(apiPort),
      MONGO_DB: mongoUri,
      JWT_SECRET: jwtSecret,
      ACCESS_TOKEN_TTL: "15m",
      REFRESH_TOKEN_TTL_DAYS: "1",
      FRONTEND_URL_PROD: "https://student.example.test",
      ADMIN_URL_PROD: "https://admin.example.test",
      TRUST_PROXY: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForOutput(apiProcess, "Example app listening");

  await mongoose.connect(mongoUri);
  User = require("../models/userModel");
  RefreshSession = require("../models/refreshSessionModel");
});

after(async () => {
  await mongoose.disconnect();
  apiProcess?.kill("SIGTERM");
  mongoProcess?.kill("SIGTERM");
  if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true });
});

test("access tokens are not persisted in localStorage", async () => {
  const studentStorage = await fs.readFile(path.join(projectDirectory, "apps/Frontend/src/api/tokenStorage.js"), "utf8");
  const adminStorage = await fs.readFile(path.join(projectDirectory, "apps/admin/src/api/tokenStorage.js"), "utf8");
  assert.doesNotMatch(studentStorage, /localStorage/);
  assert.doesNotMatch(adminStorage, /localStorage/);
});

test("login works and production refresh cookie has secure flags", async () => {
  await createUser({ email: "login@example.test" });
  const result = await login("login@example.test");
  assert.ok(result.body.accessToken);
  const setCookie = result.response.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=None/i);
  assert.match(setCookie, /Path=\/auth/i);
});

test("refresh restores a reloaded session and rotates its token", async () => {
  await createUser({ email: "reload@example.test" });
  const loginResult = await login("reload@example.test");
  const refreshResponse = await request("/auth/refresh", { method: "POST", cookie: loginResult.cookie, origin: "https://student.example.test" });
  assert.equal(refreshResponse.status, 200);
  const refreshed = await responseJson(refreshResponse);
  assert.ok(refreshed.accessToken);
  const rotatedCookie = cookieValue(refreshResponse);
  assert.notEqual(rotatedCookie, loginResult.cookie);
});

test("expired access tokens can be replaced and the protected request retried", async () => {
  const user = await createUser({ email: "expiry@example.test" });
  const loginResult = await login("expiry@example.test");
  const expiredAccessToken = jwt.sign(
    { id: user._id, role: "user", sessionVersion: user.sessionVersion || 0 },
    jwtSecret,
    { expiresIn: -1 }
  );
  const rejected = await request("/auth/me", { token: expiredAccessToken, origin: "https://student.example.test" });
  assert.equal(rejected.status, 401);
  const refreshResponse = await request("/auth/refresh", { method: "POST", cookie: loginResult.cookie, origin: "https://student.example.test" });
  const refreshed = await responseJson(refreshResponse);
  const retried = await request("/auth/me", { token: refreshed.accessToken, origin: "https://student.example.test" });
  assert.equal(retried.status, 200);
});

test("rotated refresh tokens cannot be reused", async () => {
  await createUser({ email: "rotation@example.test" });
  const loginResult = await login("rotation@example.test");
  const firstRefresh = await request("/auth/refresh", { method: "POST", cookie: loginResult.cookie, origin: "https://student.example.test" });
  assert.equal(firstRefresh.status, 200);
  const reused = await request("/auth/refresh", { method: "POST", cookie: loginResult.cookie, origin: "https://student.example.test" });
  assert.equal(reused.status, 401);
});

test("logout revokes the refresh session", async () => {
  await createUser({ email: "logout@example.test" });
  const loginResult = await login("logout@example.test");
  const logoutResponse = await request("/auth/logout", { method: "POST", cookie: loginResult.cookie, origin: "https://student.example.test" });
  assert.equal(logoutResponse.status, 204);
  const refreshResponse = await request("/auth/refresh", { method: "POST", cookie: loginResult.cookie, origin: "https://student.example.test" });
  assert.equal(refreshResponse.status, 401);
});

test("account deactivation invalidates existing access and refresh sessions", async () => {
  const student = await createUser({ email: "deactivate@example.test" });
  const admin = await createUser({ email: "deactivate-admin@example.test", role: "admin" });
  const studentLogin = await login(student.email);
  const adminLogin = await login(admin.email);
  const statusResponse = await request(`/user/${student._id}/status`, {
    method: "PUT",
    token: adminLogin.body.accessToken,
    body: { isActive: false, adminPassword: password },
    origin: "https://admin.example.test",
  });
  assert.equal(statusResponse.status, 200);
  assert.equal((await request("/auth/me", { token: studentLogin.body.accessToken, origin: "https://student.example.test" })).status, 401);
  assert.equal((await request("/auth/refresh", { method: "POST", cookie: studentLogin.cookie, origin: "https://student.example.test" })).status, 401);
});

test("password reset invalidates existing sessions", async () => {
  const user = await createUser({ email: "reset@example.test" });
  const loginResult = await login(user.email);
  const rawResetToken = "password-reset-test-token";
  user.resetToken = require("crypto").createHash("sha256").update(rawResetToken).digest("hex");
  user.resetTokenExpire = new Date(Date.now() + 60_000);
  await user.save();
  const resetResponse = await request(`/auth/reset-password/${rawResetToken}`, {
    method: "POST",
    body: { password: "NewCorrectHorseBattery2" },
    origin: "https://student.example.test",
  });
  assert.equal(resetResponse.status, 200);
  assert.equal((await request("/auth/me", { token: loginResult.body.accessToken, origin: "https://student.example.test" })).status, 401);
  assert.equal((await request("/auth/refresh", { method: "POST", cookie: loginResult.cookie, origin: "https://student.example.test" })).status, 401);
});

test("removing an admin role blocks privileged APIs immediately", async () => {
  const admin = await createUser({ email: "role@example.test", role: "admin" });
  const loginResult = await login(admin.email);
  admin.role = "user";
  await admin.save();
  assert.equal((await request("/reports/summary", { token: loginResult.body.accessToken, origin: "https://admin.example.test" })).status, 401);
  const userLogin = await login(admin.email);
  assert.equal((await request("/reports/summary", { token: userLogin.body.accessToken, origin: "https://admin.example.test" })).status, 403);
});

test("normal users cannot call admin APIs", async () => {
  await createUser({ email: "student-admin-api@example.test" });
  const loginResult = await login("student-admin-api@example.test");
  assert.equal((await request("/reports/summary", { token: loginResult.body.accessToken, origin: "https://student.example.test" })).status, 403);
});

test("invalid and expired refresh tokens are rejected", async () => {
  const invalid = await request("/auth/refresh", { method: "POST", cookie: "refresh_token=not-a-real-token", origin: "https://student.example.test" });
  assert.equal(invalid.status, 401);
  const user = await createUser({ email: "expired-refresh@example.test" });
  const loginResult = await login(user.email);
  const tokenValue = loginResult.cookie.split("=", 2)[1];
  const hash = require("crypto").createHash("sha256").update(tokenValue).digest("hex");
  await RefreshSession.updateOne({ tokenHash: hash }, { $set: { expiresAt: new Date(Date.now() - 1_000) } });
  const expired = await request("/auth/refresh", { method: "POST", cookie: loginResult.cookie, origin: "https://student.example.test" });
  assert.equal(expired.status, 401);
});

test("CORS rejects unauthorized origins", async () => {
  const response = await request("/", { origin: "https://attacker.example.test" });
  assert.equal(response.status, 403);
});
