const mongoose = require("mongoose");
const QuizRateWindow = require("../models/quizRateWindowModel");
const { INDEXES, sameDefinition } = require("../scripts/prepareQuizIndexes");

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 20;
const MAX_RETRIES = 64;
const OPERATIONS = new Set(["start", "submit"]);

function validWindow(record, userId, operation, windowStart, windowEnd) {
  return record && String(record.user) === String(userId)
    && record.operation === operation
    && record.windowStart instanceof Date && record.windowStart.getTime() === windowStart.getTime()
    && record.expiresAt instanceof Date && record.expiresAt.getTime() === windowEnd.getTime()
    && Number.isSafeInteger(record.count) && record.count >= 0 && record.count <= LIMIT;
}

async function assertRateIndexes(db) {
  const names = await db.listCollections({ name: QuizRateWindow.collection.name }, { nameOnly: true }).toArray();
  if (!names.some(({ name }) => name === QuizRateWindow.collection.name)) throw new Error("Rate collection is unavailable");
  const actual = await db.collection(QuizRateWindow.collection.name).listIndexes().toArray();
  const required = INDEXES.quizratewindows;
  if (!required.every((expected) => actual.some((candidate) => sameDefinition(candidate, expected)))) {
    throw new Error("Rate indexes are unavailable");
  }
}

async function databaseWindow(db) {
  // The primary's clock, not any Backend instance's clock, selects the UTC key.
  // Sampling happens before the atomic write; a request crossing the boundary
  // during that round trip remains assigned to its sampled window.
  const hello = await db.admin().command({ hello: 1 }, { readPreference: "primary" });
  const now = hello.localTime;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("Database time is unavailable");
  const start = Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS;
  return { windowStart: new Date(start), windowEnd: new Date(start + WINDOW_MS),
    retryAfter: Math.max(1, Math.ceil((start + WINDOW_MS - now.getTime()) / 1000)) };
}

async function consumeStandaloneQuizRateLimit({ userId, operation, connection = mongoose.connection }) {
  if (!mongoose.isValidObjectId(userId) || !OPERATIONS.has(operation)) throw new Error("Invalid rate-limit input");
  if (connection?.readyState !== 1 || !connection.db) throw new Error("Database is unavailable");
  const db = connection.db;
  await assertRateIndexes(db);
  const { windowStart, windowEnd, retryAfter } = await databaseWindow(db);
  const collection = db.collection(QuizRateWindow.collection.name);
  const key = { user: new mongoose.Types.ObjectId(String(userId)), operation, windowStart };
  const readOptions = { readPreference: "primary", readConcern: { level: "majority" } };
  const writeOptions = { writeConcern: { w: "majority" } };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const current = await collection.findOne(key, readOptions);
    if (!current) {
      try {
        await collection.insertOne({ ...key, count: 1, expiresAt: windowEnd }, writeOptions);
        return { allowed: true };
      } catch (error) {
        // Only a unique-key collision is known not to have inserted this request.
        if (error.code === 11000) continue;
        if (error.code === 112) continue;
        throw error;
      }
    }
    if (!validWindow(current, key.user, operation, windowStart, windowEnd)) {
      throw new Error("Rate window is malformed");
    }
    if (current.count === LIMIT) return { allowed: false, retryAfter };
    try {
      const updated = await collection.findOneAndUpdate(
        { _id: current._id, ...key, count: current.count, expiresAt: windowEnd },
        { $inc: { count: 1 } },
        { ...writeOptions, returnDocument: "after", includeResultMetadata: false }
      );
      if (updated) return { allowed: true };
    } catch (error) {
      // WriteConflict is a definite transaction/write conflict; uncertain
      // network outcomes fail closed rather than risking a second increment.
      if (error.code !== 112) throw error;
    }
  }
  throw new Error("Rate window contention exceeded the retry bound");
}

module.exports = { WINDOW_MS, LIMIT, consumeStandaloneQuizRateLimit };
