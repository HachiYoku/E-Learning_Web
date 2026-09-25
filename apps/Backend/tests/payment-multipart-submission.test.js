const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const { initiateReplicaSet } = require("./helpers/replicaSet");

process.env.JWT_SECRET = "multipart-payment-submission-test-secret";
process.env.RESEND_API_KEY = "re_test_placeholder";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL_LOCAL = "http://localhost:5173";
process.env.ADMIN_URL_LOCAL = "http://localhost:5174";
process.env.BACKEND_URL = "http://localhost:3000";

// Keep the HTTP route, multer middleware, controller and transactions real.
require.cache[require.resolve("../services/sendEmail")] = {
  id: require.resolve("../services/sendEmail"), filename: require.resolve("../services/sendEmail"),
  loaded: true, exports: async () => {},
};
const storage = require("../services/paymentProofStorage");
const proofs = new Set();
let afterUpload;
storage.uploadPaymentProof = async (_buffer, publicId) => {
  proofs.add(publicId);
  if (afterUpload) await afterUpload();
  return { public_id: publicId, format: "png" };
};
storage.deletePaymentProof = async (publicId) => { proofs.delete(publicId); };

const User = require("../models/userModel");
const Course = require("../models/courseModel");
const PaymentMethod = require("../models/paymentMethodModel");
const Promo = require("../models/promoCodeModel");
const Payment = require("../models/paymentModel");
const Redemption = require("../models/promoRedemptionModel");
const Enrollment = require("../models/enrollmentModel");

const password = "MultipartPaymentPassword123";
let mongo, directory, server, base, admin, adminToken;
let serial = 0;
const authToken = (user) => jwt.sign({ id: String(user._id), sessionVersion: 0 }, process.env.JWT_SECRET);
const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
const freePort = () => new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const port = listener.address().port;
    listener.close(() => resolve(port));
  });
});

