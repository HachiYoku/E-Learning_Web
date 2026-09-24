const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { io } = require("socket.io-client");

const backendDirectory = path.resolve(__dirname, "..");
const jwtSecret = "realtime-notification-test-secret-only-not-for-production";
const password = "CorrectHorseBattery1";
let mongoDirectory;
let mongoProcess;
let apiProcess;
let apiBaseUrl;
let mongoUri;
let User;
let Course;
let Payment;
let Notification;
let SupportTicket;

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
    const append = (chunk) => { output = `${output}${chunk}`.slice(-4000); };
    const timeout = setTimeout(() => finish(new Error(`Timed out waiting for ${text}: ${output}`)), 15_000);
    const finish = (error) => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.stderr.off("data", append);
      child.off("exit", onExit);
      error ? reject(error) : resolve();
    };
    const onData = (chunk) => {
      append(chunk);
      if (chunk.toString().includes(text)) finish();
    };
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
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://student.example.test",
      "X-Auth-Portal": "student",
    },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function request(pathname, { method = "GET", token, body } = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method,
    headers: {
      Origin: "https://student.example.test",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

function connectSocket(token) {
  const socket = io(apiBaseUrl, {
    auth: token ? { token } : {},
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
  });

  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Socket connection timed out")), 6000);
    socket.once("connect", () => { clearTimeout(timeout); resolve(socket); });
    socket.once("connect_error", (error) => { clearTimeout(timeout); reject(error); });
  });

  return { socket, ready };
}

function nextNotification(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for real-time notification")), 5000);
    socket.once("notification:new", (notification) => {
      clearTimeout(timeout);
      resolve(notification);
    });
  });
}

function assertNoNotification(socket, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    const onNotification = (notification) => {
      clearTimeout(timeout);
      reject(new Error(`Unexpected notification: ${notification._id}`));
    };
    const timeout = setTimeout(() => {
      socket.off("notification:new", onNotification);
      resolve();
    }, timeoutMs);
    socket.once("notification:new", onNotification);
  });
}

function assertNoEvent(socket, event, timeoutMs = 500) {
  return new Promise((resolve, reject) => { const fail = () => { clearTimeout(timer); reject(new Error(`Unexpected ${event}`)); }; const timer = setTimeout(() => { socket.off(event, fail); resolve(); }, timeoutMs); socket.once(event, fail); });
}

async function approvePayment({ student, adminToken, title }) {
  const course = await Course.create({ title, price: 100, createdBy: student._id });
  const payment = await Payment.create({ userId: student._id, courseId: course._id, amount: 100, status: "pending" });
  const response = await request(`/payments/${payment._id}/approve`, {
    method: "PATCH",
    token: adminToken,
    body: { adminPassword: password },
  });
  assert.equal(response.status, 200);
}

before(async () => {
  const mongoPort = await freePort();
  const apiPort = await freePort();
  mongoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-realtime-test-"));
  mongoUri = `mongodb://127.0.0.1:${mongoPort}/realtime_notifications_test`;
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
  Payment = require("../models/paymentModel");
  Notification = require("../models/notificationModel");
  SupportTicket = require("../models/supportTicketModel");
});

