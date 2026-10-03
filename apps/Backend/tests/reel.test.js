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

process.env.JWT_SECRET = "reel-test-secret";
const Reel = require("../models/reelModel");
const User = require("../models/userModel");
const nativeFetch = global.fetch;

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
const token = (user) => jwt.sign({ id: String(user._id), sessionVersion: Number(user.sessionVersion || 0) }, process.env.JWT_SECRET);
const request = async (route, { method = "GET", body, access } = {}) => {
  const response = await nativeFetch(`${base}${route}`, { method, headers: { ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
};
const payload = (extra = {}) => ({ url: "https://youtu.be/PXO2x2GDCFY", displayOrder: 0, isActive: true, ...extra });

before(async () => {
  const port = await freePort(); directory = await fs.mkdtemp(path.join(os.tmpdir(), "reel-tests-"));
  mongo = spawn("mongod", ["--replSet", "paymentTests", "--port", String(port), "--dbpath", directory, "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("mongod startup timed out")), 15000); mongo.stdout.on("data", (chunk) => { if (chunk.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } }); mongo.once("error", reject); });
  await initiateReplicaSet(port);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/reel_tests?replicaSet=paymentTests`);
  await Reel.init();
  const app = express(); app.use(express.json()); app.use("/reels", require("../routes/reel"));
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve)); base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  await Promise.all([Reel.deleteMany({}), User.deleteMany({})]);
  admin = await User.create({ name: "Admin", email: "reels-admin@example.test", password: await bcrypt.hash("password", 4), role: "admin", isActive: true, isVerified: true });
  student = await User.create({ name: "Student", email: "reels-student@example.test", password: "password", role: "user", isActive: true, isVerified: true });
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); await stop(mongo); if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });

test("admin authorization protects Reel management", async () => {
  assert.equal((await request("/reels/admin")).status, 401);
  assert.equal((await request("/reels/admin", { access: token(student) })).status, 403);
  assert.equal((await request("/reels/admin", { access: token(admin) })).status, 200);
});

test("admin creates, updates, activates, orders, and deletes Reels", async () => {
  let result = await request("/reels/admin", { method: "POST", access: token(admin), body: payload({ url: "https://www.youtube.com/shorts/PXO2x2GDCFY", displayOrder: 4 }) });
  assert.equal(result.status, 201); assert.equal(result.body.platform, "youtube"); assert.equal(result.body.url, "https://www.youtube.com/watch?v=PXO2x2GDCFY");
  const id = result.body._id;
  result = await request(`/reels/admin/${id}`, { method: "PUT", access: token(admin), body: { url: "https://www.tiktok.com/@arunthai/video/7123456789012345678", displayOrder: 2, isActive: false } });
  assert.equal(result.status, 200); assert.equal(result.body.platform, "tiktok"); assert.equal(result.body.isActive, false); assert.equal(result.body.displayOrder, 2);
  result = await request(`/reels/admin/${id}`, { method: "PUT", access: token(admin), body: { isActive: true } });
  assert.equal(result.status, 200); assert.equal(result.body.isActive, true);
  assert.equal((await request(`/reels/admin/${id}`, { method: "DELETE", access: token(admin) })).status, 200);
  assert.equal(await Reel.exists({ _id: id }), null);
});

test("duplicates conflict and the public endpoint returns active Reels in deterministic order only", async () => {
  const first = await request("/reels/admin", { method: "POST", access: token(admin), body: payload({ displayOrder: 2 }) });
  assert.equal(first.status, 201);
  const duplicate = await request("/reels/admin", { method: "POST", access: token(admin), body: payload({ url: "https://www.youtube.com/watch?v=PXO2x2GDCFY" }) });
  assert.equal(duplicate.status, 409);
  await Reel.create({ url: "https://www.facebook.com/reel/123456789012345/", platform: "facebook", isActive: true, displayOrder: 1 });
  await Reel.create({ url: "https://www.tiktok.com/@arunthai/video/7123456789012345678", platform: "tiktok", isActive: false, displayOrder: 0 });
  const publicReels = await request("/reels");
  assert.equal(publicReels.status, 200); assert.deepEqual(publicReels.body.reels.map((reel) => reel.platform), ["facebook", "youtube"]);
  assert.equal("isActive" in publicReels.body.reels[0], false);
});

test("a Facebook share URL stores its resolved canonical direct URL and conflicts with that direct Reel", async () => {
  const originalFetch = global.fetch;
  let resolutionRequest = 0;
  global.fetch = async () => resolutionRequest++ === 0
    ? ({ status: 302, headers: { get: (name) => name.toLowerCase() === "location" ? "https://www.facebook.com/reel/123456789012345/" : null } })
    : ({ status: 200, headers: { get: () => null } });
  try {
    const share = await request("/reels/admin", { method: "POST", access: token(admin), body: payload({ url: "https://www.facebook.com/share/v/19Z7yGiyve" }) });
    assert.equal(share.status, 201); assert.equal(share.body.platform, "facebook"); assert.equal(share.body.url, "https://www.facebook.com/reel/123456789012345/");
    const duplicate = await request("/reels/admin", { method: "POST", access: token(admin), body: payload({ url: "https://www.facebook.com/reel/123456789012345/" }) });
    assert.equal(duplicate.status, 409);
  } finally {
    global.fetch = originalFetch;
  }
});

test("invalid and unsupported Reel payloads are rejected", async () => {
  for (const invalid of [payload({ url: "http://youtu.be/PXO2x2GDCFY" }), payload({ url: "https://vm.tiktok.com/abc/" }), payload({ url: "<iframe>" }), payload({ displayOrder: -1 }), payload({ isActive: "true" })]) {
    const result = await request("/reels/admin", { method: "POST", access: token(admin), body: invalid });
    assert.equal(result.status, 400);
  }
});
