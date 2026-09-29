const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const backendDirectory = path.resolve(__dirname, "..");
const password = "CorrectHorseBattery1";
const jwtSecret = "lesson-vocabulary-test-secret-only-not-for-production";
let mongoDirectory;
let mongoProcess;
let apiProcess;
let apiBaseUrl;
let User;
let Course;
let Lesson;
let Enrollment;
let sequence = 0;

function unique(label) { sequence += 1; return `${label}-${sequence}`; }

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

function waitForOutput(child, expected) {
  return new Promise((resolve, reject) => {
    let output = "";
    const append = (chunk) => { output = `${output}${chunk}`.slice(-4000); };
    const finish = (error) => {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.stderr.off("data", append);
      child.off("exit", onExit);
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => finish(new Error(`Timed out waiting for ${expected}: ${output}`)), 15_000);
    const onData = (chunk) => { append(chunk); if (chunk.toString().includes(expected)) finish(); };
    const onExit = (code) => finish(new Error(`Server exited before ready (${code}): ${output}`));
    child.stdout.on("data", onData);
    child.stderr.on("data", append);
    child.once("exit", onExit);
  });
}

function stopProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.kill("SIGTERM");
  });
}

async function request(route, { method = "GET", token, body } = {}) {
  return fetch(`${apiBaseUrl}${route}`, {
    method,
    headers: {
      Origin: "https://student.example.test",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createUser(role = "user") {
  const email = `${unique(role)}@example.test`;
  return User.create({ name: email, email, password: await bcrypt.hash(password, 10), role, isActive: true, isVerified: true });
}

async function login(user) {
  const response = await request("/auth/login", { method: "POST", body: { email: user.email, password } });
  assert.equal(response.status, 200);
  return (await response.json()).accessToken;
}

async function createCourse(admin) {
  return Course.create({ title: unique("Course"), createdBy: admin._id, isPublished: true });
}

async function createLesson(adminToken, course, body = {}) {
  const response = await request(`/lessons/course/${course._id}`, {
    method: "POST",
    token: adminToken,
    body: { title: unique("Lesson"), videoUrl: "https://example.test/video", order: 1, ...body },
  });
  return { response, body: await response.json() };
}

before(async () => {
  const mongoPort = await freePort();
  const apiPort = await freePort();
  mongoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-lesson-vocabulary-test-"));
  const mongoUri = `mongodb://127.0.0.1:${mongoPort}/lesson_vocabulary_test`;
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
  Course = require("../models/courseModel");
  Lesson = require("../models/lessonModel");
  Enrollment = require("../models/enrollmentModel");
});

after(async () => {
  await mongoose.disconnect();
  await Promise.all([stopProcess(apiProcess), stopProcess(mongoProcess)]);
  if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test("a lesson without vocabulary stays compatible and returns an empty array", async () => {
  const admin = await createUser("admin");
  const adminToken = await login(admin);
  const course = await createCourse(admin);
  const created = await createLesson(adminToken, course);
  assert.equal(created.response.status, 201);
  assert.deepEqual(created.body.keyVocabulary, []);
});

test("admin creation normalizes valid vocabulary, preserves order, and keeps subdocument ids", async () => {
  const admin = await createUser("admin");
  const adminToken = await login(admin);
  const course = await createCourse(admin);
  const created = await createLesson(adminToken, course, {
    keyVocabulary: [
      { thai: "  สวัสดี  ", translation: "  Hello ", transliteration: "  sa-wat-dee  ", ignored: "never stored" },
      { thai: "ขอบคุณ", translation: "Thank you" },
    ],
  });
  assert.equal(created.response.status, 201);
  assert.deepEqual(created.body.keyVocabulary.map(({ thai, translation, transliteration }) => ({ thai, translation, transliteration })), [
    { thai: "สวัสดี", translation: "Hello", transliteration: "sa-wat-dee" },
    { thai: "ขอบคุณ", translation: "Thank you", transliteration: "" },
  ]);
  assert.ok(created.body.keyVocabulary.every((entry) => entry._id));
  assert.equal(created.body.keyVocabulary[0].ignored, undefined);
});

test("accepts 50 entries and rejects invalid vocabulary payloads", async () => {
  const admin = await createUser("admin");
  const adminToken = await login(admin);
  const course = await createCourse(admin);
  const fifty = Array.from({ length: 50 }, (_, index) => ({ thai: `คำ${index}`, translation: `Word ${index}` }));
  assert.equal((await createLesson(adminToken, course, { keyVocabulary: fifty })).response.status, 201);

  const invalidPayloads = [
    { keyVocabulary: Array.from({ length: 51 }, () => ({ thai: "คำ", translation: "Word" })) },
    { keyVocabulary: "not an array" },
    { keyVocabulary: [null] },
    { keyVocabulary: [{ thai: "   ", translation: "Word" }] },
    { keyVocabulary: [{ thai: "คำ", translation: "   " }] },
    { keyVocabulary: [{ thai: 42, translation: "Word" }] },
    { keyVocabulary: [{ thai: "คำ", translation: {} }] },
    { keyVocabulary: [{ thai: "คำ", translation: "Word", transliteration: false }] },
    { keyVocabulary: [{ thai: "x".repeat(121), translation: "Word" }] },
    { keyVocabulary: [{ thai: "คำ", translation: "x".repeat(161) }] },
    { keyVocabulary: [{ thai: "คำ", translation: "Word", transliteration: "x".repeat(161) }] },
  ];
  for (const payload of invalidPayloads) {
    const result = await createLesson(adminToken, course, payload);
    assert.equal(result.response.status, 400, JSON.stringify(payload));
  }
});

test("updates vocabulary only when supplied and clears it when explicitly empty", async () => {
  const admin = await createUser("admin");
  const adminToken = await login(admin);
  const course = await createCourse(admin);
  const created = await createLesson(adminToken, course, { keyVocabulary: [{ thai: "เดิม", translation: "Original" }] });
  assert.equal(created.response.status, 201);

  const omitted = await request(`/lessons/${created.body._id}`, { method: "PUT", token: adminToken, body: { title: "Renamed lesson" } });
  assert.equal(omitted.status, 200);
  assert.deepEqual((await omitted.json()).keyVocabulary.map((entry) => entry.thai), ["เดิม"]);

  const updated = await request(`/lessons/${created.body._id}`, { method: "PUT", token: adminToken, body: { keyVocabulary: [{ thai: "ใหม่", translation: "New", transliteration: "mai" }] } });
  assert.equal(updated.status, 200);
  assert.deepEqual((await updated.json()).keyVocabulary.map(({ thai, translation, transliteration }) => ({ thai, translation, transliteration })), [{ thai: "ใหม่", translation: "New", transliteration: "mai" }]);

  const cleared = await request(`/lessons/${created.body._id}`, { method: "PUT", token: adminToken, body: { keyVocabulary: [] } });
  assert.equal(cleared.status, 200);
  assert.deepEqual((await cleared.json()).keyVocabulary, []);
});

test("only admins can write, while only enrolled students can read vocabulary", async () => {
  const admin = await createUser("admin");
  const adminToken = await login(admin);
  const student = await createUser();
  const studentToken = await login(student);
  const outsider = await createUser();
  const outsiderToken = await login(outsider);
  const course = await createCourse(admin);
  const payload = { title: "Protected lesson", videoUrl: "https://example.test/video", order: 1, keyVocabulary: [{ thai: "สวัสดี", translation: "Hello" }] };

  assert.equal((await request(`/lessons/course/${course._id}`, { method: "POST", body: payload })).status, 401);
  assert.equal((await request(`/lessons/course/${course._id}`, { method: "POST", token: studentToken, body: payload })).status, 403);
  const created = await request(`/lessons/course/${course._id}`, { method: "POST", token: adminToken, body: payload });
  assert.equal(created.status, 201);
  const createdLesson = await created.json();
  assert.equal((await request(`/lessons/${createdLesson._id}`, { method: "PUT", token: studentToken, body: { keyVocabulary: [] } })).status, 403);

  assert.equal((await request(`/lessons/course/${course._id}`, { token: outsiderToken })).status, 403);
  await Enrollment.create({ userId: student._id, courseId: course._id });
  const enrolled = await request(`/lessons/course/${course._id}`, { token: studentToken });
  assert.equal(enrolled.status, 200);
  assert.deepEqual((await enrolled.json())[0].keyVocabulary.map((entry) => entry.thai), ["สวัสดี"]);
});

test("legacy lesson documents without the field return keyVocabulary as an empty array", async () => {
  const admin = await createUser("admin");
  const student = await createUser();
  const studentToken = await login(student);
  const course = await createCourse(admin);
  await Lesson.collection.insertOne({ course: course._id, title: "Legacy lesson", videoUrl: "https://example.test/legacy", order: 1, createdAt: new Date(), updatedAt: new Date() });
  await Enrollment.create({ userId: student._id, courseId: course._id });
  const response = await request(`/lessons/course/${course._id}`, { token: studentToken });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json())[0].keyVocabulary, []);
});
