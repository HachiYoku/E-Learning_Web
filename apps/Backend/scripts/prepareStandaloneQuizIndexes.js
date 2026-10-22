// Additive-only General Practice index preparation. Invoke explicitly; never
// import this script from application startup or connect through Mongoose models.
const { MongoClient } = require("mongoose").mongo;
const { INDEXES, sameDefinition } = require("./prepareQuizIndexes");
const { inspect: inspectStandaloneData } = require("./preflightStandaloneQuizIndexes");
const { REQUIRED_INDEXES } = require("../services/standaloneQuizRuntimeReadiness");

const MAX_REPORTED_RECORDS = 100;
const objectId = (value) => value?._bsontype === "ObjectId";

function parseArgs(args) {
  let apply = false;
  let expectedDatabase;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--apply" && !apply) apply = true;
    else if (args[index] === "--expected-db" && expectedDatabase === undefined) {
      expectedDatabase = args[++index];
    } else throw new Error("Use --expected-db NAME and optionally --apply.");
  }
  if (typeof expectedDatabase !== "string" || !/^[A-Za-z0-9_-]+$/.test(expectedDatabase)) {
    throw new Error("An explicit expected database name is required.");
  }
  return { apply, expectedDatabase };
}

function resolveTarget(env, expectedDatabase) {
  if (expectedDatabase === "arunthai" || env.NODE_ENV === "production") {
    throw new Error("Production targets are not supported by this tool.");
  }
  let uri;
  try { uri = new URL(env.MONGO_DB); } catch { throw new Error("A MongoDB URI with an explicit database path is required."); }
  if (!["mongodb:", "mongodb+srv:"].includes(uri.protocol)) throw new Error("A MongoDB URI is required.");
  let database;
  try { database = decodeURIComponent(uri.pathname.slice(1)); } catch { throw new Error("The MongoDB database path is invalid."); }
  if (database !== expectedDatabase) throw new Error("The MongoDB database path does not match --expected-db.");
  return database;
}

async function invalidIndexRecords(db) {
  const result = { count: 0, records: [], truncated: false };
  async function scan(collection, filter, validate) {
    for await (const record of db.collection(collection).find(filter)) {
      const reasons = validate(record);
      if (!reasons.length) continue;
      result.count += 1;
      if (result.records.length < MAX_REPORTED_RECORDS) {
        result.records.push({ collection, id: String(record._id), reasons });
      }
    }
  }
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  if (names.has("quizsessions")) {
    await scan("quizsessions", { contextType: "standalone", activeSlot: true }, (row) => [
      ...(!objectId(row.quiz) ? ["quiz_invalid"] : []),
      ...(!objectId(row.user) ? ["user_invalid"] : []),
      ...(!(row.expiresAt instanceof Date) || !Number.isFinite(row.expiresAt.getTime()) ? ["expiry_invalid"] : []),
    ]);
  }
  if (names.has("quizattempts")) {
    await scan("quizattempts", { attemptNumber: { $exists: true } }, (row) => [
      ...(!objectId(row.quiz) ? ["quiz_invalid"] : []),
      ...(!objectId(row.user) ? ["user_invalid"] : []),
      ...(!Number.isSafeInteger(row.attemptNumber) || row.attemptNumber < 1 ? ["attempt_number_invalid"] : []),
      ...(row.submissionSnapshot?.contextType === "standalone" && !objectId(row.session) ? ["session_invalid"] : []),
    ]);
  }
  if (names.has("quizratewindows")) {
    await scan("quizratewindows", {}, (row) => [
      ...(row.windowStart instanceof Date && Number.isFinite(row.windowStart.getTime())
        && row.windowStart.getTime() % 900000 !== 0 ? ["window_start_not_aligned"] : []),
      ...(row.windowStart instanceof Date && Number.isFinite(row.windowStart.getTime())
        && row.expiresAt instanceof Date && Number.isFinite(row.expiresAt.getTime())
        && row.expiresAt.getTime() !== row.windowStart.getTime() + 900000
        ? ["expiry_not_exact_window_end"] : []),
    ]);
  }
  result.truncated = result.count > result.records.length;
  return result;
}

