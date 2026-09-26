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
const bcrypt = require("bcryptjs");
const { initiateReplicaSet } = require("./helpers/replicaSet");

process.env.JWT_SECRET = "admin-multi-currency-test-secret";
const User = require("../models/userModel");
const Course = require("../models/courseModel");
const PaymentMethod = require("../models/paymentMethodModel");
const Payment = require("../models/paymentModel");
const PromoCode = require("../models/promoCodeModel");
const PromoRedemption = require("../models/promoRedemptionModel");
const AuditLog = require("../models/auditLogModel");

const PASSWORD = "AdminManagementPassword123";
const oid = () => new mongoose.Types.ObjectId();
const token = (user) => jwt.sign({ id: String(user._id), sessionVersion: Number(user.sessionVersion || 0) }, process.env.JWT_SECRET);
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer(); server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); });
});
const stop = (child) => new Promise((resolve) => {
  if (!child || child.exitCode !== null) return resolve();
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM");
});
let mongo; let directory; let server; let base; let admin; let student;
const request = async (route, { method = "GET", body, access = token(admin) } = {}) => {
  const response = await fetch(`${base}${route}`, { method, headers: { ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
};
const adminMethod = (overrides = {}) => ({
  name: "Manual method", currency: "THB", type: "qr", provider: "manual", instructions: "Use the stated reference", recipient: { accountName: "Arun Thai", accountNumber: "123" }, adminPassword: PASSWORD, ...overrides,
});
const courseFields = (prices, extra = {}) => ({ title: `Course ${Date.now()}-${Math.random()}`, isPublished: true, prices, ...extra });

before(async () => {
  const port = await freePort(); directory = await fs.mkdtemp(path.join(os.tmpdir(), "admin-multi-currency-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000); mongo.stdout.on("data", (chunk) => { if (chunk.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } }); mongo.once("error", reject); });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/admin_multi_currency?replicaSet=paymentTests`);
  const app = express(); app.use(express.json()); app.use("/payment-methods", require("../routes/paymentMethod")); app.use("/courses", require("../routes/course")); app.use("/promo-codes", require("../routes/promoCode")); app.use("/payments", require("../routes/payment"));
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve)); base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  await Promise.all([Payment.deleteMany({}), PromoRedemption.deleteMany({}), Course.deleteMany({}), PaymentMethod.deleteMany({}), PromoCode.deleteMany({}), AuditLog.deleteMany({}), User.deleteMany({})]);
  admin = await User.create({ name: "Admin", email: "admin-management@example.test", password: await bcrypt.hash(PASSWORD, 4), role: "admin", isActive: true, isVerified: true });
  student = await User.create({ name: "Student", email: "student-management@example.test", password: "student", isActive: true, isVerified: true });
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); await stop(mongo); if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });

test("admin manages THB QR, MMK wallet and bank-transfer methods with validation, password and audit safeguards", async () => {
  let result = await request("/payment-methods/admin", { method: "POST", body: adminMethod() });
  assert.equal(result.status, 201); const thb = result.body; assert.equal(thb.currency, "THB"); assert.equal(thb.type, "qr"); assert.equal(thb.provider, "manual");
  result = await request("/payment-methods/admin", { method: "POST", body: adminMethod({ name: "MMK wallet", currency: "MMK", type: "wallet" }) }); assert.equal(result.status, 201);
  result = await request("/payment-methods/admin", { method: "POST", body: adminMethod({ name: "MMK bank", currency: "MMK", type: "bank_transfer" }) }); assert.equal(result.status, 201);
  result = await request("/payment-methods/admin", { method: "POST", body: adminMethod({ currency: "USD" }) }); assert.equal(result.status, 400);
  result = await request("/payment-methods/admin", { method: "POST", body: adminMethod({ type: "card" }) }); assert.equal(result.status, 400);
  result = await request("/payment-methods/admin", { method: "POST", body: adminMethod({ provider: "stripe" }) }); assert.equal(result.status, 400);
  result = await request("/payment-methods/admin", { method: "POST", body: adminMethod({ adminPassword: "wrong" }) }); assert.equal(result.status, 403);
  result = await request("/payment-methods/admin", { method: "POST", access: token(student), body: adminMethod() }); assert.equal(result.status, 403);
  assert.equal(await AuditLog.countDocuments({ action: "payment_method.created" }), 3);
});

test("payment-method edits and active state only increment configuration versions when meaningful", async () => {
  let result = await request("/payment-methods/admin", { method: "POST", body: adminMethod() }); const id = result.body._id;
  result = await request(`/payment-methods/admin/${id}`, { method: "PUT", body: adminMethod() }); assert.equal(result.status, 200); assert.equal(result.body.mutationVersion, 0);
  result = await request(`/payment-methods/admin/${id}`, { method: "PUT", body: adminMethod({ instructions: "New instructions" }) }); assert.equal(result.status, 200); assert.equal(result.body.mutationVersion, 1);
  result = await request(`/payment-methods/admin/${id}/active`, { method: "PATCH", body: { adminPassword: PASSWORD, isActive: true } }); assert.equal(result.status, 200); assert.equal(result.body.mutationVersion, 1);
  result = await request(`/payment-methods/admin/${id}/active`, { method: "PATCH", body: { adminPassword: PASSWORD, isActive: false } }); assert.equal(result.status, 200); assert.equal(result.body.mutationVersion, 2);
  assert.ok(await AuditLog.exists({ action: "payment_method.updated", targetId: id }));
});

test("payment-method deletion deletes unused methods but archives history-bearing methods without altering payment snapshots", async () => {
  let result = await request("/payment-methods/admin", { method: "POST", body: adminMethod({ name: "Unused" }) });
  result = await request(`/payment-methods/admin/${result.body._id}`, { method: "DELETE", body: { adminPassword: PASSWORD } }); assert.equal(result.status, 200); assert.equal(result.body.deleted, true);
  result = await request("/payment-methods/admin", { method: "POST", body: adminMethod({ name: "Historical" }) }); const method = result.body;
  const course = await Course.create({ title: "History course", price: 100, createdBy: admin._id, prices: { THB: { price: 100, originalPrice: 100 } } });
  const snapshot = { schemaVersion: 1, kind: "method", methodId: method._id, methodVersion: 0, name: method.name, currency: "THB", type: "qr", provider: "manual", instructions: method.instructions, recipient: { accountName: "Arun Thai", accountNumber: "123" }, qrImage: {} };
  const payment = await Payment.create({ userId: student._id, courseId: course._id, amount: 100, originalAmount: 100, discountAmount: 0, currency: "THB", paymentMethodId: method._id, paymentMethodSnapshot: snapshot });
  const snapshotBeforeEdit = JSON.stringify((await Payment.findById(payment._id)).paymentMethodSnapshot.toObject());
  result = await request(`/payment-methods/admin/${method._id}`, { method: "PUT", body: adminMethod({ name: "Renamed historical", instructions: "Changed" }) }); assert.equal(result.status, 200);
  assert.equal(JSON.stringify((await Payment.findById(payment._id)).paymentMethodSnapshot.toObject()), snapshotBeforeEdit);
  result = await request(`/payment-methods/admin/${method._id}`, { method: "DELETE", body: { adminPassword: PASSWORD } }); assert.equal(result.status, 200); assert.equal(result.body.deactivated, true); assert.equal((await PaymentMethod.findById(method._id)).isActive, false);
});

test("student method endpoint exposes checkout-safe data only", async () => {
  const course = await Course.create({ title: "Public", price: 100, createdBy: admin._id, isPublished: true, prices: { THB: { price: 100, originalPrice: 100 } } });
  await PaymentMethod.create({ name: "Safe", currency: "THB", type: "qr", provider: "manual", recipient: { accountNumber: "123" }, createdBy: admin._id, updatedBy: admin._id });
  const result = await request(`/payments/course/${course._id}/methods`, { access: token(student) });
  assert.equal(result.status, 200); assert.equal(result.body.length, 1); assert.equal("createdBy" in result.body[0], false); assert.equal("updatedBy" in result.body[0], false); assert.equal("createdAt" in result.body[0], false);
});

test("course admin supports independent THB/MMK availability and changes pricing versions only for changed pricing", async () => {
  let result = await request("/courses", { method: "POST", body: courseFields({ THB: { price: 100, originalPrice: 120 } }) }); assert.equal(result.status, 201); assert.ok(result.body.prices.THB); assert.equal(result.body.prices.MMK, undefined);
  result = await request("/courses", { method: "POST", body: courseFields({ MMK: { price: 5000, originalPrice: 5000 } }) }); assert.equal(result.status, 201); assert.equal(result.body.price, undefined); assert.ok(result.body.prices.MMK);
  result = await request("/courses", { method: "POST", body: courseFields({ THB: { price: 100, originalPrice: 100 }, MMK: { price: 5000, originalPrice: 6000 } }) }); assert.equal(result.status, 201); const dual = result.body;
  result = await request(`/courses/${dual._id}`, { method: "PUT", body: { prices: dual.prices } }); assert.equal(result.status, 200); assert.equal(result.body.mutationVersion, 0);
  result = await request(`/courses/${dual._id}`, { method: "PUT", body: { prices: { MMK: { price: 5000, originalPrice: 6000 } } } }); assert.equal(result.status, 200); assert.equal(result.body.mutationVersion, 1); assert.equal(result.body.prices.THB, undefined); assert.ok(result.body.prices.MMK);
  result = await request(`/courses/${dual._id}`, { method: "PUT", body: { prices: { THB: { price: 100, originalPrice: 100 } } } }); assert.equal(result.status, 200); assert.ok(result.body.prices.THB); assert.equal(result.body.prices.MMK, undefined);
  result = await request("/courses", { method: "POST", body: courseFields({ THB: { price: 100, originalPrice: 99 } }) }); assert.equal(result.status, 400);
  result = await request("/courses", { method: "POST", body: courseFields({}) }); assert.equal(result.status, 400);
});

test("course legacy THB values remain compatible while MMK does not imply conversion", async () => {
  const legacy = await Course.create({ title: "Legacy", price: 4000, originalPrice: 4500, createdBy: admin._id, isPublished: true });
  let result = await request(`/courses/${legacy._id}`, { method: "PUT", body: { prices: { MMK: { price: 180000, originalPrice: 200000 } } } });
  assert.equal(result.status, 200); assert.equal(result.body.price, 4000); assert.equal(result.body.originalPrice, 4500); assert.equal(result.body.prices.THB, undefined); assert.equal(result.body.prices.MMK.price, 180000);
  result = await request(`/courses/${legacy._id}`, { method: "PUT", body: { prices: {} } }); assert.equal(result.status, 400);
});

test("promo administration keeps percent currency-independent and requires explicit valid fixed currency amounts", async () => {
  let result = await request("/promo-codes/admin", { method: "POST", body: { code: "PERCENT-10", discountType: "percent", discountValue: 10, fixedAmounts: {}, adminPassword: PASSWORD } }); assert.equal(result.status, 201); assert.equal(result.body.fixedAmounts?.THB, undefined); assert.equal(result.body.fixedAmounts?.MMK, undefined);
  result = await request("/promo-codes/admin", { method: "POST", body: { code: "THB-ONLY", discountType: "fixed", discountValue: 300, fixedAmounts: { THB: 300 }, adminPassword: PASSWORD } }); assert.equal(result.status, 201); assert.equal(result.body.fixedAmounts.THB, 300); assert.equal(result.body.fixedAmounts.MMK, undefined);
  result = await request("/promo-codes/admin", { method: "POST", body: { code: "MMK-ONLY", discountType: "fixed", discountValue: 300, fixedAmounts: { MMK: 10000 }, adminPassword: PASSWORD } }); assert.equal(result.status, 201); assert.equal(result.body.fixedAmounts.MMK, 10000);
  result = await request("/promo-codes/admin", { method: "POST", body: { code: "BOTH-AMOUNTS", discountType: "fixed", discountValue: 300, fixedAmounts: { THB: 300, MMK: 10000 }, adminPassword: PASSWORD } }); assert.equal(result.status, 201);
  result = await request("/promo-codes/admin", { method: "POST", body: { code: "BAD-AMOUNT", discountType: "fixed", discountValue: 300, fixedAmounts: { THB: -1 }, adminPassword: PASSWORD } }); assert.equal(result.status, 400);
  result = await request("/promo-codes/admin", { method: "POST", body: { code: "NO-CURRENCY", discountType: "fixed", discountValue: 300, fixedAmounts: {}, adminPassword: PASSWORD } }); assert.equal(result.status, 400);
});

test("used promo offers are immutable and archive/deactivate behavior remains intact", async () => {
  let result = await request("/promo-codes/admin", { method: "POST", body: { code: "USED-FIXED", discountType: "fixed", discountValue: 200, fixedAmounts: { THB: 200, MMK: 7000 }, adminPassword: PASSWORD } }); const promo = result.body;
  const course = await Course.create({ title: "Promo history", price: 100, createdBy: admin._id });
  await Payment.create({ userId: student._id, courseId: course._id, amount: 100, promoCode: promo.code });
  result = await request(`/promo-codes/admin/${promo._id}`, { method: "PUT", body: { code: promo.code, discountType: "fixed", discountValue: 200, fixedAmounts: { THB: 201, MMK: 7000 }, isActive: true, adminPassword: PASSWORD } }); assert.equal(result.status, 400);
  result = await request(`/promo-codes/admin/${promo._id}`, { method: "PUT", body: { code: promo.code, discountType: "fixed", discountValue: 200, fixedAmounts: { THB: 200, MMK: 7000 }, isActive: false, adminPassword: PASSWORD } }); assert.equal(result.status, 200); assert.equal(result.body.isActive, false);
  result = await request(`/promo-codes/admin/${promo._id}`, { method: "DELETE", body: { adminPassword: PASSWORD } }); assert.equal(result.status, 200); assert.equal(result.body.archived, true); assert.equal((await PromoCode.findById(promo._id)).isActive, false);
});
