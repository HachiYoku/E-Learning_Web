const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "checkout-calculation-test-secret";
const Course = require("../models/courseModel");
const PaymentMethod = require("../models/paymentMethodModel");
const PromoCode = require("../models/promoCodeModel");
const Payment = require("../models/paymentModel");
const PromoRedemption = require("../models/promoRedemptionModel");
const User = require("../models/userModel");

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer(); server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); });
});
const stop = (child) => new Promise((resolve) => {
  if (!child || child.exitCode !== null) return resolve();
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM");
});
const closeServer = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
const oid = () => new mongoose.Types.ObjectId();
let mongo; let directory; let base; let appServer; let userId; let accessToken;
const auth = () => ({ Authorization: `Bearer ${accessToken}` });
const request = async (route, { method = "GET", body, headers = auth() } = {}) => {
  const response = await fetch(`${base}${route}`, { method, headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
};
async function course({ thb = [4000, 4000], mmk = [120000, 120000], published = true } = {}) {
  return Course.create({ title: `Course ${Date.now()}-${Math.random()}`, price: thb[0], originalPrice: thb[1], isPublished: published, createdBy: oid(), prices: { THB: { price: thb[0], originalPrice: thb[1] }, ...(mmk ? { MMK: { price: mmk[0], originalPrice: mmk[1] } } : {}) } });
}
async function method(currency, fields = {}) {
  return PaymentMethod.create({ name: `${currency} ${fields.type || "qr"} ${Math.random()}`, currency, type: fields.type || "qr", provider: "manual", instructions: "Pay exactly the quoted amount", recipient: { accountName: "Receiver" }, qrImage: { url: "https://example.test/qr.png" }, isActive: fields.isActive ?? true, createdBy: oid(), updatedBy: oid() });
}
async function promo(fields = {}) {
  return PromoCode.create({ code: `QUOTE-${Date.now()}-${Math.floor(Math.random() * 100000)}`, discountType: "percent", discountValue: 10, ...fields });
}

before(async () => {
  const port = await freePort(); directory = await fs.mkdtemp(path.join(os.tmpdir(), "checkout-calculation-"));
  mongo = spawn("mongod", ["--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000); mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } }); mongo.once("error", reject); });
  await mongoose.connect(`mongodb://127.0.0.1:${port}/checkout_calculation`);
  const user = await User.create({ name: "Checkout Student", email: "checkout-student@example.test", password: "test-only-password", isActive: true, isVerified: true });
  userId = user._id; accessToken = jwt.sign({ id: String(userId), sessionVersion: 0 }, process.env.JWT_SECRET);
  const app = express(); app.use(express.json()); app.use("/payments", require("../routes/payment"));
  appServer = app.listen(0, "127.0.0.1"); await new Promise((resolve) => appServer.once("listening", resolve)); base = `http://127.0.0.1:${appServer.address().port}`;
});
after(async () => { await closeServer(appServer); await mongoose.disconnect(); await stop(mongo); if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });
beforeEach(async () => { await Promise.all([Course.deleteMany({}), PaymentMethod.deleteMany({}), PromoCode.deleteMany({}), Payment.deleteMany({}), PromoRedemption.deleteMany({})]); });

test("returns THB and MMK quotes from the selected active method, with currency-safe rounding", async () => {
  const item = await course({ thb: [4000, 4000], mmk: [100001, 100001] }); const thb = await method("THB"); const mmk = await method("MMK");
  const percent = await promo({ discountValue: 10 });
  let result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: thb._id, promoCode: percent.code } });
  assert.equal(result.status, 200); assert.deepEqual({ currency: result.body.currency, originalAmount: result.body.originalAmount, discountAmount: result.body.discountAmount, amount: result.body.amount }, { currency: "THB", originalAmount: 4000, discountAmount: 400, amount: 3600 });
  result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: mmk._id, promoCode: percent.code } });
  assert.equal(result.status, 200); assert.deepEqual({ currency: result.body.currency, originalAmount: result.body.originalAmount, discountAmount: result.body.discountAmount, amount: result.body.amount }, { currency: "MMK", originalAmount: 100001, discountAmount: 10000, amount: 90001 });
});

