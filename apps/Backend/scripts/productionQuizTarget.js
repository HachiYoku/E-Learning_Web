// An operator must obtain this hostname independently from the production
// Atlas/Render configuration. The database name alone is not an identity check.
const PRODUCTION_DB = "arunthai";
const TESTING_HOST = "englishkafe.xhqpzdd.mongodb.net";

function assertProductionTarget(uri, env = process.env, expectedDbKey = "QUIZ_INDEX_EXPECTED_DB") {
  const expectedHost = env.PRODUCTION_MONGO_EXPECTED_HOST;
  if (env.NODE_ENV !== "production" || env.NODE_TLS_REJECT_UNAUTHORIZED === "0"
    || env[expectedDbKey] !== PRODUCTION_DB
    || typeof expectedHost !== "string" || expectedHost !== expectedHost.trim()
    || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.mongodb\.net$/.test(expectedHost)
    || expectedHost === TESTING_HOST) {
    throw new Error("Production database identity is not independently configured.");
  }
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error("Production MongoDB target is invalid."); }
  // mongodb+srv enables TLS by default. Reject every URI option capable of
  // weakening its certificate/hostname checks, including case variants and
  // duplicate parameters (the driver treats option names case-insensitively).
  const unsafeTlsOption = [...parsed.searchParams].some(([rawKey, rawValue]) => {
    const key = rawKey.toLowerCase();
    return (key === "tls" || key === "ssl") ? rawValue.toLowerCase() !== "true"
      : key.startsWith("tls") || key.startsWith("ssl");
  });
  if (parsed.protocol !== "mongodb+srv:" || parsed.hostname !== expectedHost
    || parsed.port || parsed.pathname !== `/${PRODUCTION_DB}` || parsed.hash
    || unsafeTlsOption) {
    throw new Error("Production MongoDB target does not match the approved host and database.");
  }
  return { host: expectedHost, database: PRODUCTION_DB };
}

function assertConnectedProductionTarget(client, db, identity) {
  if (db?.databaseName !== identity.database || client?.options?.srvHost !== identity.host) {
    throw new Error("Connected MongoDB identity does not match the approved production target.");
  }
}

module.exports = { PRODUCTION_DB, TESTING_HOST, assertProductionTarget, assertConnectedProductionTarget };
