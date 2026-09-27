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
let mongoDirectory; let mongoProcess; let apiProcess; let apiBaseUrl;
let User; let Enrollment; let Payment; let PromoRedemption; let RefreshSession; let PersonalFlashcardDeck; let PersonalFlashcard; let FlashcardReviewProgress; let QuizAttempt; let Notification; let SupportTicket; let AuditLog; let AccountAssetCleanup; let AccountDeletionConfirmation;
let sequence = 0;
const unique = (label) => `${label}-${++sequence}`;

function port() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close((error) => error ? reject(error) : resolve(value)); }); }); }
function waitFor(child, expected) { return new Promise((resolve, reject) => { let output = ""; const append = (chunk) => { output = `${output}${chunk}`.slice(-4000); }; const done = (error) => { clearTimeout(timer); child.stdout.off("data", onData); child.stderr.off("data", append); child.off("exit", onExit); error ? reject(error) : resolve(); }; const timer = setTimeout(() => done(new Error(`Timed out waiting for ${expected}: ${output}`)), 15000); const onData = (chunk) => { append(chunk); if (chunk.toString().includes(expected)) done(); }; const onExit = () => done(new Error(`Server exited: ${output}`)); child.stdout.on("data", onData); child.stderr.on("data", append); child.once("exit", onExit); }); }
function stop(child) { return new Promise((resolve) => { if (!child || child.exitCode !== null) return resolve(); const timer = setTimeout(() => child.kill("SIGKILL"), 5000); child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM"); }); }
async function request(route, { method = "GET", token, body, cookie } = {}) { return fetch(`${apiBaseUrl}${route}`, { method, headers: { Origin: "https://student.example.test", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
async function json(response) { return response.json().catch(() => null); }
async function createUser(role = "user", fields = {}) { const email = `${unique(role)}@example.test`; return User.create({ name: email, email, password: await bcrypt.hash(password, 10), role, isActive: true, isVerified: true, ...fields }); }
async function login(user) { const response = await request("/auth/login", { method: "POST", body: { email: user.email, password } }); assert.equal(response.status, 200); const setCookie = response.headers.get("set-cookie"); return { token: (await json(response)).accessToken, cookie: setCookie?.split(";", 1)[0] }; }

before(async () => {
  const mongoPort = await port(); const apiPort = await port();
  mongoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-account-delete-"));
  const mongoUri = `mongodb://127.0.0.1:${mongoPort}/account_delete_test?replicaSet=paymentTests`;
  mongoProcess = spawn("mongod", ["--replSet", "paymentTests", "--port", String(mongoPort), "--dbpath", mongoDirectory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await waitFor(mongoProcess, "Waiting for connections");
  await require("./helpers/replicaSet").initiateReplicaSet(mongoPort);
  apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  apiProcess = spawn(process.execPath, ["server.js"], { cwd: backendDirectory, env: { ...process.env, NODE_ENV: "production", PORT: String(apiPort), MONGO_DB: mongoUri, JWT_SECRET: "account-delete-test-secret", BACKEND_URL: "https://api.example.test", FRONTEND_URL_PROD: "https://student.example.test", ADMIN_URL_PROD: "https://admin.example.test", TRUST_PROXY: "true" }, stdio: ["ignore", "pipe", "pipe"] });
  await waitFor(apiProcess, "Example app listening");
  await mongoose.connect(mongoUri);
  User = require("../models/userModel"); Enrollment = require("../models/enrollmentModel"); Payment = require("../models/paymentModel"); PromoRedemption = require("../models/promoRedemptionModel"); RefreshSession = require("../models/refreshSessionModel"); PersonalFlashcardDeck = require("../models/personalFlashcardDeckModel"); PersonalFlashcard = require("../models/personalFlashcardModel"); FlashcardReviewProgress = require("../models/flashcardReviewProgressModel"); QuizAttempt = require("../models/quizAttemptModel"); Notification = require("../models/notificationModel"); SupportTicket = require("../models/supportTicketModel"); AuditLog = require("../models/auditLogModel"); AccountAssetCleanup = require("../models/accountAssetCleanupModel"); AccountDeletionConfirmation = require("../models/accountDeletionConfirmationModel");
  await Promise.all([PersonalFlashcardDeck.init(), PersonalFlashcard.init(), FlashcardReviewProgress.init(), AccountAssetCleanup.init(), AccountDeletionConfirmation.init()]);
});

beforeEach(async () => { await mongoose.connection.db.dropDatabase(); });
after(async () => { await mongoose.disconnect(); await Promise.all([stop(apiProcess), stop(mongoProcess)]); if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true }); });

async function seedStudentData(student) {
  const deck = await PersonalFlashcardDeck.create({ ownerId: student._id, name: "Private" });
  const card = await PersonalFlashcard.create({ ownerId: student._id, deckId: deck._id, prompt: "Front", answer: "Back" });
  await Enrollment.create({ userId: student._id, courseId: new mongoose.Types.ObjectId() });
  await QuizAttempt.create({ user: student._id, quiz: new mongoose.Types.ObjectId(), attemptNumber: 1, answers: [0], score: 1, total: 1 });
  await Notification.create({ userId: student._id, title: "Private", message: "Private" });
  await SupportTicket.create({ studentId: student._id, subject: "Help", message: "Private support message" });
  return { deck, card };
}

test("admin deletion is protected and only targets another student", async () => {
  const admin = await createUser("admin"); const otherAdmin = await createUser("admin"); const student = await createUser(); const otherStudent = await createUser(); const adminLogin = await login(admin); const studentLogin = await login(student);
  assert.equal((await request(`/user/${student._id}`, { method: "DELETE" })).status, 401);
  assert.equal((await request(`/user/${otherStudent._id}`, { method: "DELETE", token: studentLogin.token, body: { adminPassword: password } })).status, 403);
  assert.equal((await request(`/user/${student._id}`, { method: "DELETE", token: adminLogin.token, body: {} })).status, 400);
  assert.equal((await request(`/user/${student._id}`, { method: "DELETE", token: adminLogin.token, body: { adminPassword: "wrong" } })).status, 403);
  assert.equal((await request(`/user/${new mongoose.Types.ObjectId()}`, { method: "DELETE", token: adminLogin.token, body: { adminPassword: password } })).status, 404);
  assert.equal((await request(`/user/${admin._id}`, { method: "DELETE", token: adminLogin.token, body: { adminPassword: password } })).status, 404);
  assert.equal((await request(`/user/${otherAdmin._id}`, { method: "DELETE", token: adminLogin.token, body: { adminPassword: password } })).status, 404);
  assert.ok(await User.exists({ _id: otherAdmin._id }));
  admin.isActive = false; await admin.save();
  assert.equal((await request(`/user/${student._id}`, { method: "DELETE", token: adminLogin.token, body: { adminPassword: password } })).status, 401);
});

test("admin deletion removes private student data, retains business history, and revokes sessions", async () => {
  const admin = await createUser("admin"); const student = await createUser(); const other = await createUser(); const adminLogin = await login(admin); const studentLogin = await login(student); const studentData = await seedStudentData(student);
  await FlashcardReviewProgress.create({ userId: student._id, cardType: "personal", cardId: studentData.card._id, lastReviewedAt: new Date(), nextReviewAt: new Date(), lastRating: "again", reviewCount: 1, intervalMinutes: 10 });
  const payment = await Payment.create({ userId: student._id, courseId: new mongoose.Types.ObjectId(), amount: 50, status: "approved" });
  const redemption = await PromoRedemption.create({ promoCode: new mongoose.Types.ObjectId(), userId: student._id, paymentId: payment._id, active: true });
  const otherDeck = await PersonalFlashcardDeck.create({ ownerId: other._id, name: "Other" });
  const otherCard = await PersonalFlashcard.create({ ownerId: other._id, deckId: otherDeck._id, prompt: "Other prompt", answer: "Other answer" });
  const otherReview = await FlashcardReviewProgress.create({ userId: other._id, cardType: "personal", cardId: otherCard._id, lastReviewedAt: new Date(), nextReviewAt: new Date(), lastRating: "again", reviewCount: 1, intervalMinutes: 10 });
  const response = await request(`/user/${student._id}`, { method: "DELETE", token: adminLogin.token, body: { adminPassword: password } });
  assert.equal(response.status, 200); assert.equal(await User.exists({ _id: student._id }), null);
  await Promise.all([Enrollment, PersonalFlashcardDeck, PersonalFlashcard, FlashcardReviewProgress, QuizAttempt, Notification, SupportTicket].map(async (Model) => assert.equal(await Model.countDocuments(Model === QuizAttempt ? { user: student._id } : Model === PersonalFlashcardDeck || Model === PersonalFlashcard ? { ownerId: student._id } : Model === SupportTicket ? { studentId: student._id } : { userId: student._id }), 0)));
  assert.ok(await Payment.exists({ _id: payment._id })); assert.ok(await PromoRedemption.exists({ _id: redemption._id })); assert.ok(await AuditLog.exists({ targetId: student._id, action: "user.deleted" })); assert.ok(await PersonalFlashcardDeck.exists({ _id: otherDeck._id })); assert.ok(await FlashcardReviewProgress.exists({ _id: otherReview._id }));
  assert.equal((await request("/auth/refresh", { method: "POST", cookie: studentLogin.cookie })).status, 401);
});

test("self deletion requires a server-confirmed current password and uses the authenticated user", async () => {
  const student = await createUser(); const other = await createUser(); const loginResult = await login(student); await seedStudentData(student); const otherDeck = await PersonalFlashcardDeck.create({ ownerId: other._id, name: "Other" });
  assert.equal((await request("/user/me", { method: "DELETE" })).status, 401);
  assert.equal((await request("/user/me", { method: "DELETE", token: loginResult.token, body: {} })).status, 400);
  assert.equal((await request("/user/me", { method: "DELETE", token: loginResult.token, body: { currentPassword: "wrong" } })).status, 400);
  assert.equal((await request("/user/me/deletion-confirmation", { method: "POST", token: loginResult.token, body: {} })).status, 400);
  assert.equal((await request("/user/me/deletion-confirmation", { method: "POST", token: loginResult.token, body: { currentPassword: "wrong" } })).status, 403);
  assert.ok(await User.exists({ _id: student._id })); assert.equal(await Enrollment.countDocuments({ userId: student._id }), 1); assert.equal(await PersonalFlashcardDeck.countDocuments({ ownerId: student._id }), 1); assert.equal(await PersonalFlashcard.countDocuments({ ownerId: student._id }), 1); assert.equal(await QuizAttempt.countDocuments({ user: student._id }), 1); assert.equal(await Notification.countDocuments({ userId: student._id }), 1); assert.equal(await SupportTicket.countDocuments({ studentId: student._id }), 1); assert.equal(await RefreshSession.countDocuments({ userId: student._id, revokedAt: null }), 1); assert.equal(await AuditLog.countDocuments({ targetId: student._id, action: "user.self_deleted" }), 0); assert.equal(await AccountDeletionConfirmation.countDocuments({ userId: student._id }), 0);
  const confirmation = await request("/user/me/deletion-confirmation", { method: "POST", token: loginResult.token, body: { currentPassword: password } });
  assert.equal(confirmation.status, 200); const { deletionConfirmationToken } = await json(confirmation); assert.ok(deletionConfirmationToken);
  const deleted = await request("/user/me", { method: "DELETE", token: loginResult.token, cookie: loginResult.cookie, body: { deletionConfirmationToken, userId: other._id } });
  assert.equal(deleted.status, 200); assert.match(deleted.headers.get("set-cookie") || "", /Expires=Thu, 01 Jan 1970/i); assert.equal(await User.exists({ _id: student._id }), null); assert.ok(await PersonalFlashcardDeck.exists({ _id: otherDeck._id })); assert.ok(await AuditLog.exists({ targetId: student._id, action: "user.self_deleted" })); assert.equal((await request("/auth/refresh", { method: "POST", cookie: loginResult.cookie })).status, 401);
});

test("a transactional cleanup failure leaves the account and private data intact", async () => {
  const admin = await createUser("admin"); const student = await createUser("user", { avatarPublicId: "avatars/transaction-test" }); const adminLogin = await login(admin); await seedStudentData(student);
  await AccountAssetCleanup.collection.createIndex({ publicId: 1 }, { unique: true });
  await AccountAssetCleanup.create({ publicId: student.avatarPublicId });
  const response = await request(`/user/${student._id}`, { method: "DELETE", token: adminLogin.token, body: { adminPassword: password } });
  assert.equal(response.status, 500); assert.ok(await User.exists({ _id: student._id })); assert.equal(await PersonalFlashcardDeck.countDocuments({ ownerId: student._id }), 1); assert.equal(await PersonalFlashcard.countDocuments({ ownerId: student._id }), 1); assert.equal(await AuditLog.countDocuments({ targetId: student._id, action: "user.deleted" }), 0);
});

test("post-commit avatar cleanup failure remains retryable without changing database deletion", async () => {
  const cloudinary = require("../config/cloudinary"); const { deleteStudentAccount } = require("../services/studentAccountDeletion");
  const admin = await createUser("admin");
  const student = await createUser("user", { avatarPublicId: "avatars/cleanup-failure" });
  await seedStudentData(student);
  const payment = await Payment.create({ userId: student._id, courseId: new mongoose.Types.ObjectId(), amount: 50, status: "approved" });
  const originalDestroy = cloudinary.uploader.destroy;
  cloudinary.uploader.destroy = async () => { throw new Error("Cloudinary unavailable"); };
  try {
    const result = await deleteStudentAccount(student._id, { actorId: admin._id, initiatedBy: "admin" });
    assert.equal(result.assetCleanup.cleaned, false);
    assert.equal(await User.exists({ _id: student._id }), null);
    assert.ok(await Payment.exists({ _id: payment._id }));
    const persisted = await AccountAssetCleanup.findOne({ publicId: student.avatarPublicId });
    assert.equal(persisted.state, "failed"); assert.equal(persisted.attempts, 1); assert.ok(persisted.nextAttemptAt);
  } finally { cloudinary.uploader.destroy = originalDestroy; }
});
