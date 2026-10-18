// Operator-only, additive production preparation. No application startup imports.
// Dry-run: node scripts/prepareProductionQuizIndexes.js
// Apply (separate approval required): node scripts/prepareProductionQuizIndexes.js --apply
// Production identity and credentials must be supplied explicitly to this
// process; never load a local .env file as a fallback.
const { MongoClient } = require("mongoose").mongo;
const { INDEXES, sameDefinition } = require("./prepareQuizIndexes");
const { inspect: inspectStandalone } = require("./preflightStandaloneQuizIndexes");
const { inspect: inspectSets } = require("./preflightQuizSetIndexes");
const { REQUIRED_INDEXES } = require("../services/standaloneQuizRuntimeReadiness");
const QuizSet = require("../models/quizSetModel");
const Quiz = require("../models/quizModel");
const QuizCreationRequest = require("../models/quizCreationRequestModel");
const GuestSession = require("../models/guestQuizSessionModel");
const GuestAttempt = require("../models/guestQuizAttemptModel");
const GuestRateWindow = require("../models/guestQuizRateWindowModel");
const CoverAsset = require("../models/quizSetCoverAssetModel");
const { assertProductionTarget, assertConnectedProductionTarget } = require("./productionQuizTarget");

const schemaSpecs = (model) => model.schema.indexes().map(([key, options]) => ({
  key, options, name: options.name || Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_"),
}));
const requiredFromManifest = (collection, names) => names.map((name) => {
  const spec = INDEXES[collection]?.find((entry) => entry.name === name);
  if (!spec) throw new Error("The Quiz index manifest is incomplete.");
  return spec;
});

const REQUIRED = Object.freeze({
  quizsessions: requiredFromManifest("quizsessions", REQUIRED_INDEXES.quizsessions),
  quizattempts: requiredFromManifest("quizattempts", REQUIRED_INDEXES.quizattempts),
  quizratewindows: requiredFromManifest("quizratewindows", REQUIRED_INDEXES.quizratewindows),
  quizsets: schemaSpecs(QuizSet),
  quizzes: schemaSpecs(Quiz).filter((spec) => Object.hasOwn(spec.key, "quizSet")),
  quizcreationrequests: schemaSpecs(QuizCreationRequest),
  guestquizsessions: schemaSpecs(GuestSession),
  guestquizattempts: schemaSpecs(GuestAttempt),
  guestquizratewindows: schemaSpecs(GuestRateWindow),
  quizsetcoverassets: schemaSpecs(CoverAsset), // Currently only MongoDB's default _id_ index.
});

function parseArgs(args) {
  if (args.length === 0) return { apply: false };
  if (args.length === 1 && args[0] === "--apply") return { apply: true };
  throw new Error("Use no arguments for a read-only dry-run or --apply for additive preparation.");
}