async function duplicateAttemptNumbers(db) {
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  if (!names.has("quizattempts")) return 0;
  const [row] = await db.collection("quizattempts").aggregate([
    { $match: { attemptNumber: { $exists: true } } },
    { $group: { _id: { quiz: "$quiz", user: "$user", attemptNumber: "$attemptNumber" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "groups" },
  ]).toArray();
  return row?.groups || 0;
}

async function inspect(db, expectedDatabase) {
  if (!expectedDatabase || expectedDatabase === "arunthai" || db.databaseName !== expectedDatabase) {
    throw new Error("Connected database does not match the permitted expected database.");
  }
  const data = await inspectStandaloneData(db, expectedDatabase);
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  const existing = [];
  const missing = [];
  const conflicts = [];
  for (const [collection, requiredNames] of Object.entries(REQUIRED_INDEXES)) {
    const actual = names.has(collection) ? await db.collection(collection).listIndexes().toArray() : [];
    for (const name of requiredNames) {
      const expected = INDEXES[collection]?.find((spec) => spec.name === name);
      if (!expected) throw new Error(`Index manifest is missing ${collection}.${name}.`);
      if (actual.some((spec) => sameDefinition(spec, expected))) existing.push({ collection, name });
      else {
        const conflicting = actual.find((spec) => spec.name === name
          || JSON.stringify(spec.key) === JSON.stringify(expected.key));
        if (conflicting) conflicts.push({ collection, required: name, existing: conflicting.name });
        else missing.push({ collection, name });
      }
    }
  }
  const malformed = await invalidIndexRecords(db);
  const duplicateAttemptNumberGroups = await duplicateAttemptNumbers(db);
  const issues = { ...data.issues, malformedIndexRecords: malformed.count, duplicateAttemptNumberGroups };
  const issueCount = Object.entries(issues).reduce((count, [name, value]) =>
    name === "standaloneWithoutRuntimeFence" ? count : count + value, 0);
  const blocked = conflicts.length > 0 || data.conflicts.length > 0 || issueCount > 0
    || data.transactionPrerequisite !== "replica_set_or_router_with_sessions";
  return {
    mode: "preflight", database: expectedDatabase,
    status: blocked ? "BLOCKED_FOR_REVIEW" : missing.length ? "INDEXES_MISSING" : "INDEXES_READY",
    existing, missing, conflicts,
    blockedIndexes: blocked ? [
      ...missing.map(({ collection, name }) => ({ collection, name })),
      ...conflicts.map(({ collection, required }) => ({ collection, name: required })),
    ] : [],
    issues, malformedIndexRecords: malformed,
    legacyAndDataReview: data.invalidRecords, transactionPrerequisite: data.transactionPrerequisite,
    quizzesCollectionPresent: names.has("quizzes"),
    missingCollections: Object.keys(REQUIRED_INDEXES).filter((name) => !names.has(name)),
    note: "Inspection is read-only. A topology hint does not replace the runtime transaction-readiness check.",
  };
}

async function apply(db, expectedDatabase) {
  const initial = await inspect(db, expectedDatabase);
  const created = [];
  if (initial.status === "BLOCKED_FOR_REVIEW") return { ...initial, mode: "apply", created };
  try {
    for (const { collection, name } of initial.missing) {
      // Re-inspect before each write so a newly introduced conflict or invalid
      // record cannot be overlooked. createIndex itself enforces uniqueness.
      const current = await inspect(db, expectedDatabase);
      if (current.status === "BLOCKED_FOR_REVIEW") return { ...current, mode: "apply", created };
      if (!current.missing.some((entry) => entry.collection === collection && entry.name === name)) continue;
      const spec = INDEXES[collection].find((entry) => entry.name === name);
      await db.collection(collection).createIndex(spec.key, { ...spec.options, name });
      const actual = await db.collection(collection).listIndexes().toArray();
      if (!actual.some((entry) => sameDefinition(entry, spec))) {
        throw new Error("Created index definition could not be verified.");
      }
      created.push({ collection, name });
    }
    const final = await inspect(db, expectedDatabase);
    if (final.status !== "INDEXES_READY") {
      return { ...final, mode: "apply", status: "APPLY_INCOMPLETE",
        verificationStatus: final.status, created };
    }
    return { ...final, mode: "apply", created };
  } catch (error) {
    let afterFailure;
    try { afterFailure = await inspect(db, expectedDatabase); } catch { afterFailure = null; }
    return { mode: "apply", database: expectedDatabase, status: "APPLY_FAILED", created,
      failure: { name: error?.name || "Error", code: error?.code || null }, afterFailure };
  }
}

function resultExitCode(applying, result) {
  if (applying) return result.status === "INDEXES_READY" ? 0 : 2;
  return result.status === "BLOCKED_FOR_REVIEW" ? 2 : 0;
}

async function main(args = process.argv.slice(2), env = process.env) {
  const { apply: applying, expectedDatabase } = parseArgs(args);
  resolveTarget(env, expectedDatabase); // All target guards precede any connection.
  const client = new MongoClient(env.MONGO_DB, {
    retryWrites: false, readPreference: "primary", readConcern: { level: "majority" },
    writeConcern: { w: "majority" },
  });
  try {
    await client.connect();
    const db = client.db(expectedDatabase);
    const result = applying ? await apply(db, expectedDatabase) : await inspect(db, expectedDatabase);
    console.log(JSON.stringify(result, null, 2));
    const exitCode = resultExitCode(applying, result);
    if (exitCode) process.exitCode = exitCode;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    // Driver errors can contain connection details: never print their message.
    console.error(JSON.stringify({ status: "ERROR", name: error?.name || "Error", code: error?.code || null }));
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, resolveTarget, inspect, apply, resultExitCode, main };