after(async () => {
  await mongoose.disconnect();
  await Promise.all([stopProcess(apiProcess), stopProcess(mongoProcess)]);
  if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test("socket authentication requires a valid current access token", async () => {
  const student = await createUser({ email: "socket-auth@example.test" });
  const session = await login(student.email);

  const valid = connectSocket(session.accessToken);
  await valid.ready;
  valid.socket.disconnect();

  const missing = connectSocket();
  await assert.rejects(missing.ready, /Unauthorized socket connection/);
  missing.socket.disconnect();

  const invalid = connectSocket("not-a-jwt");
  await assert.rejects(invalid.ready, /Unauthorized socket connection/);
  invalid.socket.disconnect();

  // Socket authentication uses the same authoritative account/session checks
  // as protected HTTP endpoints, not just JWT signature verification.
  student.isActive = false;
  await student.save();
  const revoked = connectSocket(session.accessToken);
  await assert.rejects(revoked.ready, /Unauthorized socket connection/);
  revoked.socket.disconnect();
});

test("notifications are emitted only to the authenticated recipient room", async () => {
  const recipient = await createUser({ email: "socket-recipient@example.test" });
  const otherStudent = await createUser({ email: "socket-other@example.test" });
  const admin = await createUser({ email: "socket-admin@example.test", role: "admin" });
  const recipientSession = await login(recipient.email);
  const otherSession = await login(otherStudent.email);
  const adminSession = await login(admin.email);
  const recipientSocket = connectSocket(recipientSession.accessToken);
  const otherSocket = connectSocket(otherSession.accessToken);
  await Promise.all([recipientSocket.ready, otherSocket.ready]);

  const recipientEvent = nextNotification(recipientSocket.socket);
  const otherHasNoEvent = assertNoNotification(otherSocket.socket);
  await approvePayment({ student: recipient, adminToken: adminSession.accessToken, title: "Socket room course" });
  const notification = await recipientEvent;
  await otherHasNoEvent;

  assert.equal(notification.userId, String(recipient._id));
  assert.equal(notification.title, "Payment approved — course access is ready");
  recipientSocket.socket.disconnect();
  otherSocket.socket.disconnect();
});

test("GET /notifications recovers messages missed while disconnected, and a reconnect receives new events", async () => {
  const student = await createUser({ email: "socket-recovery@example.test" });
  const admin = await createUser({ email: "socket-recovery-admin@example.test", role: "admin" });
  const studentSession = await login(student.email);
  const adminSession = await login(admin.email);
  const initialSocket = connectSocket(studentSession.accessToken);
  await initialSocket.ready;
  initialSocket.socket.disconnect();

  const missed = await Notification.create({
    userId: student._id,
    type: "info",
    title: "Missed while offline",
    message: "This record is recovered over HTTP.",
    link: "/app/notifications",
  });
  const recoveryResponse = await request("/notifications", { token: studentSession.accessToken });
  assert.equal(recoveryResponse.status, 200);
  const recovery = await recoveryResponse.json();
  assert.ok(recovery.notifications.some((notification) => notification._id === String(missed._id)));

  const reconnectedSocket = connectSocket(studentSession.accessToken);
  await reconnectedSocket.ready;
  const event = nextNotification(reconnectedSocket.socket);
  await approvePayment({ student, adminToken: adminSession.accessToken, title: "Reconnected course" });
  assert.equal((await event).userId, String(student._id));
  reconnectedSocket.socket.disconnect();
});

test("admin room is role-isolated and actionable counts follow payment and support workflows", async () => {
  const admin = await createUser({ email: "admin-badges@example.test", role: "admin" });
  const student = await createUser({ email: "student-badges@example.test" });
  const adminSession = await login(admin.email);
  const studentSession = await login(student.email);
  const adminSocket = connectSocket(adminSession.accessToken);
  const studentSocket = connectSocket(studentSession.accessToken);
  await Promise.all([adminSocket.ready, studentSocket.ready]);

  const adminEvent = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("missing admin event")), 5000); adminSocket.socket.once("admin:payment-updated", () => { clearTimeout(timer); resolve(); }); });
  const studentLeak = assertNoEvent(studentSocket.socket, "admin:payment-updated", 700);
  const course = await Course.create({ title: "Admin badge course", price: 100, createdBy: admin._id });
  const payment = await Payment.create({ userId: student._id, courseId: course._id, amount: 100, status: "pending" });
  assert.equal((await (await request("/payments/pending-count", { token: adminSession.accessToken })).json()).count >= 1, true);
  await request(`/payments/${payment._id}/approve`, { method: "PATCH", token: adminSession.accessToken, body: { adminPassword: password } });
  await adminEvent;
  await studentLeak;
  assert.equal((await (await request("/payments/pending-count", { token: adminSession.accessToken })).json()).count, 0);

  const ticket = await SupportTicket.create({ studentId: student._id, subject: "Badge support", message: "Please help", status: "open" });
  const count = async () => (await (await request("/support-tickets/actionable-count", { token: adminSession.accessToken })).json()).count;
  assert.equal(await count(), 1);
  ticket.replies.push({ authorId: admin._id, authorRole: "admin", message: "Answered" }); ticket.status = "in_progress"; await ticket.save(); assert.equal(await count(), 0);
  ticket.replies.push({ authorId: student._id, authorRole: "user", message: "More help" }); await ticket.save(); assert.equal(await count(), 1);
  ticket.status = "resolved"; await ticket.save(); assert.equal(await count(), 0);
  ticket.replies.push({ authorId: student._id, authorRole: "user", message: "Reopen" }); ticket.status = "open"; await ticket.save(); assert.equal(await count(), 1);
  adminSocket.socket.disconnect(); studentSocket.socket.disconnect();
});