async function duplicateGroups(collection, spec) {
  const keys = Object.keys(spec.key);
  const [result] = await collection.aggregate([
    { $match: spec.options.partialFilterExpression || {} },
    { $group: { _id: Object.fromEntries(keys.map((key) => [key, `$${key}`])), count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "groups" },
  ]).toArray();
  return result?.groups || 0;
}

async function expiredTtlDocuments(collection, spec, now = new Date()) {
  const seconds = spec.options.expireAfterSeconds;
  if (!Number.isSafeInteger(seconds) || seconds < 0 || Object.keys(spec.key).length !== 1) {
    throw new Error("Unsupported TTL index definition.");
  }
  const field = Object.keys(spec.key)[0];
  const cutoff = new Date(now.getTime() - seconds * 1000);
  if (!Number.isFinite(cutoff.getTime())) throw new Error("Invalid TTL expiry threshold.");
  return collection.countDocuments({ [field]: { $type: "date", $lte: cutoff } });
}

async function snapshotReadSupported(client, db) {
  const hello = await db.admin().command({ hello: 1 });
  if (!(hello.setName || hello.msg === "isdbgrid") || hello.logicalSessionTimeoutMinutes == null) return false;
  if (!client || typeof client.startSession !== "function") return false;
  const session = client.startSession();
  try {
    session.startTransaction({ readConcern: { level: "snapshot" }, readPreference: "primary" });
    await db.collection("quizzes").findOne({}, { projection: { _id: 1 }, session });
    await session.abortTransaction();
    return true;
  } catch { return false; }
  finally {
    if (session.inTransaction()) await session.abortTransaction();
    await session.endSession();
  }
}

async function inspect(db, client, { standaloneInspector = inspectStandalone,
  setInspector = inspectSets, transactionCheck = snapshotReadSupported } = {}) {
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  const missingCollections = Object.keys(REQUIRED).filter((name) => !names.has(name));
  const present = []; const missing = []; const conflicts = []; const duplicates = []; const ttlRisks = [];
  for (const [collection, specs] of Object.entries(REQUIRED)) {
    const actual = names.has(collection) ? await db.collection(collection).listIndexes().toArray() : [];
    for (const spec of specs) {
      if (actual.some((entry) => sameDefinition(entry, spec))) { present.push({ collection, name: spec.name }); continue; }
      if (actual.some((entry) => entry.name === spec.name
        || JSON.stringify(entry.key) === JSON.stringify(spec.key))) {
        conflicts.push({ collection, name: spec.name }); continue;
      }
      missing.push({ collection, name: spec.name });
      if (spec.options.expireAfterSeconds !== undefined) {
        const expiredDocuments = names.has(collection)
          ? await expiredTtlDocuments(db.collection(collection), spec) : 0;
        ttlRisks.push({ collection, name: spec.name, expiredDocuments,
          consequence: "Creating this TTL index enables MongoDB deletion of expired documents." });
      }
      if (names.has(collection) && spec.options.unique) {
        const count = await duplicateGroups(db.collection(collection), spec);
        if (count) duplicates.push({ collection, name: spec.name, groups: count });
      }
    }
  }
  if (names.has("quizsetcoverassets")) {
    const coverIndexes = await db.collection("quizsetcoverassets").listIndexes().toArray();
    if (!coverIndexes.some((index) => index.name === "_id_"
      && JSON.stringify(index.key) === JSON.stringify({ _id: 1 })
      && index.partialFilterExpression == null && index.expireAfterSeconds == null)) {
      conflicts.push({ collection: "quizsetcoverassets", name: "_id_" });
    }
  }
  const standalone = await standaloneInspector(db, db.databaseName);
  const sets = await setInspector(db);
  const issueCount = Object.entries(standalone.issues).reduce((total, [name, value]) =>
    name === "standaloneWithoutRuntimeFence" ? total : total + value, 0);
  const membershipCount = Object.values(sets.membership).reduce((total, value) =>
    total + (typeof value === "number" ? value : 0), 0);
  const transactionReady = await transactionCheck(client, db);
  const blocked = conflicts.length || duplicates.length || issueCount || membershipCount || !transactionReady
    || ttlRisks.some(({ expiredDocuments }) => expiredDocuments > 0);
  return { status: blocked ? "BLOCKED_FOR_REVIEW" : missingCollections.length || missing.length
      ? "READY_FOR_ADDITIVE_APPLY" : "INDEXES_READY",
    database: db.databaseName, missingCollections, present, missing, conflicts, duplicates, ttlRisks,
    standaloneIssues: standalone.issues, membership: sets.membership, transactionReady,
    plan: [
      ...missingCollections.map((collection) => ({ action: "createCollection", collection })),
      ...missing.map(({ collection, name }) => ({ action: "createIndex", collection, name })),
    ],
  };
}

async function apply(db, client, initial, inspectors = {}) {
  if (initial.status === "BLOCKED_FOR_REVIEW") throw new Error("Production preflight found conflicts or unsafe data.");
  const created = [];
  let failedOperation = null;
  try {
    for (const operation of initial.plan) {
      failedOperation = operation;
      const current = await inspect(db, client, inspectors);
      if (current.status === "BLOCKED_FOR_REVIEW") throw new Error("Production state changed; preparation stopped.");
      if (operation.action === "createCollection") {
        if (!current.missingCollections.includes(operation.collection)) continue;
        await db.createCollection(operation.collection);
      } else {
        if (!current.missing.some(({ collection, name }) => collection === operation.collection && name === operation.name)) continue;
        const spec = REQUIRED[operation.collection].find(({ name }) => name === operation.name);
        // Recheck immediately before creation, even if the earlier plan was safe.
        if (spec.options.expireAfterSeconds !== undefined
          && await expiredTtlDocuments(db.collection(operation.collection), spec) > 0) {
          throw new Error("Expired documents appeared before TTL index creation.");
        }
        await db.collection(operation.collection).createIndex(spec.key, { ...spec.options, name: spec.name });
      }
      created.push(operation);
    }
    failedOperation = { action: "verifyFinalIndexes" };
    const final = await inspect(db, client, inspectors);
    if (final.status !== "INDEXES_READY") throw new Error("Production index preparation did not verify cleanly.");
    return { ...final, created };
  } catch (error) {
    let afterFailure = null;
    try { afterFailure = await inspect(db, client, inspectors); } catch { /* Preserve the original failure. */ }
    return { status: "APPLY_INCOMPLETE", database: db.databaseName, created, failedOperation,
      failure: { name: error?.name || "Error", code: error?.code || null }, afterFailure };
  }
}

async function main(args = process.argv.slice(2), env = process.env) {
  const { apply: applying } = parseArgs(args);
  const identity = assertProductionTarget(env.MONGO_DB, env);
  const client = new MongoClient(env.MONGO_DB, {
    retryWrites: false, readPreference: "primary", readConcern: { level: "majority" },
    writeConcern: { w: "majority" },
  });
  try {
    await client.connect();
    const db = client.db(identity.database);
    assertConnectedProductionTarget(client, db, identity);
    const plan = await inspect(db, client);
    console.log(JSON.stringify({ mode: "dry-run", ...plan }));
    if (!applying || plan.status === "BLOCKED_FOR_REVIEW") {
      if (plan.status === "BLOCKED_FOR_REVIEW") process.exitCode = 2;
      return plan;
    }
    const result = await apply(db, client, plan);
    console.log(JSON.stringify({ mode: "apply", ...result }));
    if (result.status !== "INDEXES_READY") process.exitCode = 2;
    return result;
  } finally { await client.close(); }
}

if (require.main === module) main().catch((error) => {
  // Driver errors can contain connection details: never print their messages.
  console.error(JSON.stringify({ status: "ERROR", name: error?.name || "Error", code: error?.code || null }));
  process.exitCode = 1;
});

module.exports = { REQUIRED, parseArgs, duplicateGroups, expiredTtlDocuments,
  snapshotReadSupported, inspect, apply, main };
