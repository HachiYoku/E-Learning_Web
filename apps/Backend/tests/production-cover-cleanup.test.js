const assert = require("node:assert/strict");
const { test, mock } = require("node:test");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const CoverAsset = require("../models/quizSetCoverAssetModel");
const QuizSet = require("../models/quizSetModel");
const covers = require("../services/quizSetCoverService");
const command = require("../scripts/retryQuizSetCoverCleanup");

const host = "arunthai.abcde.mongodb.net";
const env = { NODE_ENV: "production", QUIZ_SET_COVER_ENV: "production",
  MONGO_DB: `mongodb+srv://mock:mock@${host}/arunthai`,
  PRODUCTION_MONGO_EXPECTED_HOST: host, STANDALONE_QUIZ_EXPECTED_DB: "arunthai",
  CLOUDINARY_CLOUD_NAME: "du6lhdq8t", CLOUDINARY_API_KEY: "mock-key", CLOUDINARY_API_SECRET: "mock-secret" };
const asset = () => {
  const _id = new mongoose.Types.ObjectId();
  return { _id, quizSet: new mongoose.Types.ObjectId(), environment: "production",
    publicId: `arun_thai/quiz_set_covers/${_id}`, state: "cleanup_pending",
    cleanupReason: "replaced", cleanupAttempts: 0,
    url: `https://res.cloudinary.com/du6lhdq8t/image/upload/v1/arun_thai/quiz_set_covers/${_id}.jpg` };
};

test("production cleanup requires an explicit mode, independent host, database and shared cloud", () => {
  assert.deepEqual(command.options(["--production"]), { production: true, execute: false, limit: 20 });
  assert.deepEqual(command.options(["--production", "--execute", "--limit=1"]),
    { production: true, execute: true, limit: 1 });
  assert.equal(command.assertProductionCleanupTarget(env.MONGO_DB, env).folder, "arun_thai/quiz_set_covers");
  assert.doesNotThrow(() => command.assertConfiguredCloud(command.assertProductionCleanupTarget(env.MONGO_DB, env), "du6lhdq8t"));
  assert.throws(() => command.assertConfiguredCloud(command.assertProductionCleanupTarget(env.MONGO_DB, env), "other"));
  assert.throws(() => command.assertProductionCleanupTarget(env.MONGO_DB,
    { ...env, PRODUCTION_MONGO_EXPECTED_HOST: undefined }));
  assert.throws(() => command.assertProductionCleanupTarget(env.MONGO_DB,
    { ...env, QUIZ_SET_COVER_ENV: "testing" }));
  assert.throws(() => command.assertProductionCleanupTarget(env.MONGO_DB,
    { ...env, CLOUDINARY_CLOUD_NAME: "other" }));
  assert.throws(() => command.assertProductionCleanupTarget(
    "mongodb+srv://mock:mock@englishkafe.xhqpzdd.mongodb.net/english_kafe", env));
  assert.throws(() => command.assertTestingTarget(env.MONGO_DB, env));
});

