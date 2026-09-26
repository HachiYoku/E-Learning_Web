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
const jwtSecret = "personal-flashcards-test-secret-only-not-for-production";
let mongoDirectory;
let mongoProcess;
let apiProcess;
let apiBaseUrl;
let User;
let PersonalFlashcardDeck;
let PersonalFlashcard;
let Flashcard;
let FlashcardCategory;
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
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function createUser(role = "user") {
  const email = `${unique("student")}@example.test`;
  return User.create({ name: email, email, password: await bcrypt.hash(password, 10), role, isActive: true, isVerified: true });
}

async function login(user) {
  const response = await request("/auth/login", { method: "POST", body: { email: user.email, password } });
  assert.equal(response.status, 200);
  return (await response.json()).accessToken;
}

async function student() {
  const user = await createUser();
  return { user, token: await login(user) };
}

async function createDeck(token, name, extra = {}) {
  const response = await request("/my-flashcards/decks", { method: "POST", token, body: { name, ...extra } });
  return { response, body: await response.json() };
}

before(async () => {
  const mongoPort = await freePort();
  const apiPort = await freePort();
  mongoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-personal-flashcards-test-"));
  const mongoUri = `mongodb://127.0.0.1:${mongoPort}/personal_flashcards_test?replicaSet=paymentTests`;
  mongoProcess = spawn("mongod", ["--replSet", "paymentTests", "--port", String(mongoPort), "--dbpath", mongoDirectory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await waitForOutput(mongoProcess, "Waiting for connections");
  await require("./helpers/replicaSet").initiateReplicaSet(mongoPort);

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
  PersonalFlashcardDeck = require("../models/personalFlashcardDeckModel");
  PersonalFlashcard = require("../models/personalFlashcardModel");
  Flashcard = require("../models/flashcardModel");
  FlashcardCategory = require("../models/flashcardCategoryModel");
  await Promise.all([PersonalFlashcardDeck.init(), PersonalFlashcard.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await Promise.all([stopProcess(apiProcess), stopProcess(mongoProcess)]);
  if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test("personal flashcard routes require authentication", async () => {
  const response = await request("/my-flashcards/decks");
  assert.equal(response.status, 401);
});

test("a student can create, list, rename, and delete only their own deck", async () => {
  const owner = await student();
  const created = await createDeck(owner.token, "Work Vocabulary", { ownerId: new mongoose.Types.ObjectId().toString(), userId: new mongoose.Types.ObjectId().toString() });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.cardCount, 0);
  const stored = await PersonalFlashcardDeck.findById(created.body._id);
  assert.equal(String(stored.ownerId), String(owner.user._id));

  const listed = await request("/my-flashcards/decks", { token: owner.token });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).find((deck) => deck._id === created.body._id).name, "Work Vocabulary");

  const renamed = await request(`/my-flashcards/decks/${created.body._id}`, { method: "PUT", token: owner.token, body: { name: "Work words", ownerId: new mongoose.Types.ObjectId().toString() } });
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).name, "Work words");

  const deleted = await request(`/my-flashcards/decks/${created.body._id}`, { method: "DELETE", token: owner.token });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).deletedCardCount, 0);
  assert.equal(await PersonalFlashcardDeck.exists({ _id: created.body._id }), null);
});

test("deck names are unique per owner but may be shared by different students", async () => {
  const first = await student();
  const second = await student();
  assert.equal((await createDeck(first.token, "Daily Thai")).response.status, 201);
  const duplicate = await createDeck(first.token, "Daily Thai");
  assert.equal(duplicate.response.status, 409);
  assert.equal((await createDeck(second.token, "Daily Thai")).response.status, 201);
});

test("a student can create, list, edit, and delete cards in an owned deck", async () => {
  const owner = await student();
  const deck = await createDeck(owner.token, "Travel");
  const create = await request(`/my-flashcards/decks/${deck.body._id}/cards`, { method: "POST", token: owner.token, body: { prompt: "Hello", answer: "Sawasdee", ownerId: new mongoose.Types.ObjectId().toString() } });
  assert.equal(create.status, 201);
  const card = await create.json();
  const stored = await PersonalFlashcard.findById(card._id);
  assert.equal(String(stored.ownerId), String(owner.user._id));

  const listed = await request(`/my-flashcards/decks/${deck.body._id}/cards`, { token: owner.token });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).length, 1);
  const updated = await request(`/my-flashcards/decks/${deck.body._id}/cards/${card._id}`, { method: "PUT", token: owner.token, body: { prompt: "Good morning", answer: "Sawasdee ton chao", userId: new mongoose.Types.ObjectId().toString() } });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).prompt, "Good morning");
  const deleted = await request(`/my-flashcards/decks/${deck.body._id}/cards/${card._id}`, { method: "DELETE", token: owner.token });
  assert.equal(deleted.status, 200);
  assert.equal(await PersonalFlashcard.exists({ _id: card._id }), null);
});

