function parseMongoTarget(uri = process.env.MONGO_DB) {
  if (typeof uri !== "string" || !uri.trim()) throw new Error("MONGO_DB is required for retention jobs.");
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error("MONGO_DB must be a valid MongoDB URI."); }
  if (!["mongodb:", "mongodb+srv:"].includes(parsed.protocol) || !parsed.hostname) throw new Error("MONGO_DB must be a MongoDB URI with an exact host and database.");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database || database.includes("/")) throw new Error("MONGO_DB must include one exact database name.");
  return { host: parsed.host.toLowerCase(), database };
}

function assertRetentionJobEnvironment({ dryRun = false, env = process.env } = {}) {
  const target = parseMongoTarget(env.MONGO_DB);
  const allowedDatabase = String(env.RETENTION_ALLOWED_DB_NAME || "");
  if (!allowedDatabase || target.database !== allowedDatabase) throw new Error("Retention job database target is not the explicitly allowed database.");
  const allowedHost = String(env.RETENTION_ALLOWED_MONGO_HOST || "").toLowerCase();
  if (allowedHost && target.host !== allowedHost) throw new Error("Retention job MongoDB host is not the explicitly allowed host.");
  if (!dryRun && env.RETENTION_JOBS_ENABLED !== "true") throw new Error("RETENTION_JOBS_ENABLED=true is required for destructive retention jobs.");
  return target;
}

module.exports = { parseMongoTarget, assertRetentionJobEnvironment };
