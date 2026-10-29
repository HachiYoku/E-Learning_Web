const assert = require("node:assert/strict");
const { test } = require("node:test");
const { assertProductionTarget, assertConnectedProductionTarget } = require("../scripts/productionQuizTarget");
const preparation = require("../scripts/prepareProductionQuizIndexes");

const host = "arunthai.abcde.mongodb.net";
const uri = `mongodb+srv://${host}/arunthai`;
const env = { NODE_ENV: "production", MONGO_DB: uri, QUIZ_INDEX_EXPECTED_DB: "arunthai",
  PRODUCTION_MONGO_EXPECTED_HOST: host };
const inspectors = {
  standaloneInspector: async () => ({ issues: {} }),
  setInspector: async () => ({ membership: {} }),
  transactionCheck: async () => true,
};

function fakeDatabase(initial = {}, duplicateCount = 0, expiredCount = 0) {
  const idIndex = () => ({ name: "_id_", key: { _id: 1 } });
  const collections = new Map(Object.entries(initial).map(([name, indexes]) => [name, [idIndex(), ...indexes]]));
  const writes = [];
  return { databaseName: "arunthai", writes, collections,
    listCollections: () => ({ toArray: async () => [...collections.keys()].map((name) => ({ name })) }),
    createCollection: async (name) => { writes.push(["collection", name]); collections.set(name, [idIndex()]); },
    collection: (name) => ({
      listIndexes: () => ({ toArray: async () => collections.get(name) || [] }),
      aggregate: () => ({ toArray: async () => duplicateCount ? [{ groups: duplicateCount }] : [] }),
      countDocuments: async () => expiredCount,
      createIndex: async (key, options) => {
        writes.push(["index", name, options.name]);
        collections.get(name).push({ key, ...options });
      },
    }),
  };
}

test("production target requires independent exact Atlas host and database confirmation", () => {
  const identity = assertProductionTarget(uri, env);
  assert.deepEqual(identity, { host, database: "arunthai" });
  assert.doesNotThrow(() => assertConnectedProductionTarget({ options: { srvHost: host } },
    { databaseName: "arunthai" }, identity));
  assert.throws(() => assertConnectedProductionTarget({ options: { srvHost: "other.mongodb.net" } },
    { databaseName: "arunthai" }, identity));
  assert.throws(() => assertProductionTarget(uri, { ...env, NODE_ENV: "development" }));
  assert.throws(() => assertProductionTarget(uri, { ...env, NODE_TLS_REJECT_UNAUTHORIZED: "0" }));
  assert.throws(() => assertProductionTarget(uri, { ...env, PRODUCTION_MONGO_EXPECTED_HOST: undefined }));
  assert.throws(() => assertProductionTarget(uri, { ...env, PRODUCTION_MONGO_EXPECTED_HOST: "other.mongodb.net" }));
  assert.throws(() => assertProductionTarget(uri, { ...env, QUIZ_INDEX_EXPECTED_DB: "english_kafe" }));
  assert.throws(() => assertProductionTarget("mongodb+srv://englishkafe.xhqpzdd.mongodb.net/english_kafe", env));
  assert.throws(() => assertProductionTarget(`mongodb+srv://${host}/english_kafe`, env));
  assert.throws(() => assertProductionTarget(`mongodb://${host}/arunthai`, env));
  assert.throws(() => assertProductionTarget(`${uri}?tls=false`, env));
  for (const option of ["ssl=false", "TLS=FALSE", "tlsInsecure=true",
    "tlsAllowInvalidCertificates=true", "tlsAllowInvalidHostnames=true",
    "TLSINSECURE=true", "tls=true&tls=false", "tls=true&TLSINSECURE=true",
    "%74lsInsecure=true", "tlsCAFile=/tmp/unapproved.pem"]) {
    assert.throws(() => assertProductionTarget(`${uri}?${option}`, env), option);
  }
  assert.doesNotThrow(() => assertProductionTarget(`${uri}?tls=true&ssl=true`, env));
});

test("index command is read-only by default and requires only the explicit apply flag", () => {
  assert.deepEqual(preparation.parseArgs([]), { apply: false });
  assert.deepEqual(preparation.parseArgs(["--apply"]), { apply: true });
  assert.throws(() => preparation.parseArgs(["--apply", "--apply"]));
  assert.throws(() => preparation.parseArgs(["--force"]));
});

test("dry-run plans exact required collections and indexes without writes", async () => {
  const db = fakeDatabase();
  const report = await preparation.inspect(db, {}, inspectors);
  assert.equal(report.status, "READY_FOR_ADDITIVE_APPLY");
  assert.equal(report.missingCollections.length, Object.keys(preparation.REQUIRED).length);
  assert.equal(report.missing.length, 10);
  assert.equal(report.plan.length, 17);
  assert.deepEqual(db.writes, []);
  assert.deepEqual(preparation.REQUIRED.quizcreationrequests[0].key,
    { adminId: 1, quizSetId: 1, creationRequestId: 1 });
  assert.deepEqual(preparation.REQUIRED.quizzes[0].options.partialFilterExpression,
    { contextType: "standalone", quizSet: { $type: "objectId" } });
  assert.equal(preparation.REQUIRED.standalonequizratewindows.find((item) => item.name === "standalone_quiz_rate_window_expiry")
    .options.expireAfterSeconds, 0);
});

