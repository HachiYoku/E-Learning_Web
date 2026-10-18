// Operator-only command. Dry-run is the default; never schedule it implicitly.
// Usage: node scripts/retryQuizSetCoverCleanup.js [--limit=20] [--execute]
// Production requires --production and independent PRODUCTION_MONGO_EXPECTED_HOST.
// Preserve the testing command's existing .env behavior. Production execution
// requires process-scoped configuration and must not import a local .env file.
if (!process.argv.includes("--production")) require("dotenv").config();
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const { retryCoverCleanup } = require("../services/quizSetCoverService");
const { resolveCoverEnvironment, TESTING_HOST, TESTING_DB, TESTING_CLOUD } = require("../services/quizSetCoverEnvironment");
const { assertProductionTarget, assertConnectedProductionTarget } = require("./productionQuizTarget");

const PRODUCTION_CLOUD = "du6lhdq8t";

function options(args) {
  const result = { execute: false, limit: 20, production: false };
  for (const arg of args) {
    if (arg === "--execute") result.execute = true;
    else if (arg === "--production") result.production = true;
    else if (/^--limit=\d+$/.test(arg)) result.limit = Number(arg.slice(8));
    else throw new Error("Unsupported cleanup option.");
  }
  if (!Number.isSafeInteger(result.limit) || result.limit < 1 || result.limit > 100) {
    throw new Error("Cleanup limit must be between 1 and 100.");
  }
  return result;
}

function assertTestingTarget(uri, env = process.env) {
  const identity = resolveCoverEnvironment({ ...env, MONGO_DB: uri });
  if (identity.mode !== "testing" || identity.host !== TESTING_HOST
    || identity.database !== TESTING_DB || identity.cloudName !== TESTING_CLOUD) {
    throw new Error("Cleanup requires the approved testing database, environment, and Cloudinary cloud.");
  }
  return identity;
}

function assertConfiguredCloud(identity, configuredName) {
  const expectedCloud = identity.mode === "production" ? PRODUCTION_CLOUD : TESTING_CLOUD;
  if (configuredName !== identity.cloudName || configuredName !== expectedCloud) {
    throw new Error("Configured Cloudinary client does not match the approved environment cloud.");
  }
}

function assertProductionCleanupTarget(uri, env = process.env) {
  const target = assertProductionTarget(uri, env, "STANDALONE_QUIZ_EXPECTED_DB");
  const identity = resolveCoverEnvironment({ ...env, MONGO_DB: uri });
  if (identity.mode !== "production" || identity.host !== target.host
    || identity.database !== target.database || identity.cloudName !== PRODUCTION_CLOUD
    || identity.folder !== "arun_thai/quiz_set_covers") {
    throw new Error("Cleanup requires the approved production database, environment, and cloud.");
  }
  return identity;
}

async function main() {
  const parsed = options(process.argv.slice(2));
  const identity = parsed.production
    ? assertProductionCleanupTarget(process.env.MONGO_DB)
    : assertTestingTarget(process.env.MONGO_DB);
  assertConfiguredCloud(identity, cloudinary.config().cloud_name);
  await mongoose.connect(process.env.MONGO_DB, { autoCreate: false, autoIndex: false });
  if (parsed.production) {
    assertConnectedProductionTarget(mongoose.connection.client, mongoose.connection.db, identity);
  } else if (mongoose.connection.name !== TESTING_DB || mongoose.connection.client?.options?.srvHost !== TESTING_HOST) {
    throw new Error("Connected MongoDB identity does not match the approved testing target.");
  }
  const summary = await retryCoverCleanup(parsed);
  console.log(JSON.stringify(summary)); // Counts only; no credentials or asset identifiers.
  if (summary.failed) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => {
  // Driver errors can contain credentials; only report non-sensitive metadata.
  console.error(JSON.stringify({ status: "ERROR", name: error?.name || "Error", code: error?.code || null }));
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());

module.exports = { options, assertTestingTarget, assertProductionCleanupTarget, assertConfiguredCloud };
