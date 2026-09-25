const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const PaymentMethod = require("../models/paymentMethodModel");
const Course = require("../models/courseModel");
const Payment = require("../models/paymentModel");
const PromoCode = require("../models/promoCodeModel");
const { LEGACY_METHOD_MARKER, assertLocalMigrationEnvironment, assertLocalMigrationTarget, planMigration } = require("../scripts/migrateMultiCurrencyPaymentLocal");

const command = promisify(execFile);
const objectId = () => new mongoose.Types.ObjectId();
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); });
});
const stop = (child) => new Promise((resolve) => {
  if (!child || child.exitCode !== null) return resolve();
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  child.once("exit", () => { clearTimeout(timer); resolve(); });
  child.kill("SIGTERM");
});

test("Course accepts independent THB/MMK prices and rejects an inverted currency price", async () => {
  const course = new Course({ title: "Currency course", price: 100, createdBy: objectId(), prices: { THB: { price: 100, originalPrice: 125 }, MMK: { price: 70000, originalPrice: 80000 } } });
  await assert.doesNotReject(course.validate());
  const invalid = new Course({ title: "Invalid currency course", price: 100, createdBy: objectId(), prices: { THB: { price: 101, originalPrice: 100 } } });
  await assert.rejects(invalid.validate(), /originalPrice/);
});

test("PaymentMethod validates payment type/provider and required audit identities", async () => {
  const valid = new PaymentMethod({ name: "Thai QR", currency: "THB", type: "qr", provider: "manual", createdBy: objectId(), updatedBy: objectId() });
  await assert.doesNotReject(valid.validate());
  const invalid = new PaymentMethod({ name: "Unsupported", currency: "THB", type: "card", provider: "stripe", createdBy: objectId(), updatedBy: objectId() });
  await assert.rejects(invalid.validate());
});

test("Payment validates immutable method snapshots and allows only the minimal legacy marker", async () => {
  const methodId = objectId();
  const common = { userId: objectId(), courseId: objectId(), amount: 100 };
  const methodPayment = new Payment({ ...common, currency: "MMK", paymentMethodId: methodId, paymentMethodSnapshot: { schemaVersion: 1, kind: "method", methodId, methodVersion: 2, name: "MMK Wallet", currency: "MMK", type: "wallet", provider: "manual", instructions: "Transfer here", recipient: { phoneNumber: "09" }, qrImage: { url: "https://example.test/qr" } } });
  await assert.doesNotReject(methodPayment.validate());
  const legacy = new Payment({ ...common, currency: "THB", paymentMethodId: null, paymentMethodSnapshot: LEGACY_METHOD_MARKER });
  await assert.doesNotReject(legacy.validate());
  const inventedLegacy = new Payment({ ...common, currency: "THB", paymentMethodSnapshot: { ...LEGACY_METHOD_MARKER, name: "Invented historical bank" } });
  await assert.rejects(inventedLegacy.validate(), /must not invent/);
  const mismatched = new Payment({ ...common, currency: "THB", paymentMethodId: methodId, paymentMethodSnapshot: { schemaVersion: 1, kind: "method", methodId: objectId(), methodVersion: 0, name: "THB QR", currency: "THB", type: "qr", provider: "manual" } });
  await assert.rejects(mismatched.validate(), /must match paymentMethodId/);
});

test("PromoCode accepts explicit fixed amounts while retaining discountValue", async () => {
  const promo = new PromoCode({ code: "FIXED-CURRENCIES", discountType: "fixed", discountValue: 100, fixedAmounts: { THB: 100, MMK: 7000 } });
  await assert.doesNotReject(promo.validate());
  const invalid = new PromoCode({ code: "BAD-FIXED", discountType: "fixed", discountValue: 100, fixedAmounts: { MMK: -1 } });
  await assert.rejects(invalid.validate());
});