test("production dry-run is bounded, filters processing records and makes no mutations", async () => {
  const pending = asset();
  const methods = [
    mock.method(CoverAsset, "aggregate", async (pipeline) => {
      assert.equal(pipeline[0].$match.environment, "production");
      assert.equal(pipeline.at(-2).$limit, 1);
      assert.ok(!JSON.stringify(pipeline[0]).includes("cleanup_processing"));
      return [pending];
    }),
    mock.method(CoverAsset, "findOneAndUpdate", async () => { throw new Error("dry-run claimed an asset"); }),
    mock.method(cloudinary.uploader, "destroy", async () => { throw new Error("dry-run deleted an asset"); }),
  ];
  try {
    assert.deepEqual(await covers.retryCoverCleanup({ limit: 1, env }),
      { mode: "dry-run", candidates: 1, attempted: 0, deleted: 0, skipped: 0, failed: 0 });
    assert.equal(methods[1].mock.calls.length, 0);
    assert.equal(methods[2].mock.calls.length, 0);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test("production cannot delete testing, legacy or interrupted ownership", async () => {
  const owned = asset();
  const claim = mock.method(CoverAsset, "findOneAndUpdate", async () => { throw new Error("unsafe claim"); });
  const configured = mock.method(cloudinary, "config", () => ({ cloud_name: "du6lhdq8t" }));
  try {
    assert.equal(await covers.cleanupCoverAsset({ ...owned, environment: "testing" }, { env }), false);
    assert.equal(await covers.cleanupCoverAsset({ ...owned,
      publicId: `arun_thai/testing/quiz_set_covers/${owned._id}` }, { env }), false);
    assert.equal(await covers.cleanupCoverAsset({ ...owned, publicId: "legacy/unknown" }, { env }), false);
    assert.equal(await covers.cleanupCoverAsset({ ...owned, state: "cleanup_processing" }, { env }), false);
    assert.equal(claim.mock.calls.length, 0);
  } finally { claim.mock.restore(); configured.mock.restore(); }
});

test("production reference recheck protects current or cross-Set cover", async () => {
  const owned = asset();
  const methods = [
    mock.method(cloudinary, "config", () => ({ cloud_name: "du6lhdq8t" })),
    mock.method(CoverAsset, "findOneAndUpdate", async () => owned),
    mock.method(QuizSet, "exists", async (query) => {
      assert.deepEqual(query.$or[0], { coverAsset: owned._id });
      assert.deepEqual(query.$or[1], { coverImage: { $regex: String(owned._id), $options: "i" } });
      return { _id: new mongoose.Types.ObjectId() };
    }),
    mock.method(CoverAsset, "updateOne", async (_filter, update) => {
      assert.equal(update.$set.cleanupOutcome, "referenced");
    }),
    mock.method(cloudinary.uploader, "destroy", async () => { throw new Error("referenced asset deleted"); }),
  ];
  try {
    assert.equal(await covers.cleanupCoverAsset(owned, { env }), false);
    assert.equal(methods[4].mock.calls.length, 0);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test("transformed, alternate-format and legacy URL-only Set references block deletion", async () => {
  const owned = asset();
  const legacyUrls = [
    `https://res.cloudinary.com/du6lhdq8t/image/upload/c_fill,w_400/v3/${owned.publicId}.webp`,
    `https://res.cloudinary.com/du6lhdq8t/image/upload/f_auto/v3/${owned.publicId}.png`,
    `https://res.cloudinary.com/du6lhdq8t/image/upload/v8/${owned.publicId}.jpg`,
  ];
  let currentUrl;
  const methods = [
    mock.method(cloudinary, "config", () => ({ cloud_name: "du6lhdq8t" })),
    mock.method(CoverAsset, "findOneAndUpdate", async () => owned),
    mock.method(CoverAsset, "updateOne", async (_filter, update) => {
      assert.equal(update.$set.cleanupOutcome, "referenced");
    }),
    mock.method(QuizSet, "exists", async (query) => {
      assert.deepEqual(query.$or[0], { coverAsset: owned._id });
      const { $regex, $options } = query.$or[1].coverImage;
      return new RegExp($regex, $options).test(currentUrl);
    }),
    mock.method(cloudinary.uploader, "destroy", async () => { throw new Error("referenced asset deleted"); }),
  ];
  try {
    for (const url of legacyUrls) {
      currentUrl = url;
      assert.equal(await covers.cleanupCoverAsset(owned, { env }), false);
    }
    assert.equal(methods[4].mock.calls.length, 0);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test("missing or mismatched ownership URL cannot be claimed or deleted", async () => {
  const owned = asset();
  const claim = mock.method(CoverAsset, "findOneAndUpdate", async () => { throw new Error("unsafe claim"); });
  const destroy = mock.method(cloudinary.uploader, "destroy", async () => { throw new Error("unsafe delete"); });
  const configured = mock.method(cloudinary, "config", () => ({ cloud_name: "du6lhdq8t" }));
  try {
    for (const url of [undefined, "", "https://res.cloudinary.com/other/image/upload/v1/" + owned.publicId,
      "https://res.cloudinary.com/du6lhdq8t/image/upload/v1/arun_thai/testing/quiz_set_covers/" + owned._id]) {
      assert.equal(await covers.cleanupCoverAsset({ ...owned, url }, { env }), false);
    }
    assert.equal(claim.mock.calls.length, 0);
    assert.equal(destroy.mock.calls.length, 0);
  } finally { claim.mock.restore(); destroy.mock.restore(); configured.mock.restore(); }
});
