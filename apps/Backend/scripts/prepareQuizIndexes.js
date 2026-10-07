// Quiz-only index preparation. No application models are imported: preflight
// must never trigger Mongoose autoCreate/autoIndex as a side effect.
const { MongoClient } = require("mongoose").mongo;

const index = (key, options = {}) => ({
  key,
  options,
  name: options.name || Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_"),
});

// Mirror the ten current Quiz-related Mongoose schemas. The isolated test suite
// compares this manifest with schema.indexes() so a schema change cannot drift.
const INDEXES = Object.freeze({
  quizzes: [
    index({ course: 1 }), index({ lesson: 1 }), index({ homeworkSet: 1 }),
    index({ contextType: 1 }), index({ status: 1 }), index({ quizType: 1 }),
    index({ lesson: 1, contextType: 1 }, { unique: true, partialFilterExpression: { contextType: "course_lesson", lesson: { $type: "objectId" } } }),
    index({ course: 1, contextType: 1 }, { unique: true, partialFilterExpression: { contextType: "course_final", course: { $type: "objectId" } } }),
    index({ homeworkSet: 1, contextType: 1 }, { unique: true, partialFilterExpression: { contextType: "homework_final", homeworkSet: { $type: "objectId" } } }),
    index({ homeworkSet: 1, sortOrder: 1 }, { unique: true, partialFilterExpression: { contextType: "homework_lesson", sortOrder: { $type: "number" } } }),
  ],
  quizattempts: [
    index({ quiz: 1 }), index({ user: 1 }), index({ quiz: 1, user: 1, createdAt: -1 }),
    index({ quiz: 1, user: 1, attemptNumber: 1 }, { unique: true, partialFilterExpression: { attemptNumber: { $exists: true } } }),
  ],
  homeworksets: [
    index({ status: 1 }), index({ createdBy: 1 }), index({ status: 1, updatedAt: -1 }),
  ],
  homeworksetassignments: [
    index({ homeworkSet: 1 }), index({ user: 1 }), index({ state: 1 }),
    index({ homeworkSet: 1, user: 1 }, { unique: true }),
    index({ user: 1, state: 1, homeworkSet: 1 }),
  ],
  quizunlocks: [
    index({ user: 1 }), index({ quiz: 1 }), index({ user: 1, quiz: 1 }, { unique: true }),
  ],
  quizgoalachievements: [
    index({ user: 1 }), index({ quiz: 1 }), index({ user: 1, quiz: 1 }, { unique: true }),
  ],
  quizattemptgrants: [
    index({ user: 1 }), index({ quiz: 1 }), index({ quiz: 1, user: 1, grantedAt: -1 }),
  ],
  quizattemptrequests: [
    index({ user: 1 }), index({ quiz: 1 }), index({ course: 1 }), index({ status: 1 }),
    index({ user: 1, quiz: 1 }, { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_course_final_request" }),
    index({ quiz: 1, user: 1, createdAt: -1 }),
  ],
  quizsessions: [
    index({ user: 1 }), index({ quiz: 1 }),
    index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    index({ quiz: 1, expiresAt: 1, invalidatedAt: 1 }),
  ],
  quizmedias: [
    index({ quiz: 1 }), index({ questionId: 1 }), index({ publicId: 1 }, { unique: true }),
    index({ cleanupState: 1 }), index({ quiz: 1, questionId: 1, mediaType: 1 }),
  ],
});

const LEGACY_QUIZ_INDEXES = Object.freeze([
  index({ lesson: 1, title: 1 }, { unique: true, partialFilterExpression: { quizType: "lesson" } }),
  index({ course: 1, title: 1 }, { unique: true, partialFilterExpression: { quizType: "course" } }),
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

const same = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));
const sameKey = (left, right) => JSON.stringify(Object.entries(left)) === JSON.stringify(Object.entries(right));

function meaningfulOptions(spec) {
  const { key, name, v, ns, background, ...options } = spec;
  return {
    unique: Boolean(options.unique),
    sparse: Boolean(options.sparse),
    hidden: Boolean(options.hidden),
    partialFilterExpression: options.partialFilterExpression ?? null,
    expireAfterSeconds: options.expireAfterSeconds ?? null,
    collation: options.collation ?? null,
    other: Object.fromEntries(Object.entries(options).filter(([field]) => ![
      "unique", "sparse", "hidden", "partialFilterExpression", "expireAfterSeconds", "collation",
    ].includes(field))),
  };
}

function sameDefinition(actual, expected) {
  return sameKey(actual.key, expected.key)
    && same(meaningfulOptions(actual), meaningfulOptions(expected.options))
    && (!expected.options.name || actual.name === expected.options.name);
}

function summary(spec) {
  return { name: spec.name, key: spec.key, ...meaningfulOptions(spec) };
}

function resolveDatabase(env, mode) {
  if (!env.MONGO_DB || !env.QUIZ_INDEX_EXPECTED_DB) {
    throw new Error("MONGO_DB and QUIZ_INDEX_EXPECTED_DB are required.");
  }
  let url;
  try { url = new URL(env.MONGO_DB); } catch { throw new Error("MONGO_DB must be a MongoDB URI with an explicit database path."); }
  if (!["mongodb:", "mongodb+srv:"].includes(url.protocol)) throw new Error("MONGO_DB must be a MongoDB URI.");
  let databaseName;
  try { databaseName = decodeURIComponent(url.pathname.slice(1)); } catch { throw new Error("MONGO_DB has an invalid database path."); }
  if (!databaseName || databaseName.includes("/") || databaseName !== env.QUIZ_INDEX_EXPECTED_DB) {
    throw new Error("MongoDB database name is missing or differs from QUIZ_INDEX_EXPECTED_DB.");
  }
  if (env.NODE_ENV === "production" && databaseName !== "arunthai") {
    throw new Error("Production Quiz index preparation may target only arunthai.");
  }
  if (mode === "apply" && databaseName === "arunthai" && env.NODE_ENV !== "production") {
    throw new Error("Applying to arunthai requires NODE_ENV=production.");
  }
  return databaseName;
}

function parseMode(args) {
  if (!args.length || (args.length === 1 && args[0] === "--preflight")) return "preflight";
  if (args.length === 1 && args[0] === "--apply") return "apply";
  throw new Error("Use no arguments for read-only preflight, or pass only --apply.");
}

async function inspect(db, expectedDatabaseName) {
  if (!expectedDatabaseName || db.databaseName !== expectedDatabaseName) {
    throw new Error("Connected database does not match the explicitly expected database.");
  }
  const present = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  const collections = {};
  const missingCollections = [];
  const missingIndexes = [];
  const confirmedLegacy = [];
  const conflicts = [];
  const unexpectedIndexes = [];
  const nonemptyCollections = [];

  for (const [name, expectedIndexes] of Object.entries(INDEXES)) {
    const exists = present.has(name);
    const count = exists ? await db.collection(name).countDocuments({}) : 0;
    const actual = exists ? await db.collection(name).listIndexes().toArray() : [];
    if (!exists) missingCollections.push(name);
    if (count !== 0) nonemptyCollections.push({ collection: name, count });
    const matched = new Set();
    const correct = [];
    for (const expected of expectedIndexes) {
      const found = actual.find((candidate) => sameDefinition(candidate, expected));
      if (found) {
        matched.add(found.name);
        correct.push(expected.name);
      } else {
        const mismatch = actual.find((candidate) => sameKey(candidate.key, expected.key) || candidate.name === expected.name);
        if (mismatch) {
          matched.add(mismatch.name);
          conflicts.push({ collection: name, required: summary({ ...expected.options, key: expected.key, name: expected.name }), actual: summary(mismatch) });
        } else {
          missingIndexes.push({ collection: name, index: expected });
        }
      }
    }
    for (const candidate of actual) {
      if (candidate.name === "_id_") continue;
      if (name === "quizzes" && LEGACY_QUIZ_INDEXES.some((legacy) => legacy.name === candidate.name)) {
        const legacy = LEGACY_QUIZ_INDEXES.find((item) => item.name === candidate.name);
        if (sameDefinition(candidate, legacy)) confirmedLegacy.push({ collection: name, name: candidate.name });
        else conflicts.push({ collection: name, legacyName: candidate.name, actual: summary(candidate) });
        continue;
      }
      if (!matched.has(candidate.name)) unexpectedIndexes.push({ collection: name, index: summary(candidate) });
    }
    collections[name] = { exists, count, indexes: actual.map(summary), correctRequiredIndexes: correct };
  }

  const readyForApply = !nonemptyCollections.length && !conflicts.length && !unexpectedIndexes.length;
  return {
    mode: "preflight", database: db.databaseName,
    status: readyForApply ? "READY FOR APPLY" : "NOT READY FOR APPLY",
    collections, missingCollections,
    missingIndexes: missingIndexes.map(({ collection, index: spec }) => ({ collection, index: summary({ ...spec.options, key: spec.key, name: spec.name }) })),
    confirmedLegacy, conflicts, unexpectedIndexes, nonemptyCollections,
    plannedOperations: [
      ...missingCollections.map((collection) => ({ action: "createCollection", collection })),
      ...missingIndexes.map(({ collection, index: spec }) => ({ action: "createIndex", collection, index: spec.name })),
      { action: "verifyRequiredIndexes" },
      ...confirmedLegacy.map(({ collection, name }) => ({ action: "dropConfirmedLegacyIndex", collection, index: name })),
      { action: "verifyFinalIndexes" },
    ],
    readyForApply,
  };
}

async function apply(db, expectedDatabaseName) {
  const operations = [];
  const initial = await inspect(db, expectedDatabaseName);
  if (!initial.readyForApply) return { ...initial, mode: "apply", operations };
  try {
    for (const name of initial.missingCollections) {
      await db.createCollection(name);
      operations.push({ action: "createCollection", collection: name });
    }
    for (const [name, expectedIndexes] of Object.entries(INDEXES)) {
      for (const spec of expectedIndexes) {
        if (!initial.missingIndexes.some(({ collection, index: item }) => collection === name && item.name === spec.name)) continue;
        await db.collection(name).createIndex(spec.key, { ...spec.options, name: spec.name });
        operations.push({ action: "createIndex", collection: name, index: spec.name });
      }
    }
    const beforeDrop = await inspect(db, expectedDatabaseName);
    if (!beforeDrop.readyForApply || beforeDrop.missingIndexes.length || beforeDrop.missingCollections.length) {
      return { ...beforeDrop, mode: "apply", status: "APPLY STOPPED BEFORE LEGACY DROP", operations };
    }
    operations.push({ action: "verifyRequiredIndexes" });
    for (const { collection, name } of beforeDrop.confirmedLegacy) {
      await db.collection(collection).dropIndex(name);
      operations.push({ action: "dropConfirmedLegacyIndex", collection, index: name });
    }
    const final = await inspect(db, expectedDatabaseName);
    if (!final.readyForApply || final.missingIndexes.length || final.missingCollections.length || final.confirmedLegacy.length) {
      return { ...final, mode: "apply", status: "APPLY INCOMPLETE", operations };
    }
    operations.push({ action: "verifyFinalIndexes" });
    return { ...final, mode: "apply", status: "APPLY COMPLETE", operations };
  } catch (error) {
    let afterFailure;
    try { afterFailure = await inspect(db, expectedDatabaseName); } catch { afterFailure = null; }
    return {
      mode: "apply", database: expectedDatabaseName, status: "APPLY FAILED", operations,
      failure: { name: error.name, code: error.code || null },
      afterFailure,
    };
  }
}

async function main(args = process.argv.slice(2), env = process.env) {
  const mode = parseMode(args);
  const databaseName = resolveDatabase(env, mode); // No connection or query before the guard.
  const client = new MongoClient(env.MONGO_DB, {
    retryWrites: false,
    readPreference: "primary",
    readConcern: { level: "majority" },
    writeConcern: { w: "majority" },
  });
  try {
    await client.connect();
    const db = client.db(databaseName);
    const result = mode === "apply" ? await apply(db, databaseName) : await inspect(db, databaseName);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "NOT READY FOR APPLY" || result.status.startsWith("APPLY ") && result.status !== "APPLY COMPLETE") process.exitCode = 2;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    // Driver error messages can contain connection details; never print them.
    console.error(JSON.stringify({ status: "ERROR", name: error.name, code: error.code || null }));
    process.exitCode = 1;
  });
}

module.exports = { INDEXES, LEGACY_QUIZ_INDEXES, parseMode, resolveDatabase, inspect, apply, main, meaningfulOptions, sameDefinition };
