const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const mongoose = require("mongoose");
const { initiateReplicaSet } = require("./helpers/replicaSet");
const ContactLead = require("../models/contactLeadModel");
const ContactEnquiry = require("../models/contactEnquiryModel");
const { addCalendarYears, acquireLeadClaim, processContactLeadRetention, recoverStaleContactLeadClaims, submitEnquiry } = require("../services/contactLeadLifecycle");

let mongo; let directory;
const port = () => new Promise((resolve, reject) => { const server = net.createServer(); server.on("error", reject); server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close(() => resolve(value)); }); });
const unsubscribed = (date) => ({ status: "unsubscribed", withdrawnAt: date, withdrawalSource: "unsubscribe_link", lastOptedInAt: new Date("2020-01-01"), lastOptInSource: "contact_form" });
async function lead({ email, withdrawnAt = new Date("2024-01-01"), status = "unsubscribed", claim } = {}) { return ContactLead.create({ name: "Maya", email: email || `lead-${new mongoose.Types.ObjectId()}@example.test`, marketingConsent: status === "unsubscribed" ? unsubscribed(withdrawnAt) : { status, withdrawnAt }, ...(claim ? { operationClaim: claim } : {}) }); }

before(async () => { const mongoPort = await port(); directory = await fs.mkdtemp(path.join(os.tmpdir(), "contact-retention-")); mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(mongoPort), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] }); await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000); mongo.stdout.on("data", (data) => { if (data.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } }); mongo.once("error", reject); }); await initiateReplicaSet(mongoPort); await mongoose.connect(`mongodb://127.0.0.1:${mongoPort}/contact_retention?replicaSet=paymentTests`); await Promise.all([ContactLead.init(), ContactEnquiry.init()]); });
after(async () => { await mongoose.disconnect(); if (mongo?.exitCode === null) mongo.kill("SIGTERM"); if (directory) await fs.rm(directory, { recursive: true, force: true }); });

test("claim contention prevents cleanup deletion and creates no dangling enquiry", async () => {
  const item = await lead(); const owned = await acquireLeadClaim(item._id, "submission"); assert.ok(owned);
  assert.deepEqual(await processContactLeadRetention({ now: new Date("2028-01-02") }), []);
  await assert.rejects(() => submitEnquiry({ email: item.email, name: "Maya New", message: "hello", consent: unsubscribed(new Date("2024-01-01")) }), /busy/);
  assert.equal(await ContactEnquiry.countDocuments({ contactLead: item._id }), 0);
  assert.ok(await ContactLead.exists({ _id: item._id }));
});

test("successful submission commits both records and unchecked consent remains unsubscribed", async () => {
  const item = await lead(); const saved = await submitEnquiry({ email: item.email, name: "Restored", message: "new enquiry", consent: unsubscribed(item.marketingConsent.withdrawnAt) });
  assert.equal(String(saved._id), String(item._id));
  const stored = await ContactLead.findById(item._id); assert.equal(stored.name, "Restored"); assert.equal(stored.marketingConsent.status, "unsubscribed");
  assert.equal(await ContactEnquiry.countDocuments({ contactLead: item._id }), 1);
});

test("cleanup preserves enquiry-backed leads, minimizes enquiry-free leads, and is idempotent", async () => {
  const keep = await lead(); await ContactEnquiry.create({ contactLead: keep._id, message: "retained" });
  const minimize = await lead(); const now = new Date("2025-01-01");
  await processContactLeadRetention({ now }); await processContactLeadRetention({ now });
  assert.ok(await ContactLead.exists({ _id: keep._id }));
  const stored = await ContactLead.findById(minimize._id).lean();
  assert.deepEqual(Object.keys(stored.marketingConsent).sort(), ["status", "withdrawalSource", "withdrawnAt"]);
  assert.equal(stored.name, undefined); assert.equal(stored.email, minimize.email);
});

test("three calendar years deletes only currently unsubscribed suppression records", async () => {
  const old = await lead({ withdrawnAt: new Date("2021-02-28T00:00:00Z") });
  const subscribed = await lead({ status: "subscribed", withdrawnAt: new Date("2020-01-01") });
  await processContactLeadRetention({ now: new Date("2024-02-28T00:00:00Z") });
  assert.equal(await ContactLead.exists({ _id: old._id }), null);
  assert.ok(await ContactLead.exists({ _id: subscribed._id }));
  assert.equal(addCalendarYears(new Date("2021-02-28T00:00:00Z"), 3).toISOString(), "2024-02-28T00:00:00.000Z");
});

test("a cleanup claim blocks a concurrent submission and expired claims require offline recovery", async () => {
  const item = await lead(); const owned = await acquireLeadClaim(item._id, "cleanup"); assert.ok(owned);
  await assert.rejects(() => submitEnquiry({ email: item.email, name: "Maya", message: "blocked", consent: unsubscribed(item.marketingConsent.withdrawnAt) }), /busy/);
  await ContactLead.updateOne({ _id: item._id }, { $set: { "operationClaim.expiresAt": new Date("2020-01-01") } });
  await processContactLeadRetention({ now: new Date("2025-01-01") });
  assert.equal((await ContactLead.findById(item._id).select("+operationClaim")).operationClaim.token, owned.token);
  assert.equal(await recoverStaleContactLeadClaims({ now: new Date("2025-01-01") }), 1);
});