async function request(route, { method = "GET", body, access = adminToken } = {}) {
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

async function fixture({ promo, thb = 3000, mmk = 120000 } = {}) {
  const id = ++serial;
  const student = await User.create({ name: "Student", email: `multipart-${id}@example.test`, password: "unused", isActive: true, isVerified: true });
  const course = await Course.create({
    title: `Multipart course ${id}`, description: `Snapshot ${id}`, thumbnail: `https://example.test/${id}.png`,
    price: thb, originalPrice: thb, prices: {
      THB: { price: thb, originalPrice: thb }, MMK: { price: mmk, originalPrice: mmk },
    }, createdBy: admin._id,
  });
  const methods = {};
  for (const currency of ["THB", "MMK"]) {
    methods[currency] = await PaymentMethod.create({
      name: `${currency} method ${id}`, currency, type: "qr", provider: "manual", isActive: true,
      instructions: `Pay ${currency} for ${id}`,
      recipient: { accountName: `${currency} recipient ${id}`, accountNumber: `${id}123` },
      qrImage: { url: `https://example.test/${currency}-${id}.png`, publicId: `${currency}-${id}` },
      createdBy: admin._id, updatedBy: admin._id,
    });
  }
  const promotion = promo ? await Promo.create({ code: `MULTIPART-${id}`, ...promo }) : null;
  return { student, course, methods, promo: promotion };
}

async function quote(f, currency, promoCode = f.promo?.code) {
  return request(`/payments/course/${f.course._id}/quote`, {
    method: "POST", access: authToken(f.student),
    body: { paymentMethodId: String(f.methods[currency]._id), ...(promoCode ? { promoCode } : {}) },
  });
}

async function submit(f, currency, { promoCode = f.promo?.code, courseVersion = 0, methodVersion = 0, forged = {} } = {}) {
  const form = new FormData();
  form.append("paymentProof", new Blob([png], { type: "image/png" }), "proof.png");
  form.append("paymentMethodId", String(f.methods[currency]._id));
  form.append("courseMutationVersion", String(courseVersion));
  form.append("paymentMethodMutationVersion", String(methodVersion));
  if (promoCode) form.append("promoCode", promoCode);
  for (const [key, value] of Object.entries(forged)) form.append(key, String(value));
  return request(`/payments/course/${f.course._id}`, { method: "POST", access: authToken(f.student), body: form });
}

async function review(paymentId, action) {
  return request(`/payments/${paymentId}/${action}`, {
    method: "PATCH", body: { adminPassword: password, rejectReason: "Receipt could not be verified" },
  });
}

async function assertNoSubmissionArtifacts(f) {
  assert.equal(await Payment.countDocuments({ userId: f.student._id }), 0);
  assert.equal(await Redemption.countDocuments({ userId: f.student._id }), 0);
  assert.equal(await Enrollment.countDocuments({ userId: f.student._id }), 0);
  assert.equal(proofs.size, 0);
}

before(async () => {
  const port = await freePort();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "payment-multipart-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    mongo.once("error", reject);
  });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/payment_multipart?replicaSet=paymentTests`);
  const app = express();
  app.use(express.json());
  app.use("/payments", require("../routes/payment"));
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  admin = await User.create({ name: "Admin", email: "multipart-admin@example.test", password: await bcrypt.hash(password, 4), role: "admin", isActive: true, isVerified: true });
  adminToken = authToken(admin);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo?.exitCode === null) await new Promise((resolve) => {
    const timer = setTimeout(() => mongo.kill("SIGKILL"), 5000);
    mongo.once("exit", () => { clearTimeout(timer); resolve(); });
    mongo.kill("SIGTERM");
  });
  if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

for (const currency of ["THB", "MMK"]) {
  test(`${currency} multipart submission applies a percent promo from server-side prices`, async () => {
    proofs.clear();
    const f = await fixture({ promo: { discountType: "percent", discountValue: 12.5, usageLimit: 5 } });
    const result = await submit(f, currency, { forged: { amount: 1, currency: "USD", discountAmount: 999999 } });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const expectedOriginal = currency === "THB" ? 3000 : 120000;
    assert.equal(result.body.currency, currency);
    assert.equal(result.body.originalAmount, expectedOriginal);
    assert.equal(result.body.discountAmount, expectedOriginal * 0.125);
    assert.equal(result.body.amount, expectedOriginal * 0.875);
  });
}

for (const currency of ["THB", "MMK"]) {
  test(`${currency} multipart submission applies its fixed promo amount`, async () => {
    proofs.clear();
    const f = await fixture({ promo: { discountType: "fixed", discountValue: 1, fixedAmounts: { THB: 450, MMK: 18000 }, usageLimit: 5 } });
    const result = await submit(f, currency);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.discountAmount, currency === "THB" ? 450 : 18000);
    assert.equal(result.body.amount, currency === "THB" ? 2550 : 102000);
  });
}

test("multipart submission rejects a fixed promo unavailable in the selected currency", async () => {
  proofs.clear();
  const f = await fixture({ promo: { discountType: "fixed", discountValue: 500, fixedAmounts: { THB: 500 }, usageLimit: 5 } });
  const result = await submit(f, "MMK");
  assert.equal(result.status, 400);
  assert.match(result.body.message, /not available for the selected payment currency/i);
  await assertNoSubmissionArtifacts(f);
});

test("multipart submission persists authoritative course, method and currency snapshots", async () => {
  proofs.clear();
  const f = await fixture();
  const result = await submit(f, "MMK", { forged: { amount: 7, currency: "THB", discountAmount: 6 } });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const payment = await Payment.findById(result.body._id);
  assert.deepEqual(payment.courseSnapshot.toObject(), {
    title: f.course.title, description: f.course.description, thumbnail: f.course.thumbnail,
    price: 120000, originalPrice: 120000, currency: "MMK",
  });
  assert.equal(String(payment.paymentMethodId), String(f.methods.MMK._id));
  assert.equal(payment.paymentMethodSnapshot.name, f.methods.MMK.name);
  assert.equal(payment.paymentMethodSnapshot.currency, "MMK");
  assert.equal(payment.paymentMethodSnapshot.instructions, f.methods.MMK.instructions);
  assert.equal(payment.paymentMethodSnapshot.recipient.accountNumber, f.methods.MMK.recipient.accountNumber);
  assert.equal(payment.currency, "MMK");
  assert.equal(payment.amount, 120000);
});

test("stale course or payment-method quote versions are rejected with 409", async () => {
  proofs.clear();
  const staleCourse = await fixture();
  const courseQuote = await quote(staleCourse, "THB");
  assert.equal(courseQuote.status, 200);
  await Course.updateOne({ _id: staleCourse.course._id }, { $set: { mutationVersion: 1, "prices.THB.price": 3100, "prices.THB.originalPrice": 3100 } });
  assert.equal((await submit(staleCourse, "THB", { courseVersion: courseQuote.body.coursePrice.mutationVersion, methodVersion: courseQuote.body.paymentMethod.mutationVersion })).status, 409);
  await assertNoSubmissionArtifacts(staleCourse);

  const staleMethod = await fixture();
  const methodQuote = await quote(staleMethod, "THB");
  assert.equal(methodQuote.status, 200);
  await PaymentMethod.updateOne({ _id: staleMethod.methods.THB._id }, { $set: { mutationVersion: 1, instructions: "Changed instructions" } });
  assert.equal((await submit(staleMethod, "THB", { courseVersion: methodQuote.body.coursePrice.mutationVersion, methodVersion: methodQuote.body.paymentMethod.mutationVersion })).status, 409);
  await assertNoSubmissionArtifacts(staleMethod);
});

test("a method deactivated after quote and a promo exhausted after quote cannot be submitted", async () => {
  proofs.clear();
  const methodFixture = await fixture();
  assert.equal((await quote(methodFixture, "THB")).status, 200);
  await PaymentMethod.updateOne({ _id: methodFixture.methods.THB._id }, { $set: { isActive: false } });
  assert.equal((await submit(methodFixture, "THB")).status, 400);
  await assertNoSubmissionArtifacts(methodFixture);

  const promoFixture = await fixture({ promo: { discountType: "percent", discountValue: 10, usageLimit: 1 } });
  assert.equal((await quote(promoFixture, "MMK")).status, 200);
  await Promo.updateOne({ _id: promoFixture.promo._id }, { $set: { usageCount: 1 } });
  assert.equal((await submit(promoFixture, "MMK")).status, 400);
  await assertNoSubmissionArtifacts(promoFixture);
});

test("failure after proof upload cleans proof and rolls back payment, promo reservation and enrollment", async () => {
  proofs.clear();
  const f = await fixture({ promo: { discountType: "percent", discountValue: 10, usageLimit: 1 } });
  afterUpload = () => Promo.updateOne({ _id: f.promo._id }, { $set: { isActive: false } });
  const result = await submit(f, "THB");
  afterUpload = undefined;
  assert.equal(result.status, 400);
  await assertNoSubmissionArtifacts(f);
  assert.equal((await Promo.findById(f.promo._id)).usageCount, 0);
});

test("rejecting releases a promo; resubmission and approval create exactly one enrollment", async () => {
  proofs.clear();
  const f = await fixture({ promo: { discountType: "fixed", discountValue: 1, fixedAmounts: { THB: 500, MMK: 20000 }, usageLimit: 1 } });
  const first = await submit(f, "THB");
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal((await review(first.body._id, "reject")).status, 200);
  const released = await Redemption.findById(first.body.promoRedemptionId);
  assert.equal(released.active, false);
  assert.equal((await Promo.findById(f.promo._id)).usageCount, 0);
  const second = await submit(f, "THB");
  assert.equal(second.status, 201, JSON.stringify(second.body));
  assert.equal((await review(second.body._id, "approve")).status, 200);
  assert.equal(await Enrollment.countDocuments({ userId: f.student._id, courseId: f.course._id }), 1);
  assert.equal((await Payment.findById(second.body._id)).status, "approved");
});