test("local migration plan preserves financial fields, creates no methods/MMK prices, and is idempotent", () => {
  const courseId = objectId(); const paymentId = objectId(); const promoId = objectId();
  const source = {
    courses: [{ _id: courseId, price: 3000, originalPrice: null }],
    payments: [{ _id: paymentId, amount: null, originalAmount: null, discountAmount: null }],
    promos: [{ _id: promoId, discountType: "fixed", discountValue: 500 }],
  };
  const beforeFinancials = { ...source.payments[0] };
  const first = planMigration(source);
  assert.equal(first.conflicts.length, 0);
  assert.deepEqual(first.changes.courses[0].set, { "prices.THB": { price: 3000, originalPrice: 3000 } });
  assert.equal(first.changes.payments[0].set.currency, "THB");
  assert.deepEqual(first.changes.payments[0].set.paymentMethodSnapshot, LEGACY_METHOD_MARKER);
  assert.equal(first.changes.promos[0].set["fixedAmounts.THB"], 500);
  assert.deepEqual(source.payments[0], beforeFinancials);
  const migrated = {
    courses: [{ ...source.courses[0], prices: { THB: { price: 3000, originalPrice: 3000 } } }],
    payments: [{ ...source.payments[0], currency: "THB", paymentMethodId: null, paymentMethodSnapshot: LEGACY_METHOD_MARKER }],
    promos: [{ ...source.promos[0], fixedAmounts: { THB: 500 } }],
  };
  const second = planMigration(migrated);
  assert.equal(second.conflicts.length, 0);
  assert.deepEqual(second.changes, { courses: [], payments: [], promos: [] });
  assert.equal(migrated.courses[0].prices.MMK, undefined);
  assert.equal(migrated.payments[0].paymentMethodId, null);
});

test("local migration guard requires english_kafe and rejects production before connection", () => {
  assert.throws(() => assertLocalMigrationEnvironment({ NODE_ENV: "test" }), /PAYMENT_INTEGRITY_EXPECTED_DB=english_kafe/);
  assert.throws(() => assertLocalMigrationEnvironment({ NODE_ENV: "test", PAYMENT_INTEGRITY_EXPECTED_DB: "other" }), /PAYMENT_INTEGRITY_EXPECTED_DB=english_kafe/);
  assert.throws(() => assertLocalMigrationEnvironment({ NODE_ENV: "production", PAYMENT_INTEGRITY_EXPECTED_DB: "arunthai" }), /may not run in production/);
  assert.equal(assertLocalMigrationTarget({ databaseName: "english_kafe" }, { NODE_ENV: "test", PAYMENT_INTEGRITY_EXPECTED_DB: "english_kafe" }), undefined);
  assert.throws(() => assertLocalMigrationTarget({ databaseName: "other" }, { NODE_ENV: "test", PAYMENT_INTEGRITY_EXPECTED_DB: "english_kafe" }), /expected english_kafe/);
});

let mongo; let mongoDirectory; let mongoUri;
before(async () => {
  const port = await freePort();
  mongoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "multi-currency-migration-test-"));
  mongo = spawn("mongod", ["--port", String(port), "--dbpath", mongoDirectory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000);
    mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    mongo.once("error", reject);
  });
  mongoUri = `mongodb://127.0.0.1:${port}/english_kafe`;
});
after(async () => { await stop(mongo); if (mongoDirectory) await fs.rm(mongoDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });

test("migration dry-run does not mutate the explicit local english_kafe target", async () => {
  const client = new mongoose.mongo.MongoClient(mongoUri);
  await client.connect();
  try {
    const db = client.db();
    const courseId = objectId(); const paymentId = objectId(); const promoId = objectId();
    await db.collection("courses").insertOne({ _id: courseId, price: 3000 });
    await db.collection("payments").insertOne({ _id: paymentId, amount: null, originalAmount: null, discountAmount: null });
    await db.collection("promocodes").insertOne({ _id: promoId, code: "DRY-RUN", discountType: "fixed", discountValue: 100 });
    const script = path.resolve(__dirname, "../scripts/migrateMultiCurrencyPaymentLocal.js");
    const result = await command(process.execPath, [script], { env: { ...process.env, NODE_ENV: "test", MONGO_DB: mongoUri, PAYMENT_INTEGRITY_EXPECTED_DB: "english_kafe" } });
    const report = JSON.parse(result.stdout);
    assert.equal(report.mode, "dry-run");
    assert.equal(report.writesPerformed, false);
    assert.equal(report.summary.paymentMethodsToCreate, 0);
    assert.equal(report.summary.mmkPricesToCreate, 0);
    assert.equal((await db.collection("courses").findOne({ _id: courseId })).prices, undefined);
    const payment = await db.collection("payments").findOne({ _id: paymentId });
    assert.equal(payment.currency, undefined);
    assert.equal(payment.paymentMethodSnapshot, undefined);
    assert.equal(payment.amount, null);
    assert.equal((await db.collection("promocodes").findOne({ _id: promoId })).fixedAmounts, undefined);
    assert.equal(await db.collection("paymentmethods").countDocuments(), 0);
  } finally { await client.close(); }
});
