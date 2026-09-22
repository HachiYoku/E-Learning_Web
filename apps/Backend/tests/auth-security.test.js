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
const { issuePaymentProofAccessToken, verifyPaymentProofAccessToken } = require("../services/paymentProofAccess");

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
let Payment;
let Course;
let Enrollment;
let Notification;

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
    let output = "";
    const appendOutput = (chunk) => { output = `${output}${chunk}`.slice(-4000); };
    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.stderr.off("data", appendOutput);
      child.off("exit", onExit);
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${text}. Process output: ${output || "<none>"}`));
    }, 15000);
    const onData = (chunk) => {
      appendOutput(chunk);
      if (chunk.toString().includes(text)) {
        cleanup();
        resolve();
      }
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`Process exited before ready (${code}). Process output: ${output || "<none>"}`));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", appendOutput);
    child.once("exit", onExit);
  });
}

function stopProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();

    const forceStopTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("exit", () => {
      clearTimeout(forceStopTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

function cookieValue(response) {
  const setCookie = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()[0]
    : response.headers.get("set-cookie");
  assert.ok(setCookie, "expected a refresh Set-Cookie header");
  return setCookie.split(";", 1)[0];
}

async function request(route, { method = "GET", body, cookie, token, origin, portal } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;
  if (portal) headers["X-Auth-Portal"] = portal;
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

async function readJavaScriptFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readJavaScriptFiles(entryPath);
    if (/\.(js|jsx)$/.test(entry.name)) return fs.readFile(entryPath, "utf8");
    return [];
  }));
  return contents.flat();
}

async function login(email, { portal } = {}) {
  const response = await request("/auth/login", { method: "POST", body: { email, password }, origin: "https://student.example.test", portal });
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
      BACKEND_URL: "https://api.example.test",
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
  Payment = require("../models/paymentModel");
  Course = require("../models/courseModel");
  Enrollment = require("../models/enrollmentModel");
  Notification = require("../models/notificationModel");
});

after(async () => {
  await mongoose.disconnect();
  await Promise.all([stopProcess(apiProcess), stopProcess(mongoProcess)]);
  if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test("access tokens are not persisted in localStorage", async () => {
  const studentStorage = await fs.readFile(path.join(projectDirectory, "apps/Frontend/src/api/tokenStorage.js"), "utf8");
  const adminStorage = await fs.readFile(path.join(projectDirectory, "apps/admin/src/api/tokenStorage.js"), "utf8");
  assert.doesNotMatch(studentStorage, /localStorage/);
  assert.doesNotMatch(adminStorage, /localStorage/);
});

test("admin source has no persistent auth/user storage writes", async () => {
  const adminSources = (await readJavaScriptFiles(path.join(projectDirectory, "apps/admin/src"))).join("\n");
  assert.doesNotMatch(adminSources, /(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|getItem)/);
  assert.doesNotMatch(adminSources, /indexedDB/);
  assert.match(adminSources, /localStorage\.removeItem\(key\)/);
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

test("student and admin portals keep independent refresh sessions", async () => {
  await createUser({ email: "portal-student@example.test" });
  await createUser({ email: "portal-admin@example.test", role: "admin" });
  const student = await login("portal-student@example.test", { portal: "student" });
  const admin = await login("portal-admin@example.test", { portal: "admin" });
  assert.match(student.response.headers.get("set-cookie"), /student_refresh_token=/);
  assert.match(admin.response.headers.get("set-cookie"), /admin_refresh_token=/);

  const studentRefresh = await request("/auth/refresh", { method: "POST", cookie: student.cookie, portal: "student" });
  const adminRefresh = await request("/auth/refresh", { method: "POST", cookie: admin.cookie, portal: "admin" });
  assert.equal(studentRefresh.status, 200);
  assert.equal(adminRefresh.status, 200);
  assert.equal(jwt.decode((await responseJson(studentRefresh)).accessToken).role, "user");
  assert.equal(jwt.decode((await responseJson(adminRefresh)).accessToken).role, "admin");
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

test("course deletion requires the current admin password", async () => {
  const admin = await createUser({ email: "course-delete-admin@example.test", role: "admin" });
  const student = await createUser({ email: "course-delete-student@example.test" });
  const course = await Course.create({ title: "Protected deletion course", price: 100, createdBy: admin._id });
  await Enrollment.create({ userId: student._id, courseId: course._id });
  const payment = await Payment.create({ userId: student._id, courseId: course._id, amount: 100, originalAmount: 100, status: "approved" });
  await Notification.create({ userId: student._id, courseId: course._id, type: "enrollment", title: "Enrollment confirmed", message: `You are enrolled in ${course.title}.`, link: "/my-courses" });
  await Notification.create({ userId: student._id, type: "payment", title: "Legacy payment", message: `Payment approved for ${course.title}.`, link: "/my-courses" });
  const loginResult = await login(admin.email);

  assert.equal((await request(`/courses/${course._id}`, { method: "DELETE", token: loginResult.body.accessToken, origin: "https://admin.example.test" })).status, 400);
  assert.equal((await request(`/courses/${course._id}`, { method: "DELETE", body: { adminPassword: "incorrect-password" }, token: loginResult.body.accessToken, origin: "https://admin.example.test" })).status, 403);
  assert.ok(await Course.exists({ _id: course._id }));

  assert.equal((await request(`/courses/${course._id}`, { method: "DELETE", body: { adminPassword: password }, token: loginResult.body.accessToken, origin: "https://admin.example.test" })).status, 200);
  assert.equal(await Course.exists({ _id: course._id }), null);
  assert.equal(await Enrollment.exists({ userId: student._id, courseId: course._id }), null);
  assert.equal(await Notification.exists({ userId: student._id, title: "Enrollment confirmed" }), null);
  assert.equal(await Notification.exists({ userId: student._id, title: "Legacy payment" }), null);
  const removalNotice = await Notification.findOne({ userId: student._id, title: "Course no longer available" });
  assert.equal(removalNotice?.link, "/app/courses");
  const historicalPayment = await Payment.findById(payment._id);
  assert.equal(historicalPayment?.courseDeletedAt instanceof Date, true);
  assert.equal(historicalPayment?.courseSnapshot?.title, "Protected deletion course");
});

test("authenticated-user and admin user responses never expose password fields", async () => {
  const student = await createUser({ email: "no-password-leak@example.test" });
  const admin = await createUser({ email: "no-password-leak-admin@example.test", role: "admin" });
  const studentLogin = await login(student.email);
  const adminLogin = await login(admin.email);
  const me = await responseJson(await request("/auth/me", { token: studentLogin.body.accessToken, origin: "https://student.example.test" }));
  const users = await responseJson(await request("/user", { token: adminLogin.body.accessToken, origin: "https://admin.example.test" }));
  assert.equal(Object.hasOwn(me.user, "password"), false);
  assert.equal(Object.hasOwn(me.user, "passwordHash"), false);
  assert.ok(users.every((user) => !Object.hasOwn(user, "password") && !Object.hasOwn(user, "passwordHash")));
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

test("payment proofs are private, admin-gated, and absent from normal API responses", async () => {
  const owner = await createUser({ email: "proof-owner@example.test" });
  const otherStudent = await createUser({ email: "proof-other@example.test" });
  const admin = await createUser({ email: "proof-admin@example.test", role: "admin" });
  const payment = await Payment.create({
    userId: owner._id,
    courseId: new mongoose.Types.ObjectId(),
    amount: 1,
    paymentProofPublicId: "arun_thai/payment_proofs/test-private-proof",
    paymentProofFormat: "png",
    paymentProofStorage: "authenticated",
    status: "pending",
  });

  assert.equal((await request(`/payments/${payment._id}/proof-access`, { origin: "https://student.example.test" })).status, 401);
  const studentLogin = await login(otherStudent.email);
  assert.equal((await request(`/payments/${payment._id}/proof-access`, { token: studentLogin.body.accessToken, origin: "https://student.example.test" })).status, 403);

  const adminLogin = await login(admin.email);
  const accessResponse = await request(`/payments/${payment._id}/proof-access`, { token: adminLogin.body.accessToken, origin: "https://admin.example.test" });
  assert.equal(accessResponse.status, 200);
  const access = await responseJson(accessResponse);
  assert.match(access.url, new RegExp(`/payments/${payment._id}/proof\\?token=`));
  assert.doesNotMatch(access.url, /res\.cloudinary\.com|api_secret|CLOUDINARY/i);
  assert.ok(Date.parse(access.expiresAt) > Date.now());

  const myPayments = await responseJson(await request("/payments/my", { token: (await login(owner.email)).body.accessToken, origin: "https://student.example.test" }));
  const allPayments = await responseJson(await request("/payments", { token: adminLogin.body.accessToken, origin: "https://admin.example.test" }));
  assert.equal(JSON.stringify(myPayments).includes("paymentImage"), false);
  assert.equal(JSON.stringify(allPayments).includes("paymentImage"), false);
  assert.equal(JSON.stringify(allPayments).includes("test-private-proof"), false);
});

test("payment proof access links reject invalid and expired signatures", async () => {
  const admin = await createUser({ email: "proof-expiry-admin@example.test", role: "admin" });
  const payment = await Payment.create({ userId: admin._id, courseId: new mongoose.Types.ObjectId(), amount: 1, paymentProofPublicId: "arun_thai/payment_proofs/test-expired-proof", paymentProofFormat: "png", paymentProofStorage: "authenticated", status: "pending" });
  assert.equal((await request(`/payments/${payment._id}/proof?token=invalid`, { origin: "https://admin.example.test" })).status, 401);
  const expired = jwt.sign({ purpose: "payment-proof-view", paymentId: String(payment._id), adminId: String(admin._id) }, jwtSecret, { expiresIn: -1 });
  assert.equal((await request(`/payments/${payment._id}/proof?token=${expired}`, { origin: "https://admin.example.test" })).status, 401);
});

test("a newly issued payment proof access link is immediately valid", () => {
  const paymentId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = jwtSecret;
  try {
    const token = issuePaymentProofAccessToken({ paymentId, adminId });
    const payload = verifyPaymentProofAccessToken(token, paymentId);
    assert.equal(payload.adminId, String(adminId));
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test("payment approval and rejection preserve the existing review workflow without exposing proofs", async () => {
  const admin = await createUser({ email: "proof-review-admin@example.test", role: "admin" });
  const student = await createUser({ email: "proof-review-student@example.test" });
  const course = await Course.create({ title: "Proof review course", price: 100, createdBy: admin._id });
  const approvedPayment = await Payment.create({ userId: student._id, courseId: course._id, amount: 100, paymentProofPublicId: "arun_thai/payment_proofs/approval-proof", paymentProofFormat: "png", paymentProofStorage: "authenticated", status: "pending" });
  const rejectedPayment = await Payment.create({ userId: admin._id, courseId: course._id, amount: 100, paymentProofPublicId: "arun_thai/payment_proofs/rejection-proof", paymentProofFormat: "png", paymentProofStorage: "authenticated", status: "pending" });
  const loginResult = await login(admin.email);

  const approved = await request(`/payments/${approvedPayment._id}/approve`, { method: "PATCH", token: loginResult.body.accessToken, body: { adminPassword: password }, origin: "https://admin.example.test" });
  assert.equal(approved.status, 200);
  assert.equal((await responseJson(approved)).payment.status, "approved");

  const rejected = await request(`/payments/${rejectedPayment._id}/reject`, { method: "PATCH", token: loginResult.body.accessToken, body: { adminPassword: password, rejectReason: "Receipt is incomplete" }, origin: "https://admin.example.test" });
  assert.equal(rejected.status, 200);
  const rejectedBody = await responseJson(rejected);
  assert.equal(rejectedBody.payment.status, "rejected");
  assert.equal(JSON.stringify(rejectedBody).includes("paymentProofPublicId"), false);
});
