const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { buildReviewSchedule } = require("../services/flashcardReviewSchedule");

const backendDirectory = path.resolve(__dirname, "..");
const password = "CorrectHorseBattery1";
let mongoDirectory; let mongoProcess; let apiProcess; let apiBaseUrl;
let User; let PersonalFlashcardDeck; let PersonalFlashcard; let FlashcardReviewProgress;
let sequence = 0;

function unique(label) { sequence += 1; return `${label}-${sequence}`; }
function port() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close((error) => error ? reject(error) : resolve(value)); }); }); }
function waitFor(child, expected) { return new Promise((resolve, reject) => { let output = ""; const append = (chunk) => { output = `${output}${chunk}`.slice(-4000); }; const done = (error) => { clearTimeout(timer); child.stdout.off("data", onData); child.stderr.off("data", append); child.off("exit", onExit); error ? reject(error) : resolve(); }; const timer = setTimeout(() => done(new Error(`Timed out waiting for ${expected}: ${output}`)), 15000); const onData = (chunk) => { append(chunk); if (chunk.toString().includes(expected)) done(); }; const onExit = () => done(new Error(`Server exited: ${output}`)); child.stdout.on("data", onData); child.stderr.on("data", append); child.once("exit", onExit); }); }
function stop(child) { return new Promise((resolve) => { if (!child || child.exitCode !== null) return resolve(); const timer = setTimeout(() => child.kill("SIGKILL"), 5000); child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM"); }); }
async function request(route, { method = "GET", token, body } = {}) { return fetch(`${apiBaseUrl}${route}`, { method, headers: { Origin: "https://student.example.test", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
async function json(response) { return response.json().catch(() => null); }
async function createUser() { const email = `${unique("student")}@example.test`; return User.create({ name: email, email, password: await bcrypt.hash(password, 10), role: "user", isActive: true, isVerified: true }); }
async function login(user) { const response = await request("/auth/login", { method: "POST", body: { email: user.email, password } }); assert.equal(response.status, 200); return (await json(response)).accessToken; }
async function student() { const user = await createUser(); return { user, token: await login(user) }; }
async function createCard(owner) { const deck = await PersonalFlashcardDeck.create({ ownerId: owner.user._id, name: unique("Deck") }); return PersonalFlashcard.create({ ownerId: owner.user._id, deckId: deck._id, prompt: unique("Front"), answer: "Back" }); }
async function rate(token, cardId, rating, extra = {}) { return request("/flashcard-reviews/rate", { method: "POST", token, body: { cardType: "personal", cardId: String(cardId), rating, ...extra } }); }

before(async () => {
  const mongoPort = await port(); const apiPort = await port();
  mongoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-flashcard-reviews-"));
  const mongoUri = `mongodb://127.0.0.1:${mongoPort}/flashcard_review_test?replicaSet=paymentTests`;
  mongoProcess = spawn("mongod", ["--replSet", "paymentTests", "--port", String(mongoPort), "--dbpath", mongoDirectory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await waitFor(mongoProcess, "Waiting for connections"); await require("./helpers/replicaSet").initiateReplicaSet(mongoPort);
  apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  apiProcess = spawn(process.execPath, ["server.js"], { cwd: backendDirectory, env: { ...process.env, NODE_ENV: "production", PORT: String(apiPort), MONGO_DB: mongoUri, JWT_SECRET: "flashcard-review-test-secret", BACKEND_URL: "https://api.example.test", FRONTEND_URL_PROD: "https://student.example.test", ADMIN_URL_PROD: "https://admin.example.test", TRUST_PROXY: "true" }, stdio: ["ignore", "pipe", "pipe"] });
  await waitFor(apiProcess, "Example app listening"); await mongoose.connect(mongoUri);
  User = require("../models/userModel"); PersonalFlashcardDeck = require("../models/personalFlashcardDeckModel"); PersonalFlashcard = require("../models/personalFlashcardModel"); FlashcardReviewProgress = require("../models/flashcardReviewProgressModel");
  await Promise.all([PersonalFlashcardDeck.init(), PersonalFlashcard.init(), FlashcardReviewProgress.init()]);
});
beforeEach(async () => { await mongoose.connection.db.dropDatabase(); await FlashcardReviewProgress.syncIndexes(); });
after(async () => { await mongoose.disconnect(); await Promise.all([stop(apiProcess), stop(mongoProcess)]); if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true }); });

test("rating requires authentication, a valid owned personal card, and a valid rating", async () => {
  const owner = await student(); const other = await student(); const card = await createCard(owner);
  assert.equal((await request("/flashcard-reviews/rate", { method: "POST", body: { cardType: "personal", cardId: card._id, rating: "again" } })).status, 401);
  assert.equal((await rate(other.token, card._id, "again")).status, 404);
  assert.equal((await rate(owner.token, "not-an-id", "again")).status, 400);
  assert.equal((await request("/flashcard-reviews/rate", { method: "POST", token: owner.token, body: { cardType: "public", cardId: card._id, rating: "again", userId: other.user._id } })).status, 400);
  assert.equal((await rate(owner.token, card._id, "good")).status, 400);
  assert.equal(await FlashcardReviewProgress.countDocuments(), 0);
});

test("first ratings create one owner-scoped record with exact initial intervals", async () => {
  const owner = await student(); const again = await createCard(owner); const hard = await createCard(owner); const easy = await createCard(owner);
  const before = Date.now();
  for (const [card, rating] of [[again, "again"], [hard, "hard"], [easy, "easy"]]) assert.equal((await rate(owner.token, card._id, rating)).status, 200);
  const rows = await FlashcardReviewProgress.find({ userId: owner.user._id }).sort({ cardId: 1 });
  assert.equal(rows.length, 3);
  const byCard = new Map(rows.map((row) => [String(row.cardId), row]));
  assert.equal(byCard.get(String(again._id)).intervalMinutes, 10); assert.equal(byCard.get(String(hard._id)).intervalMinutes, 1440); assert.equal(byCard.get(String(easy._id)).intervalMinutes, 4320);
  for (const row of rows) { assert.equal(row.reviewCount, 1); assert.ok(row.lastReviewedAt.getTime() >= before); assert.equal(row.userId.toString(), owner.user._id.toString()); }
});

test("the scheduling helper calculates exact due timestamps from a fixed time", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");
  const again = buildReviewSchedule(null, "again", now);
  const hard = buildReviewSchedule(null, "hard", now);
  const easy = buildReviewSchedule(null, "easy", now);
  assert.equal(again.lastReviewedAt.toISOString(), now.toISOString()); assert.equal(again.nextReviewAt.toISOString(), "2026-01-15T12:10:00.000Z");
  assert.equal(hard.lastReviewedAt.toISOString(), now.toISOString()); assert.equal(hard.nextReviewAt.toISOString(), "2026-01-16T12:00:00.000Z");
  assert.equal(easy.lastReviewedAt.toISOString(), now.toISOString()); assert.equal(easy.nextReviewAt.toISOString(), "2026-01-18T12:00:00.000Z");
  const later = new Date("2026-01-20T08:30:00.000Z");
  const updated = buildReviewSchedule({ intervalMinutes: hard.intervalMinutes }, "easy", later);
  assert.equal(updated.lastReviewedAt.toISOString(), later.toISOString()); assert.equal(updated.nextReviewAt.toISOString(), "2026-01-23T08:30:00.000Z");
});

test("repeated ratings increment once, grow intervals, reset Again, and cap at 60 days", async () => {
  const owner = await student(); const card = await createCard(owner);
  assert.equal((await rate(owner.token, card._id, "hard")).status, 200);
  assert.equal((await rate(owner.token, card._id, "hard")).status, 200);
  let progress = await FlashcardReviewProgress.findOne({ cardId: card._id }); assert.equal(progress.reviewCount, 2); assert.equal(progress.intervalMinutes, 2160);
  assert.equal((await rate(owner.token, card._id, "easy")).status, 200);
  progress = await FlashcardReviewProgress.findOne({ cardId: card._id }); assert.equal(progress.intervalMinutes, 4320);
  assert.equal((await rate(owner.token, card._id, "again")).status, 200);
  progress = await FlashcardReviewProgress.findOne({ cardId: card._id }); assert.equal(progress.intervalMinutes, 10); assert.equal(progress.lastRating, "again"); assert.equal(progress.reviewCount, 4);
  await FlashcardReviewProgress.updateOne({ _id: progress._id }, { $set: { intervalMinutes: 60 * 1440 } });
  await rate(owner.token, card._id, "easy"); progress = await FlashcardReviewProgress.findById(progress._id); assert.equal(progress.intervalMinutes, 60 * 1440); assert.equal(await FlashcardReviewProgress.countDocuments({ userId: owner.user._id, cardId: card._id }), 1);
});

test("concurrent ratings retain both successful updates in one progress record", async () => {
  const owner = await student(); const card = await createCard(owner);
  const responses = await Promise.all([rate(owner.token, card._id, "hard"), rate(owner.token, card._id, "easy")]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  const records = await FlashcardReviewProgress.find({ userId: owner.user._id, cardType: "personal", cardId: card._id });
  assert.equal(records.length, 1);
  const [progress] = records;
  assert.equal(progress.reviewCount, 2); assert.ok(["hard", "easy"].includes(progress.lastRating)); assert.ok(progress.lastReviewedAt instanceof Date); assert.ok(progress.nextReviewAt instanceof Date); assert.ok(progress.nextReviewAt > progress.lastReviewedAt); assert.ok(progress.intervalMinutes >= 1);
});

test("due and summary return only existing owned overdue cards in oldest-due order", async () => {
  const owner = await student(); const other = await student(); const oldest = await createCard(owner); const newer = await createCard(owner); const future = await createCard(owner); const otherCard = await createCard(other); const now = new Date();
  await FlashcardReviewProgress.insertMany([
    { userId: owner.user._id, cardType: "personal", cardId: oldest._id, lastReviewedAt: now, nextReviewAt: new Date(now - 60000), lastRating: "again", reviewCount: 1, intervalMinutes: 10 },
    { userId: owner.user._id, cardType: "personal", cardId: newer._id, lastReviewedAt: now, nextReviewAt: new Date(now - 1000), lastRating: "hard", reviewCount: 1, intervalMinutes: 1440 },
    { userId: owner.user._id, cardType: "personal", cardId: future._id, lastReviewedAt: now, nextReviewAt: new Date(now.getTime() + 60000), lastRating: "easy", reviewCount: 1, intervalMinutes: 4320 },
    { userId: other.user._id, cardType: "personal", cardId: otherCard._id, lastReviewedAt: now, nextReviewAt: new Date(now - 60000), lastRating: "again", reviewCount: 1, intervalMinutes: 10 },
    { userId: owner.user._id, cardType: "personal", cardId: new mongoose.Types.ObjectId(), lastReviewedAt: now, nextReviewAt: new Date(now - 60000), lastRating: "again", reviewCount: 1, intervalMinutes: 10 },
  ]);
  const summary = await request("/flashcard-reviews/summary?scope=personal", { token: owner.token }); assert.equal(summary.status, 200); assert.equal((await json(summary)).dueCount, 2);
  const due = await request("/flashcard-reviews/due?scope=personal&limit=20", { token: owner.token }); assert.equal(due.status, 200); const dueBody = await json(due);
  assert.deepEqual(dueBody.reviews.map((entry) => String(entry.card._id)), [String(oldest._id), String(newer._id)]);
  assert.equal(await FlashcardReviewProgress.countDocuments({ userId: owner.user._id, cardId: { $nin: [oldest._id, newer._id, future._id] } }), 0);
  assert.equal((await request("/flashcard-reviews/due?scope=public", { token: owner.token })).status, 400); assert.equal((await request("/flashcard-reviews/due?scope=personal&limit=0", { token: owner.token })).status, 400); assert.equal((await request("/flashcard-reviews/due?scope=personal&limit=not-a-number", { token: owner.token })).status, 400); assert.equal((await request("/flashcard-reviews/due?scope=personal&limit=51", { token: owner.token })).status, 400); assert.equal((await request("/flashcard-reviews/due?scope=personal&limit=50", { token: owner.token })).status, 200);
});

test("deleting a personal card or set removes only its owner review progress", async () => {
  const owner = await student(); const other = await student(); const deck = await PersonalFlashcardDeck.create({ ownerId: owner.user._id, name: "Delete me" }); const card = await PersonalFlashcard.create({ ownerId: owner.user._id, deckId: deck._id, prompt: "One", answer: "One" }); const otherCard = await createCard(other); const now = new Date();
  await FlashcardReviewProgress.insertMany([
    { userId: owner.user._id, cardType: "personal", cardId: card._id, lastReviewedAt: now, nextReviewAt: now, lastRating: "again", reviewCount: 1, intervalMinutes: 10 },
    { userId: other.user._id, cardType: "personal", cardId: otherCard._id, lastReviewedAt: now, nextReviewAt: now, lastRating: "again", reviewCount: 1, intervalMinutes: 10 },
  ]);
  assert.equal((await request(`/my-flashcards/decks/${deck._id}/cards/${card._id}`, { method: "DELETE", token: owner.token })).status, 200);
  assert.equal(await FlashcardReviewProgress.countDocuments({ userId: owner.user._id }), 0);
  const deckCards = await PersonalFlashcard.create([{ ownerId: owner.user._id, deckId: deck._id, prompt: "Two", answer: "Two" }, { ownerId: owner.user._id, deckId: deck._id, prompt: "Three", answer: "Three" }]);
  await FlashcardReviewProgress.insertMany(deckCards.map((deckCard) => ({ userId: owner.user._id, cardType: "personal", cardId: deckCard._id, lastReviewedAt: now, nextReviewAt: now, lastRating: "again", reviewCount: 1, intervalMinutes: 10 })));
  assert.equal((await request(`/my-flashcards/decks/${deck._id}`, { method: "DELETE", token: owner.token })).status, 200);
  assert.equal(await PersonalFlashcardDeck.exists({ _id: deck._id }), null); assert.equal(await PersonalFlashcard.countDocuments({ deckId: deck._id }), 0); assert.equal(await FlashcardReviewProgress.countDocuments({ userId: owner.user._id }), 0); assert.equal(await FlashcardReviewProgress.countDocuments({ userId: other.user._id }), 1);
});
