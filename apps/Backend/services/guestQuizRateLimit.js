const crypto = require("crypto");
const mongoose = require("mongoose");
const GuestQuizRateWindow = require("../models/guestQuizRateWindowModel");
const { WINDOW_MS, LIMIT } = require("./standaloneQuizRateLimit");

const MAX_RETRIES = 64;
const OPERATIONS = new Set(["start", "submit"]);

function keyHash(kind, value, env = process.env) {
  if (typeof env.JWT_SECRET !== "string" || env.JWT_SECRET.length < 16
    || typeof value !== "string" || !value || value.length > 256) throw new Error("Guest rate key unavailable");
  return crypto.createHmac("sha256", env.JWT_SECRET).update(`guest-quiz-rate:${kind}:${value}`).digest("hex");
}

async function assertGuestRateIndexes(db) {
  const names = await db.listCollections({ name: "guestquizratewindows" }, { nameOnly: true }).toArray();
  if (names.length !== 1) throw new Error("Guest rate store unavailable");
  const indexes = await db.collection("guestquizratewindows").listIndexes().toArray();
  const unique = indexes.find((index) => index.name === "one_guest_quiz_rate_window");
  const ttl = indexes.find((index) => index.name === "guest_quiz_rate_window_expiry");
  if (!unique?.unique || JSON.stringify(unique.key) !== JSON.stringify({ keyHash: 1, operation: 1, windowStart: 1 })
    || JSON.stringify(ttl?.key) !== JSON.stringify({ expiresAt: 1 }) || ttl.expireAfterSeconds !== 0) {
    throw new Error("Guest rate indexes unavailable");
  }
}

async function consumeKey(collection, key, windowEnd, retryAfter) {
  const read = { readPreference: "primary", readConcern: { level: "majority" } };
  const write = { writeConcern: { w: "majority" } };
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const current = await collection.findOne(key, read);
    if (!current) {
      try {
        await collection.insertOne({ ...key, count: 1, expiresAt: windowEnd }, write);
        return { allowed: true };
      } catch (error) {
        if ([11000, 112].includes(error.code)) continue;
        throw error;
      }
    }
    if (current.expiresAt?.getTime() !== windowEnd.getTime()
      || !Number.isSafeInteger(current.count) || current.count < 0 || current.count > LIMIT) {
      throw new Error("Guest rate window malformed");
    }
    if (current.count === LIMIT) return { allowed: false, retryAfter };
    try {
      const updated = await collection.findOneAndUpdate(
        { _id: current._id, ...key, count: current.count, expiresAt: windowEnd },
        { $inc: { count: 1 } },
        { ...write, returnDocument: "after", includeResultMetadata: false });
      if (updated) return { allowed: true };
    } catch (error) {
      if (error.code !== 112) throw error;
    }
  }
  throw new Error("Guest rate contention exceeded retry bound");
}

// Caller must fail closed on errors. No in-memory fallback is permitted.
async function consumeGuestQuizRateLimit({ ownerHash, ip, operation, connection = mongoose.connection, env = process.env }) {
  if (!/^[a-f0-9]{64}$/.test(ownerHash || "") || !OPERATIONS.has(operation)
    || typeof ip !== "string" || !ip || ip.length > 256) throw new Error("Invalid guest rate input");
  if (connection?.readyState !== 1 || !connection.db) throw new Error("Guest rate store unavailable");
  const db = connection.db;
  await assertGuestRateIndexes(db);
  const hello = await db.admin().command({ hello: 1 }, { readPreference: "primary" });
  if (!(hello.localTime instanceof Date)) throw new Error("Guest rate clock unavailable");
  const start = Math.floor(hello.localTime.getTime() / WINDOW_MS) * WINDOW_MS;
  const windowStart = new Date(start);
  const windowEnd = new Date(start + WINDOW_MS);
  const retryAfter = Math.max(1, Math.ceil((windowEnd - hello.localTime) / 1000));
  const collection = db.collection(GuestQuizRateWindow.collection.name);
  for (const [kind, value] of [["owner", ownerHash], ["ip", ip]]) {
    const result = await consumeKey(collection, { keyHash: keyHash(kind, value, env), operation, windowStart }, windowEnd, retryAfter);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}

module.exports = { consumeGuestQuizRateLimit, assertGuestRateIndexes, keyHash };
