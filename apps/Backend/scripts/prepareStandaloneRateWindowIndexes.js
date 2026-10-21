// Additive-only preparation for the authenticated per-Quiz rate store.
// Never import application models or run this from Backend startup.
const { MongoClient } = require("mongoose").mongo;
const { INDEXES, sameDefinition } = require("./prepareQuizIndexes");
const { PRODUCTION_DB, TESTING_HOST } = require("./productionQuizTarget");

const COLLECTION = "standalonequizratewindows";
const EXPECTED = INDEXES[COLLECTION];

function parseArgs(args) {
  let expectedDatabase; let expectedHost; let apply = false; let confirmation;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--expected-db" && expectedDatabase === undefined) expectedDatabase = args[++index];
    else if (arg === "--expected-host" && expectedHost === undefined) expectedHost = args[++index];
    else if (arg === "--apply" && !apply) apply = true;
    else if (arg === "--confirm-collection" && confirmation === undefined) confirmation = args[++index];
    else throw new Error("Invalid rate-index preparation arguments.");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(expectedDatabase || "")
    || !/^[A-Za-z0-9.-]+$/.test(expectedHost || "")
    || (apply && confirmation !== COLLECTION) || (!apply && confirmation !== undefined)) {
    throw new Error("Explicit database and host are required; apply also requires collection confirmation.");
  }
  return { expectedDatabase, expectedHost, apply };
}

function resolveTarget(env, args) {
  let uri;
  try { uri = new URL(env.MONGO_DB); } catch { throw new Error("A MongoDB URI is required."); }
  let database;
  try { database = decodeURIComponent(uri.pathname.slice(1)); }
  catch { throw new Error("The MongoDB database path is invalid."); }
  const overridesDatabase = [...uri.searchParams.keys()].some((key) => key.toLowerCase() === "dbname");
  const unsafeTls = env.NODE_TLS_REJECT_UNAUTHORIZED === "0" || [...uri.searchParams].some(([key, value]) => {
    const option = key.toLowerCase();
    return (option === "tls" || option === "ssl") ? value.toLowerCase() !== "true"
      : option.startsWith("tls") || option.startsWith("ssl");
  });
  const loopback = uri.protocol === "mongodb:" && uri.hostname === "127.0.0.1";
  const secureAtlas = uri.protocol === "mongodb+srv:" && uri.hostname.endsWith(".mongodb.net") && !uri.port;
  if (!(loopback || secureAtlas) || uri.hostname !== args.expectedHost
    || database !== args.expectedDatabase || overridesDatabase || uri.hash || unsafeTls) {
    throw new Error("The MongoDB target does not match the explicit database and host.");
  }
  if ((database === PRODUCTION_DB) !== (env.NODE_ENV === "production")) {
    throw new Error("The database and environment classification differ.");
  }
  if (args.apply && (database === PRODUCTION_DB || env.NODE_ENV === "production"
    || env.PRODUCTION_MONGO_EXPECTED_HOST !== undefined
    || env.QUIZ_INDEX_EXPECTED_DB === PRODUCTION_DB
    || env.STANDALONE_QUIZ_EXPECTED_DB === PRODUCTION_DB
    || !["test", "testing"].includes(env.NODE_ENV)
    || !(loopback || (secureAtlas && uri.hostname === TESTING_HOST)))) {
    // URI/flag agreement is not independent proof of the connected Atlas cluster.
    // This utility deliberately cannot prepare production indexes.
    throw new Error("Apply is restricted to explicit local or approved testing targets.");
  }
  return database;
}

async function inspect(db, expectedDatabase) {
  if (db.databaseName !== expectedDatabase) throw new Error("Connected database does not match the approved target.");
  const names = await db.listCollections({ name: COLLECTION }, { nameOnly: true }).toArray();
  if (!names.length) return { status: "INDEXES_MISSING", collection: COLLECTION,
    missing: EXPECTED.map((item) => item.name), existingRecords: 0 };
  const collection = db.collection(COLLECTION);
  const count = await collection.countDocuments({});
  const actual = await collection.listIndexes().toArray();
  const conflicts = EXPECTED.filter((spec) => actual.some((index) => index.name === spec.name
    && !sameDefinition(index, spec))).map((spec) => spec.name);
  const missing = EXPECTED.filter((spec) => !actual.some((index) => sameDefinition(index, spec)))
    .map((spec) => spec.name);
  const unexpected = actual.filter((index) => index.name !== "_id_"
    && !EXPECTED.some((spec) => sameDefinition(index, spec))).map((index) => index.name);
  return { status: conflicts.length || unexpected.length || (count && missing.length)
    ? "BLOCKED_FOR_REVIEW" : missing.length ? "INDEXES_MISSING" : "INDEXES_READY",
  collection: COLLECTION, missing, conflicts, unexpected, existingRecords: count };
}

