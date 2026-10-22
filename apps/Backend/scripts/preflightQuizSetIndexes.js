// Read-only Quiz Set index and membership preflight. There is deliberately no apply mode.
const { MongoClient } = require("mongoose").mongo;
const QuizSet = require("../models/quizSetModel");
const Quiz = require("../models/quizModel");
const QuizCreationRequest = require("../models/quizCreationRequestModel");
const { sameDefinition, resolveDatabase } = require("./prepareQuizIndexes");

function namedIndex([key, options]) {
  return { key, options, name: options.name || Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_") };
}

const REQUIRED = Object.freeze({
  quizsets: QuizSet.schema.indexes().map(namedIndex),
  quizzes: Quiz.schema.indexes().filter(([key]) => Object.hasOwn(key, "quizSet")).map(namedIndex),
  quizcreationrequests: QuizCreationRequest.schema.indexes().map(namedIndex),
});

async function inspect(db) {
  const collections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  const missing = []; const conflicts = [];
  for (const [collection, required] of Object.entries(REQUIRED)) {
    if (!collections.has(collection)) {
      missing.push(...required.map((index) => ({ collection, index: index.name })));
      continue;
    }
    const actual = await db.collection(collection).listIndexes().toArray();
    for (const index of required) {
      if (actual.some((candidate) => sameDefinition(candidate, index))) continue;
      if (actual.some((candidate) => candidate.name === index.name || JSON.stringify(candidate.key) === JSON.stringify(index.key))) {
        conflicts.push({ collection, index: index.name });
      } else missing.push({ collection, index: index.name });
    }
  }
  const membership = { missing: 0, malformed: 0, orphaned: 0, nonStandalone: 0,
    invalidSortOrder: 0, mixedOwnership: 0, samples: [] };
  if (collections.has("quizzes")) {
    const setIds = new Set();
    if (collections.has("quizsets")) {
      for await (const set of db.collection("quizsets").find({}, { projection: { _id: 1 } })) setIds.add(String(set._id));
    }
    const quizzes = db.collection("quizzes").find({ $or: [{ contextType: "standalone" },
      { quizSet: { $exists: true, $ne: null } }] }, { projection: { _id: 1, contextType: 1,
        quizSet: 1, sortOrder: 1, course: 1, lesson: 1, homeworkSet: 1 } });
    for await (const quiz of quizzes) {
      let reason;
      if (quiz.contextType !== "standalone") reason = "nonStandalone";
      else if (quiz.quizSet === undefined || quiz.quizSet === null) reason = "missing";
      else if (quiz.quizSet?._bsontype !== "ObjectId") reason = "malformed";
      else if (!setIds.has(String(quiz.quizSet))) reason = "orphaned";
      else if (!Number.isSafeInteger(quiz.sortOrder) || quiz.sortOrder < 1) reason = "invalidSortOrder";
      else if (quiz.course != null || quiz.lesson != null || quiz.homeworkSet != null) reason = "mixedOwnership";
      if (reason) {
        membership[reason] += 1;
        if (membership.samples.length < 20) membership.samples.push({ quizId: String(quiz._id), reason });
      }
    }
  }
  const invalidMembership = membership.malformed + membership.orphaned + membership.nonStandalone
    + membership.invalidSortOrder + membership.mixedOwnership;
  // Unassigned legacy quizzes require an explicit owner decision; never infer a
  // Set or claim runtime readiness for them during this read-only preflight.
  const status = conflicts.length ? "CONFLICT" : invalidMembership ? "MEMBERSHIP_INTEGRITY_BLOCKED"
    : membership.missing ? "LEGACY_MEMBERSHIP_REVIEW_REQUIRED"
      : missing.length ? "INDEXES_MISSING" : "INDEXES_READY";
  return { status, database: db.databaseName, missing, conflicts, membership };
}

async function main(args = process.argv.slice(2), env = process.env) {
  if (args.length && !(args.length === 1 && args[0] === "--preflight")) throw new Error("Only read-only --preflight is supported.");
  const database = resolveDatabase(env, "preflight");
  const client = new MongoClient(env.MONGO_DB);
  try {
    await client.connect();
    const db = client.db(database);
    if (db.databaseName !== database) throw new Error("Connected database differs from the expected database.");
    return await inspect(db);
  } finally { await client.close(); }
}

if (require.main === module) {
  require("dotenv").config();
  main().then((result) => {
    console.log(JSON.stringify(result));
    if (result.status !== "INDEXES_READY") process.exitCode = 1;
  }).catch((error) => {
    console.error("Quiz Set preflight failed", { name: error.name, message: error.message });
    process.exitCode = 1;
  });
}

module.exports = { REQUIRED, inspect, main };
