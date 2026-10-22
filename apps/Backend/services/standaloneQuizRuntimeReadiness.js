const mongoose = require("mongoose");
const { INDEXES, sameDefinition } = require("../scripts/prepareQuizIndexes");

// These definitions must be present before the standalone session, submission,
// and shared rate-limit routes are enabled. TTL cleanup is not relied on for
// uniqueness or the 24-hour session boundary.
const REQUIRED_INDEXES = Object.freeze({
  quizsessions: ["expiresAt_1", "one_active_standalone_session"],
  quizattempts: ["quiz_1_user_1_attemptNumber_1", "one_standalone_attempt_per_session"],
  standalonequizratewindows: ["one_standalone_quiz_rate_window", "standalone_quiz_rate_window_expiry"],
});

const unavailable = (reason) => ({ ready: false, reason });

function validExpectedDatabase(name) {
  return typeof name === "string" && name.length > 0 && name === name.trim()
    && !/[/\\\s]/.test(name);
}

async function inspectStandaloneRuntimeReadiness({ connection = mongoose.connection, env = process.env } = {}) {
  const enabled = env?.STANDALONE_QUIZ_RUNTIME_ENABLED;
  if (enabled === undefined || enabled === "false") return unavailable("disabled");
  if (enabled !== "true") return unavailable("invalid_configuration");

  const expectedDatabase = env?.STANDALONE_QUIZ_EXPECTED_DB;
  if (!validExpectedDatabase(expectedDatabase)) return unavailable("invalid_configuration");
  if (connection?.readyState !== 1 || !connection.db) return unavailable("database_unavailable");
  const db = connection.db;
  if (db.databaseName !== expectedDatabase) return unavailable("database_mismatch");

  try {
    const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
    if (!names.has("quizzes")) return unavailable("index_readiness_unverified");
    for (const [collectionName, requiredNames] of Object.entries(REQUIRED_INDEXES)) {
      if (!names.has(collectionName)) return unavailable("index_readiness_unverified");
      const actual = await db.collection(collectionName).listIndexes().toArray();
      for (const name of requiredNames) {
        const expected = INDEXES[collectionName]?.find((spec) => spec.name === name);
        if (!expected || !actual.some((spec) => sameDefinition(spec, expected))) {
          return unavailable("index_readiness_unverified");
        }
      }
    }

    const hello = await db.admin().command({ hello: 1 });
    if (!(hello.setName || hello.msg === "isdbgrid") || hello.logicalSessionTimeoutMinutes == null) {
      return unavailable("transaction_readiness_unverified");
    }

    // A read in a snapshot transaction verifies more than the hello topology
    // hint. No document or index is created, updated, or deleted.
    const session = await connection.startSession();
    try {
      session.startTransaction({ readConcern: { level: "snapshot" }, readPreference: "primary" });
      await db.collection("quizzes").findOne({}, { projection: { _id: 1 }, session });
      await session.abortTransaction();
    } finally {
      if (session.inTransaction()) await session.abortTransaction();
      await session.endSession();
    }
    return { ready: true };
  } catch (_error) {
    // A failed metadata read or transaction must never turn into activation.
    return unavailable("readiness_unverified");
  }
}

// Future standalone runtime routes can reuse this middleware. It is not
// mounted in Checkpoint 4.1, so this checkpoint activates no public runtime.
function standaloneRuntimeGate(options) {
  return async function requireStandaloneRuntimeReady(_req, res, next) {
    const state = await inspectStandaloneRuntimeReadiness(options);
    if (!state.ready) {
      return res.status(503).json({ code: "standalone_runtime_unavailable",
        message: "General Practice is temporarily unavailable." });
    }
    return next();
  };
}

module.exports = { REQUIRED_INDEXES, inspectStandaloneRuntimeReadiness,
  requireStandaloneRuntimeReady: standaloneRuntimeGate(), standaloneRuntimeGate };