test("lists only active methods whose currency has a course price", async () => {
  const item = await course({ mmk: null }); const thb = await method("THB"); await method("MMK"); await method("THB", { isActive: false, type: "wallet" });
  const result = await request(`/payments/course/${item._id}/methods`);
  assert.equal(result.status, 200); assert.deepEqual(result.body.map((entry) => entry.id), [String(thb._id)]);
  assert.equal(result.body[0].currency, "THB"); assert.equal(result.body[0].provider, "manual");
});

test("rejects inactive methods and currencies unavailable for the course", async () => {
  const item = await course({ mmk: null }); const inactive = await method("THB", { isActive: false }); const mmk = await method("MMK");
  let result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: inactive._id } });
  assert.equal(result.status, 400); assert.match(result.body.message, /method is unavailable/);
  result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: mmk._id } });
  assert.equal(result.status, 400); assert.match(result.body.message, /unavailable for the selected payment currency/);
});

test("supports fixed promos only in their configured currency", async () => {
  const item = await course(); const thb = await method("THB"); const mmk = await method("MMK"); const fixed = await promo({ discountType: "fixed", discountValue: 999, fixedAmounts: { THB: 125, MMK: 7000 } }); const thbOnly = await promo({ discountType: "fixed", discountValue: 100, fixedAmounts: { THB: 100 } });
  let result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: thb._id, promoCode: fixed.code } });
  assert.equal(result.status, 200); assert.equal(result.body.discountAmount, 125); assert.equal(result.body.amount, 3875);
  result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: mmk._id, promoCode: fixed.code } });
  assert.equal(result.status, 200); assert.equal(result.body.discountAmount, 7000); assert.equal(result.body.amount, 113000);
  result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: mmk._id, promoCode: thbOnly.code } });
  assert.equal(result.status, 400); assert.match(result.body.message, /not available for the selected payment currency/);
});

test("rejects promos on an already-discounted selected currency price", async () => {
  const item = await course({ thb: [3900, 4000] }); const thb = await method("THB"); const offer = await promo();
  const result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: thb._id, promoCode: offer.code } });
  assert.equal(result.status, 400); assert.match(result.body.message, /already discounted/);
});

test("ignores forged financial fields and creates no payment, redemption, or promo reservation", async () => {
  const item = await course(); const thb = await method("THB"); const offer = await promo({ discountValue: 25, usageLimit: 1 });
  const result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: thb._id, promoCode: offer.code, amount: 1, currency: "MMK", discountAmount: 3999, recipient: { accountNumber: "forged" }, price: 1 } });
  assert.equal(result.status, 200); assert.equal(result.body.currency, "THB"); assert.equal(result.body.amount, 3000);
  assert.equal(await Payment.countDocuments(), 0); assert.equal(await PromoRedemption.countDocuments(), 0); assert.equal((await PromoCode.findById(offer._id)).usageCount, 0);
});

test("rereads method and course state on every quote; quotes are not guarantees", async () => {
  const item = await course(); const thb = await method("THB");
  let result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: thb._id } });
  assert.equal(result.status, 200); assert.equal(result.body.amount, 4000); assert.equal(result.body.coursePrice.mutationVersion, 0);
  await Course.updateOne({ _id: item._id }, { $set: { "prices.THB.price": 3500 }, $inc: { mutationVersion: 1 } });
  result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: thb._id } });
  assert.equal(result.status, 200); assert.equal(result.body.amount, 3500); assert.equal(result.body.coursePrice.mutationVersion, 1);
  await PaymentMethod.updateOne({ _id: thb._id }, { $set: { isActive: false }, $inc: { mutationVersion: 1 } });
  result = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: thb._id } });
  assert.equal(result.status, 400);
});

test("requires authentication and does not use profile, locale, or old QR data to select a method", async () => {
  const item = await course();
  const unauthenticated = await request(`/payments/course/${item._id}/methods`, { headers: {} });
  assert.equal(unauthenticated.status, 401);
  const authenticated = await request(`/payments/course/${item._id}/quote`, { method: "POST", body: { paymentMethodId: oid(), currency: "THB" } });
  assert.equal(authenticated.status, 400); assert.match(authenticated.body.message, /method is unavailable/);
});