function incomplete(verification, created) {
  return { status: "APPLY_INCOMPLETE", collection: COLLECTION, created,
    verificationStatus: verification?.status === "INDEXES_READY" && !verifiedReady(verification)
      ? "UNVERIFIED" : typeof verification?.status === "string" ? verification.status : "UNVERIFIED",
    missing: Array.isArray(verification?.missing) ? verification.missing : [],
    conflicts: Array.isArray(verification?.conflicts) ? verification.conflicts : [],
    unexpected: Array.isArray(verification?.unexpected) ? verification.unexpected : [],
    note: "Read-only reinspection and operator review are required before retrying." };
}

function verifiedReady(result) {
  return result?.status === "INDEXES_READY" && result.collection === COLLECTION
    && [result.missing, result.conflicts, result.unexpected].every((entries) =>
      Array.isArray(entries) && entries.length === 0)
    && Number.isSafeInteger(result.existingRecords) && result.existingRecords >= 0;
}

function verifiedMissing(result) {
  return result?.status === "INDEXES_MISSING" && result.collection === COLLECTION
    && Array.isArray(result.missing) && result.missing.length > 0
    && result.missing.every((name) => EXPECTED.some((spec) => spec.name === name))
    && Number.isSafeInteger(result.existingRecords) && result.existingRecords >= 0
    && [result.conflicts, result.unexpected].every((entries) =>
      entries === undefined || (Array.isArray(entries) && entries.length === 0));
}

async function apply(db, expectedDatabase, { inspectIndexes = inspect } = {}) {
  const created = [];
  const initial = await inspectIndexes(db, expectedDatabase);
  if (verifiedReady(initial) || initial?.status === "BLOCKED_FOR_REVIEW") return initial;
  if (!verifiedMissing(initial)) return incomplete(initial, created);
  if (initial.existingRecords) return { ...initial, status: "BLOCKED_FOR_REVIEW" };
  const names = await db.listCollections({ name: COLLECTION }, { nameOnly: true }).toArray();
  if (!names.length) await db.createCollection(COLLECTION);
  for (const spec of EXPECTED) {
    const current = await inspectIndexes(db, expectedDatabase);
    if (current?.status === "BLOCKED_FOR_REVIEW" || current?.existingRecords) return incomplete(current, created);
    if (!verifiedMissing(current) && !verifiedReady(current)) return incomplete(current, created);
    if (current.missing.includes(spec.name)) {
      await db.collection(COLLECTION).createIndex(spec.key, { ...spec.options, name: spec.name });
      created.push(spec.name);
    }
  }
  const final = await inspectIndexes(db, expectedDatabase);
  return verifiedReady(final) ? final : incomplete(final, created);
}

function resultExitCode(applying, result) {
  if (applying) return verifiedReady(result) ? 0 : 2;
  return verifiedReady(result) || verifiedMissing(result) ? 0 : 2;
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const database = resolveTarget(env, args);
  const client = new MongoClient(env.MONGO_DB, { retryWrites: false, readPreference: "primary" });
  try {
    await client.connect();
    const result = args.apply ? await apply(client.db(database), database) : await inspect(client.db(database), database);
    console.log(JSON.stringify(result));
    const exitCode = resultExitCode(args.apply, result);
    if (exitCode) process.exitCode = exitCode;
    return result;
  } finally { await client.close(); }
}

async function runCli(argv = process.argv.slice(2), env = process.env, execute = main) {
  try { return await execute(argv, env); }
  catch (error) {
    // Driver messages may contain connection details; never print them.
    console.error(JSON.stringify({ status: "ERROR", name: error.name, code: error.code || null }));
    process.exitCode = 1;
    return null;
  }
}

if (require.main === module) runCli();

module.exports = { COLLECTION, parseArgs, resolveTarget, inspect, apply, resultExitCode, main, runCli };
