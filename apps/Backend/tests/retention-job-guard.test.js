const assert = require("node:assert/strict");
const test = require("node:test");
const { assertRetentionJobEnvironment } = require("../services/retentionJobGuard");

const base = { MONGO_DB: "mongodb+srv://user:pass@cluster.example.test/english_kafe?retryWrites=true", RETENTION_ALLOWED_DB_NAME: "english_kafe", RETENTION_ALLOWED_MONGO_HOST: "cluster.example.test", RETENTION_JOBS_ENABLED: "true" };
test("retention guard fails closed for disabled, missing, malformed, and mismatched targets", () => {
  assert.throws(() => assertRetentionJobEnvironment({ env: { ...base, RETENTION_JOBS_ENABLED: "false" } }), /RETENTION_JOBS_ENABLED/);
  assert.throws(() => assertRetentionJobEnvironment({ env: { ...base, RETENTION_ALLOWED_DB_NAME: "" } }), /explicitly allowed/);
  assert.throws(() => assertRetentionJobEnvironment({ env: { ...base, MONGO_DB: "not-a-uri" } }), /valid MongoDB URI/);
  assert.throws(() => assertRetentionJobEnvironment({ env: { ...base, MONGO_DB: "mongodb://cluster.example.test/english_kafe_uat" } }), /explicitly allowed/);
  assert.throws(() => assertRetentionJobEnvironment({ env: { ...base, MONGO_DB: "mongodb://other.example.test/english_kafe" } }), /allowed host/);
});
test("exact approved target proceeds and dry run does not require destructive enablement", () => {
  assert.deepEqual(assertRetentionJobEnvironment({ env: base }), { host: "cluster.example.test", database: "english_kafe" });
  assert.deepEqual(assertRetentionJobEnvironment({ dryRun: true, env: { ...base, RETENTION_JOBS_ENABLED: "false" } }), { host: "cluster.example.test", database: "english_kafe" });
});
