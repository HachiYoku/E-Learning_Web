const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const backendDirectory = path.resolve(__dirname, "..");
const password = "CorrectHorseBattery1";
const jwtSecret = "admin-feedback-test-secret";
let mongoDirectory; let mongoProcess; let apiProcess; let apiBaseUrl; let User; let Course; let StudentFeedback; let AuditLog; let sequence = 0;
const unique = (label) => `${label}-${++sequence}`;
function port() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close((error) => error ? reject(error) : resolve(value)); }); }); }
function waitFor(child, expected) { return new Promise((resolve, reject) => { let output = ""; const append = (chunk) => { output = `${output}${chunk}`.slice(-4000); }; const done = (error) => { clearTimeout(timer); child.stdout.off("data", onData); child.stderr.off("data", append); child.off("exit", onExit); error ? reject(error) : resolve(); }; const timer = setTimeout(() => done(new Error(`Timed out waiting for ${expected}: ${output}`)), 15000); const onData = (chunk) => { append(chunk); if (chunk.toString().includes(expected)) done(); }; const onExit = () => done(new Error(`Server exited: ${output}`)); child.stdout.on("data", onData); child.stderr.on("data", append); child.once("exit", onExit); }); }
function stop(child) { return new Promise((resolve) => { if (!child || child.exitCode !== null) return resolve(); const timer = setTimeout(() => child.kill("SIGKILL"), 5000); child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM"); }); }
async function request(route, { method = "GET", token, body } = {}) { return fetch(`${apiBaseUrl}${route}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
async function json(response) { return response.json().catch(() => null); }
async function user(role = "user", name = "Htet Linn Aung") { return User.create({ name, email: `${unique(role)}@example.test`, password: await bcrypt.hash(password, 10), role, isActive: true, isVerified: true }); }
async function token(account) { const response = await request("/auth/login", { method: "POST", body: { email: account.email, password } }); assert.equal(response.status, 200); return (await json(response)).accessToken; }
async function record({ consent = "permitted", status = consent === "permitted" ? "awaiting_review" : consent, preference = "first_name" } = {}) { const student = await user("user", "Htet Linn Aung"); const admin = await user("admin", "Course Owner"); const course = await Course.create({ title: unique("Grammar Essentials"), createdBy: admin._id, isPublished: true }); return StudentFeedback.create({ studentId: student._id, courseId: course._id, originalFeedback: "These lessons are practical, clear, and useful for daily Thai conversation.", publicationConsent: { status: consent, namePreference: consent === "permitted" ? preference : null }, publication: { status } }); }

before(async () => { const mongoPort = await port(); const apiPort = await port(); mongoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-admin-feedback-")); const mongoUri = `mongodb://127.0.0.1:${mongoPort}/admin_feedback_test?replicaSet=paymentTests`; mongoProcess = spawn("mongod", ["--replSet", "paymentTests", "--port", String(mongoPort), "--dbpath", mongoDirectory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] }); await waitFor(mongoProcess, "Waiting for connections"); await require("./helpers/replicaSet").initiateReplicaSet(mongoPort); apiBaseUrl = `http://127.0.0.1:${apiPort}`; apiProcess = spawn(process.execPath, ["server.js"], { cwd: backendDirectory, env: { ...process.env, NODE_ENV: "production", PORT: String(apiPort), MONGO_DB: mongoUri, JWT_SECRET: jwtSecret, BACKEND_URL: "https://api.example.test", FRONTEND_URL_PROD: "https://student.example.test", ADMIN_URL_PROD: "https://admin.example.test", TRUST_PROXY: "true" }, stdio: ["ignore", "pipe", "pipe"] }); await waitFor(apiProcess, "Example app listening"); await mongoose.connect(mongoUri); User = require("../models/userModel"); Course = require("../models/courseModel"); StudentFeedback = require("../models/studentFeedbackModel"); AuditLog = require("../models/auditLogModel"); await StudentFeedback.init(); });
beforeEach(async () => { await mongoose.connection.db.dropDatabase(); await StudentFeedback.syncIndexes(); });
after(async () => { await mongoose.disconnect(); await Promise.all([stop(apiProcess), stop(mongoProcess)]); if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true }); });

test("denies an unauthenticated admin-feedback request", async () => {
  assert.equal((await request("/admin/student-feedback")).status, 401);
});

test("denies an authenticated non-admin admin-feedback request", async () => {
  const student = await user();
  assert.equal((await request("/admin/student-feedback", { token: await token(student) })).status, 403);
});

test("paginates the feedback list with safe page and limit bounds", async () => {
  const admin = await user("admin"); const adminToken = await token(admin);
  await record(); await record(); await record();
  const response = await request("/admin/student-feedback?status=awaiting_review&page=2&limit=1", { token: adminToken });
  const body = await json(response);
  assert.equal(response.status, 200); assert.equal(body.feedback.length, 1); assert.equal(body.pagination.page, 2); assert.equal(body.pagination.limit, 1); assert.equal(body.pagination.total, 3); assert.equal(body.pagination.totalPages, 3);
  assert.equal((await request("/admin/student-feedback?limit=51", { token: adminToken })).status, 400);
  assert.equal((await request("/admin/student-feedback?page=10001", { token: adminToken })).status, 400);
});

test("filters feedback by publication status and keeps list responses minimal", async () => {
  const admin = await user("admin"); const adminToken = await token(admin);
  await record(); await record({ consent: "private", status: "private" });
  const response = await request("/admin/student-feedback?status=private", { token: adminToken });
  const body = await json(response);
  assert.equal(response.status, 200); assert.equal(body.feedback.length, 1); assert.equal(body.feedback[0].publication.status, "private");
  assert.equal(body.feedback[0].originalFeedback, undefined); assert.equal(body.feedback[0].student.email, undefined);
});

test("returns complete review detail with a server-derived public-name preview", async () => {
  const admin = await user("admin"); const adminToken = await token(admin); const feedback = await record();
  const response = await request(`/admin/student-feedback/${feedback._id}`, { token: adminToken }); const body = await json(response);
  assert.equal(response.status, 200); assert.equal(body.feedback.originalFeedback, feedback.originalFeedback); assert.equal(body.feedback.student.email.includes("@example.test"), true); assert.equal(body.feedback.publicNamePreview, "Htet");
});

test("rejects malformed and nonexistent feedback detail ids", async () => {
  const admin = await user("admin"); const adminToken = await token(admin);
  assert.equal((await request("/admin/student-feedback/not-an-id", { token: adminToken })).status, 400);
  assert.equal((await request(`/admin/student-feedback/${new mongoose.Types.ObjectId()}`, { token: adminToken })).status, 404);
});

test("does not allow private feedback to be published", async () => {
  const admin = await user("admin"); const adminToken = await token(admin); const feedback = await record({ consent: "private", status: "private" });
  assert.equal((await request(`/admin/student-feedback/${feedback._id}/publication`, { method: "PATCH", token: adminToken, body: { status: "published" } })).status, 409);
});

test("publishes permitted awaiting-review feedback without changing the original feedback", async () => {
  const admin = await user("admin", "Review Admin"); const adminToken = await token(admin); const feedback = await record();
  const response = await request(`/admin/student-feedback/${feedback._id}/publication`, { method: "PATCH", token: adminToken, body: { status: "published" } });
  assert.equal(response.status, 200);
  const stored = await StudentFeedback.findById(feedback._id);
  assert.equal(stored.publication.status, "published"); assert.equal(String(stored.publication.reviewedBy), String(admin._id)); assert.ok(stored.publication.reviewedAt); assert.ok(stored.publication.publishedAt); assert.equal(stored.originalFeedback, feedback.originalFeedback);
});

test("records audit metadata without original feedback or student email", async () => {
  const admin = await user("admin"); const adminToken = await token(admin); const feedback = await record();
  await request(`/admin/student-feedback/${feedback._id}/publication`, { method: "PATCH", token: adminToken, body: { status: "published" } });
  const audit = await AuditLog.findOne({ targetId: feedback._id }); const metadata = JSON.stringify(audit.metadata);
  assert.equal(audit.metadata.resultingPublicationStatus, "published"); assert.equal(metadata.includes(feedback.originalFeedback), false); assert.equal(metadata.includes(feedback.studentId.toString()), false);
  const student = await User.findById(feedback.studentId); assert.equal(metadata.includes(student.email), false);
});

test("marks permitted awaiting-review feedback as not selected without a published timestamp", async () => {
  const admin = await user("admin"); const adminToken = await token(admin); const feedback = await record();
  const response = await request(`/admin/student-feedback/${feedback._id}/publication`, { method: "PATCH", token: adminToken, body: { status: "not_selected" } });
  assert.equal(response.status, 200);
  const stored = await StudentFeedback.findById(feedback._id);
  assert.equal(stored.publication.status, "not_selected"); assert.equal(String(stored.publication.reviewedBy), String(admin._id)); assert.ok(stored.publication.reviewedAt); assert.equal(stored.publication.publishedAt, null);
});

test("does not allow withdrawn feedback to be published", async () => {
  const admin = await user("admin"); const adminToken = await token(admin); const feedback = await record({ consent: "withdrawn", status: "withdrawn" });
  assert.equal((await request(`/admin/student-feedback/${feedback._id}/publication`, { method: "PATCH", token: adminToken, body: { status: "published" } })).status, 409);
});

test("returns a conflict when a student withdraws before a stale publication decision", async () => {
  const admin = await user("admin"); const adminToken = await token(admin); const feedback = await record();
  await StudentFeedback.updateOne({ _id: feedback._id }, { $set: { "publicationConsent.status": "withdrawn", "publication.status": "withdrawn" } });
  assert.equal((await request(`/admin/student-feedback/${feedback._id}/publication`, { method: "PATCH", token: adminToken, body: { status: "published" } })).status, 409);
});

test("rejects an invalid publication status", async () => {
  const admin = await user("admin"); const adminToken = await token(admin); const feedback = await record();
  assert.equal((await request(`/admin/student-feedback/${feedback._id}/publication`, { method: "PATCH", token: adminToken, body: { status: "private" } })).status, 400);
});

test("rejects a second publication decision after the first decision", async () => {
  const admin = await user("admin"); const adminToken = await token(admin); const feedback = await record();
  assert.equal((await request(`/admin/student-feedback/${feedback._id}/publication`, { method: "PATCH", token: adminToken, body: { status: "published" } })).status, 200);
  assert.equal((await request(`/admin/student-feedback/${feedback._id}/publication`, { method: "PATCH", token: adminToken, body: { status: "not_selected" } })).status, 409);
});
