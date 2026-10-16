// Operator-only command. Dry-run is the default; never schedule it implicitly.
// Usage: node scripts/retryQuizSetCoverCleanup.js [--limit=20] [--execute]
require("dotenv").config();
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const { retryCoverCleanup } = require("../services/quizSetCoverService");
const { resolveCoverEnvironment, TESTING_HOST, TESTING_DB, TESTING_CLOUD } = require("../services/quizSetCoverEnvironment");

function options(args) {
  const result = { execute: false, limit: 20 };
  for (const arg of args) {
    if (arg === "--execute") result.execute = true;
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
  if (configuredName !== identity.cloudName || configuredName !== TESTING_CLOUD) {
    throw new Error("Configured Cloudinary client does not match the approved testing cloud.");
  }
}

async function main() {
  const parsed = options(process.argv.slice(2));
  const identity = assertTestingTarget(process.env.MONGO_DB);
  assertConfiguredCloud(identity, cloudinary.config().cloud_name);
  await mongoose.connect(process.env.MONGO_DB, { autoCreate: false, autoIndex: false });
  if (mongoose.connection.name !== TESTING_DB || mongoose.connection.client?.options?.srvHost !== TESTING_HOST) {
    throw new Error("Connected MongoDB identity does not match the approved testing target.");
  }
  const summary = await retryCoverCleanup(parsed);
  console.log(JSON.stringify(summary)); // Counts only; no credentials or asset identifiers.
  if (summary.failed) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => {
  console.error(error.message); process.exitCode = 1;
}).finally(() => mongoose.disconnect());

module.exports = { options, assertTestingTarget, assertConfiguredCloud };