test("additive preparation is idempotent and retains unrelated indexes", async () => {
  const db = fakeDatabase({ quizzes: [{ name: "legacy_quiz_index", key: { title: 1 }, unique: true }] });
  const first = await preparation.inspect(db, {}, inspectors);
  const result = await preparation.apply(db, {}, first, inspectors);
  assert.equal(result.status, "INDEXES_READY");
  assert.equal(result.created.length, 16);
  assert.ok(db.collections.get("quizzes").some((index) => index.name === "legacy_quiz_index"));
  const repeat = await preparation.inspect(db, {}, inspectors);
  assert.equal(repeat.status, "INDEXES_READY");
  assert.deepEqual((await preparation.apply(db, {}, repeat, inspectors)).created, []);
  assert.equal(db.writes.length, 16);
});

test("wrong index definition or unique-key duplicates stop before any mutation", async () => {
  const expected = preparation.REQUIRED.quizsessions[0];
  const db = fakeDatabase({ quizsessions: [{ name: expected.name, key: expected.key,
    expireAfterSeconds: 60 }] });
  const conflict = await preparation.inspect(db, {}, inspectors);
  assert.equal(conflict.status, "BLOCKED_FOR_REVIEW");
  assert.deepEqual(conflict.conflicts, [{ collection: "quizsessions", name: expected.name }]);
  await assert.rejects(preparation.apply(db, {}, conflict, inspectors));
  assert.deepEqual(db.writes, []);

  const duplicates = fakeDatabase({ quizattempts: [] }, 1);
  const report = await preparation.inspect(duplicates, {}, inspectors);
  assert.equal(report.status, "BLOCKED_FOR_REVIEW");
  assert.ok(report.duplicates.some(({ collection }) => collection === "quizattempts"));
  assert.deepEqual(duplicates.writes, []);
});

test("an existing cover ownership collection without its default identity index blocks preparation", async () => {
  const db = fakeDatabase({ quizsetcoverassets: [] });
  db.collections.set("quizsetcoverassets", []);
  const report = await preparation.inspect(db, {}, inspectors);
  assert.equal(report.status, "BLOCKED_FOR_REVIEW");
  assert.ok(report.conflicts.some(({ collection, name }) =>
    collection === "quizsetcoverassets" && name === "_id_"));
  assert.deepEqual(db.writes, []);
});

test("integrity or transaction-readiness failures block additive preparation", async () => {
  const db = fakeDatabase();
  const blocked = await preparation.inspect(db, {}, {
    ...inspectors, setInspector: async () => ({ membership: { orphaned: 1 } }),
  });
  assert.equal(blocked.status, "BLOCKED_FOR_REVIEW");
  const noTransactions = await preparation.inspect(db, {}, { ...inspectors, transactionCheck: async () => false });
  assert.equal(noTransactions.status, "BLOCKED_FOR_REVIEW");
  assert.deepEqual(db.writes, []);
});

test("missing TTL indexes disclose expired records and block apply", async () => {
  const safe = fakeDatabase({ standalonequizratewindows: [] });
  const safePlan = await preparation.inspect(safe, {}, inspectors);
  assert.equal(safePlan.status, "READY_FOR_ADDITIVE_APPLY");
  assert.ok(safePlan.ttlRisks.some(({ collection, expiredDocuments }) =>
    collection === "standalonequizratewindows" && expiredDocuments === 0));

  const expired = fakeDatabase({ standalonequizratewindows: [] }, 0, 3);
  const blocked = await preparation.inspect(expired, {}, inspectors);
  assert.equal(blocked.status, "BLOCKED_FOR_REVIEW");
  assert.ok(blocked.ttlRisks.some(({ collection, expiredDocuments }) =>
    collection === "standalonequizratewindows" && expiredDocuments === 3));
  await assert.rejects(preparation.apply(expired, {}, blocked, inspectors));
  assert.deepEqual(expired.writes, []);

  expired.collection = () => ({ listIndexes: () => ({ toArray: async () => [] }),
    aggregate: () => ({ toArray: async () => [] }),
    countDocuments: async () => { throw new Error("count unavailable"); } });
  await assert.rejects(preparation.inspect(expired, {}, inspectors), /count unavailable/);
});

test("TTL expiry appearing after planning stops immediately before index creation", async () => {
  const initial = Object.fromEntries(Object.entries(preparation.REQUIRED).map(([collection, specs]) =>
    [collection, specs.filter((spec) => spec.name !== "standalone_quiz_rate_window_expiry")
      .map((spec) => ({ key: spec.key, ...spec.options, name: spec.name }))]));
  const db = fakeDatabase(initial);
  let counts = 0;
  const collection = db.collection;
  db.collection = (name) => ({ ...collection(name),
    countDocuments: async () => name === "standalonequizratewindows" && ++counts === 3 ? 1 : 0 });
  const plan = await preparation.inspect(db, {}, inspectors);
  assert.equal(plan.status, "READY_FOR_ADDITIVE_APPLY");
  const result = await preparation.apply(db, {}, plan, inspectors);
  assert.equal(result.status, "APPLY_INCOMPLETE");
  assert.deepEqual(result.failedOperation, { action: "createIndex",
    collection: "standalonequizratewindows", name: "standalone_quiz_rate_window_expiry" });
  assert.deepEqual(db.writes, []);
});

test("mid-apply failure reports completed operations and never claims success", async () => {
  const db = fakeDatabase();
  const plan = await preparation.inspect(db, {}, inspectors);
  const create = db.createCollection;
  db.createCollection = async (name) => {
    if (db.writes.length === 1) throw Object.assign(new Error("injected"), { code: "TEST_FAILURE" });
    return create(name);
  };
  const result = await preparation.apply(db, {}, plan, inspectors);
  assert.equal(result.status, "APPLY_INCOMPLETE");
  assert.deepEqual(result.created, [plan.plan[0]]);
  assert.deepEqual(result.failedOperation, plan.plan[1]);
  assert.equal(result.failure.code, "TEST_FAILURE");
  assert.equal(result.afterFailure.status, "READY_FOR_ADDITIVE_APPLY");
});