test("invalid and missing personal deck/card identifiers return generic not found responses", async () => {
  const owner = await student();
  const deck = await createDeck(owner.token, "Identifiers");
  for (const route of ["/my-flashcards/decks/not-an-id", "/my-flashcards/decks/not-an-id/cards", `/my-flashcards/decks/${deck.body._id}/cards/not-an-id`]) {
    const response = await request(route, { method: route.includes("cards/not") ? "DELETE" : "GET", token: owner.token });
    assert.equal(response.status, 404);
  }
  const missing = new mongoose.Types.ObjectId();
  assert.equal((await request(`/my-flashcards/decks/${missing}/cards`, { token: owner.token })).status, 404);
  assert.equal((await request(`/my-flashcards/decks/${deck.body._id}/cards/${missing}`, { method: "DELETE", token: owner.token })).status, 404);
});

test("students cannot access or mutate another student's decks or cards", async () => {
  const first = await student();
  const second = await student();
  const deck = await createDeck(first.token, "Private");
  const cardResponse = await request(`/my-flashcards/decks/${deck.body._id}/cards`, { method: "POST", token: first.token, body: { prompt: "Private front", answer: "Private back" } });
  const card = await cardResponse.json();

  assert.equal((await request(`/my-flashcards/decks/${deck.body._id}/cards`, { token: second.token })).status, 404);
  assert.equal((await request(`/my-flashcards/decks/${deck.body._id}/cards`, { method: "POST", token: second.token, body: { prompt: "No", answer: "No" } })).status, 404);
  assert.equal((await request(`/my-flashcards/decks/${deck.body._id}/cards/${card._id}`, { method: "PUT", token: second.token, body: { prompt: "No", answer: "No" } })).status, 404);
  assert.equal((await request(`/my-flashcards/decks/${deck.body._id}/cards/${card._id}`, { method: "DELETE", token: second.token })).status, 404);
  assert.equal((await request(`/my-flashcards/decks/${deck.body._id}`, { method: "DELETE", token: second.token })).status, 404);
  assert.ok(await PersonalFlashcardDeck.exists({ _id: deck.body._id, ownerId: first.user._id }));
  assert.ok(await PersonalFlashcard.exists({ _id: card._id, ownerId: first.user._id }));
});

test("deleting an owned deck transactionally removes all of its cards", async () => {
  const owner = await student();
  const deck = await createDeck(owner.token, "Temporary");
  await Promise.all(["One", "Two"].map((prompt) => request(`/my-flashcards/decks/${deck.body._id}/cards`, { method: "POST", token: owner.token, body: { prompt, answer: prompt } })));
  const deleted = await request(`/my-flashcards/decks/${deck.body._id}`, { method: "DELETE", token: owner.token });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).deletedCardCount, 2);
  assert.equal(await PersonalFlashcardDeck.exists({ _id: deck.body._id }), null);
  assert.equal(await PersonalFlashcard.countDocuments({ deckId: deck.body._id }), 0);
});

test("personal cards never appear in public flashcards and existing public/admin APIs remain separate", async () => {
  const owner = await student();
  const admin = await createUser("admin");
  const adminToken = await login(admin);
  const personalDeck = await createDeck(owner.token, "Hidden");
  await request(`/my-flashcards/decks/${personalDeck.body._id}/cards`, { method: "POST", token: owner.token, body: { prompt: "PERSONAL_ONLY_CARD", answer: "Secret" } });
  const category = await FlashcardCategory.create({ name: unique("Public category") });
  const publicCard = await Flashcard.create({ prompt: "PUBLIC_CARD", answer: "Visible", category: category._id, isPublished: true });
  const draftCard = await Flashcard.create({ prompt: "DRAFT_CARD", answer: "Hidden", category: category._id, isPublished: false });

  const publicResponse = await request("/flashcards");
  assert.equal(publicResponse.status, 200);
  const publicCards = await publicResponse.json();
  assert.ok(publicCards.some((card) => String(card._id) === String(publicCard._id)));
  assert.ok(!publicCards.some((card) => card.prompt === "DRAFT_CARD" || card.prompt === "PERSONAL_ONLY_CARD"));

  const adminResponse = await request("/flashcards/admin", { token: adminToken });
  assert.equal(adminResponse.status, 200);
  const adminCards = await adminResponse.json();
  assert.ok(adminCards.some((card) => String(card._id) === String(draftCard._id)));
  assert.ok(!adminCards.some((card) => card.prompt === "PERSONAL_ONLY_CARD"));
});
