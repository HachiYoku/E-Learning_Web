const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { calculatePromoDiscount } = require("../services/promoCodePolicy");
const { rollbackFailedPaymentCreation } = require("../controllers/paymentController");

const backendDirectory = path.resolve(__dirname, "..");
const jwtSecret = "promo-test-secret-only-not-for-production";
const password = "CorrectHorseBattery1";
let mongoDirectory, mongoProcess, apiProcess, apiBaseUrl, mongoUri;
let User, Course, Payment, PromoCode, PromoRedemption;

function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); }); }); }
function waitForOutput(child, text) { return new Promise((resolve, reject) => { let output = ""; const append = (chunk) => { output = `${output}${chunk}`.slice(-3000); }; const done = (error) => { clearTimeout(timer); child.stdout.off("data", onData); child.stderr.off("data", append); child.off("exit", onExit); error ? reject(error) : resolve(); }; const timer = setTimeout(() => done(new Error(`Timed out waiting for ${text}: ${output}`)), 15000); const onData = (chunk) => { append(chunk); if (chunk.toString().includes(text)) done(); }; const onExit = () => done(new Error(`Server stopped: ${output}`)); child.stdout.on("data", onData); child.stderr.on("data", append); child.once("exit", onExit); }); }
function stop(child) { return new Promise((resolve) => { if (!child || child.exitCode !== null) return resolve(); const timer = setTimeout(() => child.kill("SIGKILL"), 5000); child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM"); }); }
async function user(email, role = "user") { return User.create({ name: email, email, password: await bcrypt.hash(password, 10), role, isActive: true, isVerified: true }); }
async function login(email) { const response = await fetch(`${apiBaseUrl}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://student.example.test", "X-Auth-Portal": "student" }, body: JSON.stringify({ email, password }) }); assert.equal(response.status, 200); return (await response.json()).accessToken; }
async function request(route, { method = "GET", token, body } = {}) { return fetch(`${apiBaseUrl}${route}`, { method, headers: { Origin: "https://student.example.test", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
async function course(owner, price = 3000) { return Course.create({ title: `Course ${Date.now()}-${Math.random()}`, price, createdBy: owner._id }); }
async function promo(fields = {}) { return PromoCode.create({ code: `PROMO-${Date.now()}-${Math.floor(Math.random() * 10000)}`, discountType: "fixed", discountValue: 500, ...fields }); }
async function body(response) { return response.json(); }

before(async () => {
  const mongoPort = await freePort(); const apiPort = await freePort();
  mongoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "arun-thai-promo-test-")); mongoUri = `mongodb://127.0.0.1:${mongoPort}/promo_test`;
  mongoProcess = spawn("mongod", ["--port", String(mongoPort), "--dbpath", mongoDirectory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] }); await waitForOutput(mongoProcess, "Waiting for connections");
  apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  apiProcess = spawn(process.execPath, ["server.js"], { cwd: backendDirectory, env: { ...process.env, NODE_ENV: "production", PORT: String(apiPort), MONGO_DB: mongoUri, JWT_SECRET: jwtSecret, BACKEND_URL: "https://api.example.test", FRONTEND_URL_PROD: "https://student.example.test", ADMIN_URL_PROD: "https://admin.example.test", TRUST_PROXY: "true" }, stdio: ["ignore", "pipe", "pipe"] }); await waitForOutput(apiProcess, "Example app listening");
  await mongoose.connect(mongoUri); User = require("../models/userModel"); Course = require("../models/courseModel"); Payment = require("../models/paymentModel"); PromoCode = require("../models/promoCodeModel"); PromoRedemption = require("../models/promoRedemptionModel");
});
after(async () => { await mongoose.disconnect(); await Promise.all([stop(apiProcess), stop(mongoProcess)]); if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });

test("promo edits require the current admin password and persist both availability states", async () => {
  const admin = await user(`admin-toggle-${Date.now()}@example.test`, "admin");
  const token = await login(admin.email);
  const item = await promo();
  const route = `/promo-codes/admin/${item._id}`;
  for (const [adminPassword, expected] of [[undefined, 400], ["incorrect-password", 403]]) {
    const response = await request(route, { method: "PUT", token, body: { ...item.toObject(), isActive: false, adminPassword } });
    assert.equal(response.status, expected);
    assert.equal((await PromoCode.findById(item._id)).isActive, true);
  }
  for (const isActive of [false, true]) {
    const response = await request(route, { method: "PUT", token, body: { ...item.toObject(), isActive, adminPassword: password } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).isActive, isActive);
    assert.equal((await PromoCode.findById(item._id)).isActive, isActive);
  }
});

test("calculates percentage and fixed discounts and never returns a negative total", () => {
  assert.deepEqual(calculatePromoDiscount(3000, { discountType: "percent", discountValue: 25 }), { originalAmount: 3000, discountAmount: 750, finalAmount: 2250 });
  assert.deepEqual(calculatePromoDiscount(3000, { discountType: "fixed", discountValue: 500 }), { originalAmount: 3000, discountAmount: 500, finalAmount: 2500 });
  assert.deepEqual(calculatePromoDiscount(3000, { discountType: "fixed", discountValue: 9000 }), { originalAmount: 3000, discountAmount: 3000, finalAmount: 0 });
});

test("validation provides safe availability messages and recalculates from the server course price", async () => {
  const student = await user(`student-status-${Date.now()}@example.test`); const token = await login(student.email); const first = await course(student, 3000); const second = await course(student, 4000);
  const cases = [
    [{ isActive: false }, "This promo code is inactive."],
    [{ startsAt: new Date(Date.now() + 86400000) }, "This promo code is not available yet."],
    [{ expiresAt: new Date(Date.now() - 86400000) }, "This promo code has expired."],
    [{ usageLimit: 1, usageCount: 1 }, "This promo code has reached its usage limit."],
    [{ applicableCourses: [second._id] }, "This promo code is not available for this course."],
  ];
  for (const [fields, message] of cases) { const item = await promo(fields); const response = await request("/promo-codes/validate", { method: "POST", token, body: { code: item.code, courseId: first._id } }); assert.equal(response.status, 400); assert.equal((await body(response)).message, message); }
  const allCourses = await promo({ discountType: "percent", discountValue: 10 });
  let response = await request("/promo-codes/validate", { method: "POST", token, body: { code: allCourses.code.toLowerCase(), courseId: first._id, finalAmount: 1, price: 1 } }); assert.equal(response.status, 200); let result = await body(response); assert.equal(result.originalAmount, 3000); assert.equal(result.discountAmount, 300); assert.equal(result.finalAmount, 2700);
  await PromoRedemption.create({ promoCode: allCourses._id, userId: student._id }); response = await request("/promo-codes/validate", { method: "POST", token, body: { code: allCourses.code, courseId: first._id } }); assert.equal(response.status, 400); assert.equal((await body(response)).message, "You have already used this promo code.");
  const selected = await promo({ applicableCourses: [second._id] }); response = await request("/promo-codes/validate", { method: "POST", token, body: { code: selected.code, courseId: second._id } }); assert.equal(response.status, 200);
});

test("duplicate user redemption is denied, while separate users cannot oversell the final capacity", async () => {
  const owner = await user(`owner-capacity-${Date.now()}@example.test`); const first = await user(`first-capacity-${Date.now()}@example.test`); const second = await user(`second-capacity-${Date.now()}@example.test`); const item = await promo({ usageLimit: 1 });
  const reserve = async (student) => {
    const redemption = await PromoRedemption.create({ promoCode: item._id, userId: student._id });
    const updated = await PromoCode.findOneAndUpdate({ _id: item._id, isActive: true, $and: [{ $or: [{ usageLimit: null }, { $expr: { $lt: ["$usageCount", "$usageLimit"] } }] }] }, { $inc: { usageCount: 1 } }, { new: true });
    if (!updated) await PromoRedemption.deleteOne({ _id: redemption._id });
    return Boolean(updated);
  };
  const outcomes = await Promise.all([reserve(first), reserve(second)]); assert.equal(outcomes.filter(Boolean).length, 1); assert.equal((await PromoCode.findById(item._id)).usageCount, 1);
  await assert.rejects(PromoRedemption.create({ promoCode: item._id, userId: outcomes[0] ? first._id : second._id }), /duplicate key/);
  void owner;
});

test("a rejected payment releases promo capacity; an approved payment retains its redemption", async () => {
  const admin = await user(`admin-review-${Date.now()}@example.test`, "admin"); const student = await user(`student-review-${Date.now()}@example.test`); const adminToken = await login(admin.email); const item = await promo({ usageLimit: 2, usageCount: 1 }); const itemCourse = await course(admin, 3000);
  const redemption = await PromoRedemption.create({ promoCode: item._id, userId: student._id }); const rejected = await Payment.create({ userId: student._id, courseId: itemCourse._id, amount: 2500, originalAmount: 3000, discountAmount: 500, promoCode: item.code, promoRedemptionId: redemption._id, status: "pending" }); await PromoRedemption.updateOne({ _id: redemption._id }, { paymentId: rejected._id });
  let response = await request(`/payments/${rejected._id}/reject`, { method: "PATCH", token: adminToken, body: { adminPassword: password, rejectReason: "Receipt is not readable" } }); assert.equal(response.status, 200); assert.equal(await PromoRedemption.exists({ _id: redemption._id }), null); assert.equal((await PromoCode.findById(item._id)).usageCount, 0);
  const retained = await PromoRedemption.create({ promoCode: item._id, userId: student._id }); const pending = await Payment.create({ userId: student._id, courseId: itemCourse._id, amount: 2500, originalAmount: 3000, discountAmount: 500, promoCode: item.code, promoRedemptionId: retained._id, status: "pending" }); response = await request(`/payments/${pending._id}/approve`, { method: "PATCH", token: adminToken, body: { adminPassword: password } }); assert.equal(response.status, 200); assert.ok(await PromoRedemption.exists({ _id: retained._id }));
});

test("payment persistence failure cleans up the uploaded proof and releases its promo reservation", async () => {
  const student = await user(`student-rollback-${Date.now()}@example.test`); const item = await promo({ usageLimit: 2, usageCount: 1 }); const reservation = await PromoRedemption.create({ promoCode: item._id, userId: student._id }); let deletedProof;
  await rollbackFailedPaymentCreation({ proofPublicId: "private-proof-id", redemptionId: reservation._id, promoId: item._id, deleteProof: async (publicId) => { deletedProof = publicId; } });
  assert.equal(deletedProof, "private-proof-id"); assert.equal(await PromoRedemption.exists({ _id: reservation._id }), null); assert.equal((await PromoCode.findById(item._id)).usageCount, 0);
});

test("used promos are immutable financial history, archive instead of delete, and require admin authorization", async () => {
  const admin = await user(`admin-history-${Date.now()}@example.test`, "admin"); const student = await user(`student-history-${Date.now()}@example.test`); const adminToken = await login(admin.email); const studentToken = await login(student.email); const itemCourse = await course(admin, 3000); const item = await promo({ code: `HISTORY-${Date.now()}`, applicableCourses: [itemCourse._id] }); const payment = await Payment.create({ userId: student._id, courseId: itemCourse._id, amount: 2500, originalAmount: 3000, discountAmount: 500, promoCode: item.code, status: "approved" });
  let response = await request(`/promo-codes/admin/${item._id}`, { method: "PUT", token: studentToken, body: { ...item.toObject(), discountValue: 700 } }); assert.equal(response.status, 403);
  response = await request(`/promo-codes/admin/${item._id}`, { method: "PUT", token: adminToken, body: { ...item.toObject(), adminPassword: password, discountValue: 700 } }); assert.equal(response.status, 400); assert.match((await body(response)).message, /payment history/);
  response = await request(`/promo-codes/admin/${item._id}`, { method: "DELETE", token: adminToken, body: { adminPassword: password } }); assert.equal(response.status, 200); const archived = await body(response); assert.equal(archived.archived, true); const persisted = await PromoCode.findById(item._id); assert.ok(persisted.archivedAt); assert.equal(persisted.isActive, false); const snapshot = await Payment.findById(payment._id); assert.equal(snapshot.originalAmount, 3000); assert.equal(snapshot.discountAmount, 500); assert.equal(snapshot.amount, 2500); assert.equal(snapshot.promoCode, item.code);
});
