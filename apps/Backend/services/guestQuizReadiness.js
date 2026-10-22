const mongoose = require("mongoose");
const GuestQuizSession = require("../models/guestQuizSessionModel");
const GuestQuizAttempt = require("../models/guestQuizAttemptModel");
const GuestQuizRateWindow = require("../models/guestQuizRateWindowModel");
const { inspectStandaloneRuntimeReadiness } = require("./standaloneQuizRuntimeReadiness");
const { getTrustedUrls } = require("../config/trustedUrls");

const MODELS = [GuestQuizSession, GuestQuizAttempt, GuestQuizRateWindow];

function sameIndex(actual, keys, options) {
  return (!options.name || actual.name === options.name)
    && JSON.stringify(actual.key) === JSON.stringify(keys)
    && Boolean(actual.unique) === Boolean(options.unique)
    && JSON.stringify(actual.partialFilterExpression || null) === JSON.stringify(options.partialFilterExpression || null)
    && (actual.expireAfterSeconds ?? null) === (options.expireAfterSeconds ?? null);
}

// Every guest runtime route uses this fail-closed check; Mongoose index
// declarations are not proof that the required database indexes exist.
async function inspectGuestQuizReadiness({ connection = mongoose.connection, env = process.env } = {}) {
  if (env.GUEST_QUIZ_RUNTIME_ENABLED !== "true") return { ready: false, reason: "disabled" };
  try {
    if (typeof env.JWT_SECRET !== "string" || env.JWT_SECRET.length < 16
      || (env.NODE_ENV === "production" && (env.TRUST_PROXY !== "true"
        || env.GUEST_QUIZ_PROXY_VERIFIED !== "true"))
      || (env.NODE_ENV !== "production" && env.TRUST_PROXY)) {
      return { ready: false, reason: "invalid_configuration" };
    }
    getTrustedUrls(env);
  } catch (_error) { return { ready: false, reason: "invalid_configuration" }; }
  if (!env.STANDALONE_QUIZ_EXPECTED_DB || connection?.readyState !== 1
    || connection.db?.databaseName !== env.STANDALONE_QUIZ_EXPECTED_DB) {
    return { ready: false, reason: "database_unverified" };
  }
  try {
    const names = new Set((await connection.db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
    for (const model of MODELS) {
      if (!names.has(model.collection.name)) return { ready: false, reason: "indexes_unverified" };
      const actual = await connection.db.collection(model.collection.name).listIndexes().toArray();
      for (const [keys, options] of model.schema.indexes()) {
        if (!actual.some((index) => sameIndex(index, keys, options))) {
          return { ready: false, reason: "indexes_unverified" };
        }
      }
    }
    const standalone = await inspectStandaloneRuntimeReadiness({ connection, env });
    if (!standalone.ready) return { ready: false, reason: "standalone_runtime_unverified" };
    return { ready: true };
  } catch (_error) {
    return { ready: false, reason: "readiness_unverified" };
  }
}

module.exports = { inspectGuestQuizReadiness, sameIndex };
