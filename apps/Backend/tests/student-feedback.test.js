const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { derivePublicDisplayName } = require("../services/studentFeedbackDisplayName");

const backendDirectory = path.resolve(__dirname, "..");
const password = "CorrectHorseBattery1";
const jwtSecret = "student-feedback-test-secret";
let mongoDirectory; let mongoProcess; let apiProcess; let apiBaseUrl;
let User; let Course; let Enrollment; let StudentFeedback;
let sequence = 0;

const unique = (label) => `${label}-${++sequence}`;
function port() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close((error) => error ? reject(error) : resolve(value)); }); }); }
function waitFor(child, expected) { return new Promise((resolve, reject) => { let output = ""; const append = (chunk) => { output = `${output}${chunk}`.slice(-4000); }; const done = (error) => { clearTimeout(timer); child.stdout.off("data", onData); child.stderr.off("data", append); child.off("exit", onExit); error ? reject(error) : resolve(); }; const timer = setTimeout(() => done(new Error(`Timed out waiting for ${expected}: ${output}`)), 15000); const onData = (chunk) => { append(chunk); if (chunk.toString().includes(expected)) done(); }; const onExit = () => done(new Error(`Server exited: ${output}`)); child.stdout.on("data", onData); child.stderr.on("data", append); child.once("exit", onExit); }); }
function stop(child) { return new Promise((resolve) => { if (!child || child.exitCode !== null) return resolve(); const timer = setTimeout(() => child.kill("SIGKILL"), 5000); child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM"); }); }
async function request(route, { method = "GET", token, body } = {}) { return fetch(`${apiBaseUrl}${route}`, { method, headers: { Origin: "https://student.example.test", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); }
async function json(response) { return response.json().catch(() => null); }
async function createUser(fields = {}) { const email = `${unique("student")}@example.test`; return User.create({ name: "Htet Linn Aung", email, password: await bcrypt.hash(password, 10), role: "user", isActive: true, isVerified: true, ...fields }); }
async function login(user) { const response = await request("/auth/login", { method: "POST", body: { email: user.email, password } }); assert.equal(response.status, 200); return (await json(response)).accessToken; }
function staleToken(user) { return jwt.sign({ id: String(user._id), sessionVersion: user.sessionVersion || 0 }, jwtSecret, { expiresIn: "1h" }); }
async function course() { const admin = await User.create({ name: unique("Admin"), email: `${unique("admin")}@example.test`, password: await bcrypt.hash(password, 10), role: "admin", isActive: true, isVerified: true }); return Course.create({ title: unique("Course"), createdBy: admin._id, isPublished: true }); }
async function enroll(student, enrolledCourse, completed = 1) { return Enrollment.create({ userId: student._id, courseId: enrolledCourse._id, completedLessonIds: Array.from({ length: completed }, () => new mongoose.Types.ObjectId()) }); }
async function submit(token, enrolledCourse, feedback = "These lessons are practical, clear, and useful for daily conversation.", extra = {}) { return request("/student-feedback", { method: "POST", token, body: { courseId: String(enrolledCourse._id), feedback, ...extra } }); }

before(async () => {
  const mongoPort = await port(); const apiPort = await port();
  mongoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-student-feedback-"));
  const mongoUri = `mongodb://127.0.0.1:${mongoPort}/student_feedback_test?replicaSet=paymentTests`;
  mongoProcess = spawn("mongod", ["--replSet", "paymentTests", "--port", String(mongoPort), "--dbpath", mongoDirectory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await waitFor(mongoProcess, "Waiting for connections");
  await require("./helpers/replicaSet").initiateReplicaSet(mongoPort);
  apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  apiProcess = spawn(process.execPath, ["server.js"], { cwd: backendDirectory, env: { ...process.env, NODE_ENV: "production", PORT: String(apiPort), MONGO_DB: mongoUri, JWT_SECRET: jwtSecret, BACKEND_URL: "https://api.example.test", FRONTEND_URL_PROD: "https://student.example.test", ADMIN_URL_PROD: "https://admin.example.test", TRUST_PROXY: "true" }, stdio: ["ignore", "pipe", "pipe"] });
  await waitFor(apiProcess, "Example app listening");
  await mongoose.connect(mongoUri);
  User = require("../models/userModel"); Course = require("../models/courseModel"); Enrollment = require("../models/enrollmentModel"); StudentFeedback = require("../models/studentFeedbackModel");
  await StudentFeedback.init();
});
beforeEach(async () => { await mongoose.connection.db.dropDatabase(); await StudentFeedback.syncIndexes(); });
after(async () => { await mongoose.disconnect(); await Promise.all([stop(apiProcess), stop(mongoProcess)]); if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true }); });

test("requires an authenticated, active, verified student", async () => {
  const active = await createUser(); const enrolledCourse = await course(); await enroll(active, enrolledCourse); const inactive = await createUser({ isActive: false }); const unverified = await createUser({ isVerified: false });
  assert.equal((await submit(undefined, enrolledCourse)).status, 401);
  assert.equal((await submit(staleToken(inactive), enrolledCourse)).status, 401);
  assert.equal((await submit(staleToken(unverified), enrolledCourse)).status, 401);
  assert.equal((await request("/student-feedback/mine")).status, 401);
});

test("requires a valid enrolled course with at least one completed lesson", async () => {
  const student = await createUser(); const token = await login(student); const enrolledCourse = await course(); const otherCourse = await course(); await enroll(student, enrolledCourse, 0);
  assert.equal((await request("/student-feedback", { method: "POST", token, body: { courseId: "not-an-id", feedback: "These lessons are practical, clear, and useful for daily conversation." } })).status, 400);
  assert.equal((await submit(token, otherCourse)).status, 403);
  assert.equal((await submit(token, enrolledCourse)).status, 403);
  assert.equal(await StudentFeedback.countDocuments(), 0);
});

test("creates immutable private feedback only for an eligible enrollment", async () => {
  const student = await createUser(); const token = await login(student); const enrolledCourse = await course(); await enroll(student, enrolledCourse);
  const response = await submit(token, enrolledCourse, "  <strong>Practical</strong> lessons are clear and useful for daily Thai conversation.  ");
  assert.equal(response.status, 201); const body = await json(response); const stored = await StudentFeedback.findById(body.feedback._id);
  assert.equal(stored.originalFeedback, "<strong>Practical</strong> lessons are clear and useful for daily Thai conversation.");
  assert.equal(stored.studentId.toString(), student._id.toString()); assert.equal(stored.courseId.toString(), enrolledCourse._id.toString());
  assert.equal(stored.publicationConsent.status, "private"); assert.equal(stored.publicationConsent.namePreference, null); assert.equal(stored.publication.status, "private");
  assert.equal(Object.prototype.hasOwnProperty.call(body.feedback, "studentId"), true);
});

test("rejects owner, publication, and admin fields plus invalid feedback lengths", async () => {
  const student = await createUser(); const other = await createUser(); const token = await login(student); const enrolledCourse = await course(); await enroll(student, enrolledCourse);
  for (const body of [
    { courseId: enrolledCourse._id, feedback: "These lessons are practical, clear, and useful for daily conversation.", studentId: other._id },
    { courseId: enrolledCourse._id, feedback: "These lessons are practical, clear, and useful for daily conversation.", ownerId: other._id },
    { courseId: enrolledCourse._id, feedback: "These lessons are practical, clear, and useful for daily conversation.", publication: { status: "published" } },
    { courseId: enrolledCourse._id, feedback: "short" },
    { courseId: enrolledCourse._id, feedback: " ".repeat(30) },
    { courseId: enrolledCourse._id, feedback: "x".repeat(2001) },
    { courseId: enrolledCourse._id, feedback: 123 },
  ]) assert.equal((await request("/student-feedback", { method: "POST", token, body })).status, 400);
  assert.equal(await StudentFeedback.countDocuments(), 0);
});

test("accepts feedback at the documented 20 and 2000 character bounds", async () => {
  const first = await createUser(); const second = await createUser(); const firstToken = await login(first); const secondToken = await login(second); const firstCourse = await course(); const secondCourse = await course(); await enroll(first, firstCourse); await enroll(second, secondCourse);
  assert.equal((await submit(firstToken, firstCourse, "x".repeat(20))).status, 201);
  assert.equal((await submit(secondToken, secondCourse, "y".repeat(2000))).status, 201);
});

test("enforces one feedback submission per student and course and isolates owner reads", async () => {
  const student = await createUser(); const other = await createUser(); const token = await login(student); const otherToken = await login(other); const enrolledCourse = await course(); await enroll(student, enrolledCourse); await enroll(other, enrolledCourse);
  assert.equal((await submit(token, enrolledCourse)).status, 201);
  assert.equal((await submit(token, enrolledCourse)).status, 409);
  assert.equal((await submit(otherToken, enrolledCourse, "I can use these lessons confidently in practical daily situations.")).status, 201);
  const mine = await json(await request("/student-feedback/mine", { token })); const otherMine = await json(await request("/student-feedback/mine", { token: otherToken }));
  assert.equal(mine.feedback.length, 1); assert.equal(otherMine.feedback.length, 1); assert.notEqual(String(mine.feedback[0]._id), String(otherMine.feedback[0]._id));
  assert.equal((await request(`/student-feedback/${otherMine.feedback[0]._id}/publication-consent`, { method: "PATCH", token, body: { status: "permitted", namePreference: "first_name" } })).status, 404);
});

test("requires valid separate consent and withdraws publication immediately without deleting feedback", async () => {
  const student = await createUser(); const token = await login(student); const enrolledCourse = await course(); await enroll(student, enrolledCourse); const created = await json(await submit(token, enrolledCourse)); const id = created.feedback._id;
  for (const body of [{ status: "private" }, { status: "permitted" }, { status: "permitted", namePreference: "full_name" }, { status: "permitted", namePreference: "first_name_initial" }, { status: "withdrawn", namePreference: "anonymous" }, { status: "permitted", namePreference: "anonymous", reviewedBy: student._id }]) {
    assert.equal((await request(`/student-feedback/${id}/publication-consent`, { method: "PATCH", token, body })).status, 400);
  }
  const permitted = await request(`/student-feedback/${id}/publication-consent`, { method: "PATCH", token, body: { status: "permitted", namePreference: "first_name" } });
  assert.equal(permitted.status, 200); let stored = await StudentFeedback.findById(id); assert.equal(stored.publicationConsent.status, "permitted"); assert.equal(stored.publicationConsent.namePreference, "first_name"); assert.ok(stored.publicationConsent.permittedAt); assert.equal(stored.publicationConsent.withdrawnAt, null); assert.equal(stored.publication.status, "awaiting_review");
  await StudentFeedback.updateOne({ _id: id }, { $set: { "publication.status": "published", "publication.publishedAt": new Date() } });
  const withdrawn = await request(`/student-feedback/${id}/publication-consent`, { method: "PATCH", token, body: { status: "withdrawn" } });
  assert.equal(withdrawn.status, 200); stored = await StudentFeedback.findById(id); assert.equal(stored.publicationConsent.status, "withdrawn"); assert.ok(stored.publicationConsent.withdrawnAt); assert.equal(stored.publication.status, "withdrawn"); assert.equal(stored.publication.publishedAt, null); assert.match(stored.originalFeedback, /practical/);
});

test("derives only limited future public names server-side", () => {
  assert.equal(derivePublicDisplayName("Htet Linn Aung", "first_name"), "Htet");
  assert.equal(derivePublicDisplayName("Htet Linn Aung", "anonymous"), "Anonymous learner");
  assert.equal(derivePublicDisplayName("", "first_name"), "Learner");
});

test("account deletion cascades feedback in the existing transaction without affecting another student", async () => {
  const { deleteStudentAccount } = require("../services/studentAccountDeletion");
  const admin = await User.create({ name: unique("Admin"), email: `${unique("admin")}@example.test`, password: await bcrypt.hash(password, 10), role: "admin", isActive: true, isVerified: true });
  const student = await createUser(); const other = await createUser(); const enrolledCourse = await course(); await enroll(student, enrolledCourse); await enroll(other, enrolledCourse);
  const studentFeedback = await json(await submit(await login(student), enrolledCourse));
  const otherFeedback = await json(await submit(await login(other), enrolledCourse, "I enjoy the clear, practical explanations used throughout these lessons."));
  await deleteStudentAccount(student._id, { actorId: admin._id, initiatedBy: "admin" });
  assert.equal(await StudentFeedback.exists({ _id: studentFeedback.feedback._id }), null);
  assert.ok(await StudentFeedback.exists({ _id: otherFeedback.feedback._id }));
});
