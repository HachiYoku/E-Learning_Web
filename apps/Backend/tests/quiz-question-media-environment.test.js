const assert = require("node:assert/strict");
const { test, mock } = require("node:test");
const cloudinary = require("../config/cloudinary");
const { resolveQuestionMediaEnvironment, publicIdFor, ownedMediaUrl } = require("../services/quizQuestionMediaEnvironment");

const base = { NODE_ENV: "test", QUIZ_QUESTION_MEDIA_ENV: "testing",
  MONGO_DB: "mongodb+srv://englishkafe.xhqpzdd.mongodb.net/english_kafe",
  STANDALONE_QUIZ_EXPECTED_DB: "english_kafe", CLOUDINARY_CLOUD_NAME: "du6lhdq8t",
  CLOUDINARY_API_KEY: "x", CLOUDINARY_API_SECRET: "x" };

test("testing and production question media use distinct server-owned public ID paths", (t) => {
  t.mock.method(cloudinary, "config", () => ({ cloud_name: "du6lhdq8t" }));
  const testing = resolveQuestionMediaEnvironment(base);
  const production = resolveQuestionMediaEnvironment({ ...base, NODE_ENV: "production",
    QUIZ_QUESTION_MEDIA_ENV: "production", MONGO_DB: "mongodb+srv://production.example.test/app_data",
    STANDALONE_QUIZ_EXPECTED_DB: "app_data" });
  assert.equal(publicIdFor(testing, "image", "record-id"), "arun_thai/testing/quiz_media/images/record-id");
  assert.equal(publicIdFor(production, "audio", "record-id"), "arun_thai/production/quiz_media/audio/record-id");
  assert.notEqual(publicIdFor(testing, "image", "record-id"), publicIdFor(production, "image", "record-id"));
});

test("missing, invalid, or inconsistent identity refuses question media", (t) => {
  t.mock.method(cloudinary, "config", () => ({ cloud_name: "du6lhdq8t" }));
  for (const env of [
    { ...base, QUIZ_QUESTION_MEDIA_ENV: undefined },
    { ...base, QUIZ_QUESTION_MEDIA_ENV: "staging" },
    { ...base, NODE_ENV: "production" },
    { ...base, MONGO_DB: "mongodb+srv://production.example.test/english_kafe" },
    { ...base, STANDALONE_QUIZ_EXPECTED_DB: "different" },
    { ...base, CLOUDINARY_CLOUD_NAME: "different" },
  ]) assert.throws(() => resolveQuestionMediaEnvironment(env));
});

test("ownership URL must identify the configured cloud, resource, and exact public ID", (t) => {
  t.mock.method(cloudinary, "config", () => ({ cloud_name: "du6lhdq8t" }));
  const identity = resolveQuestionMediaEnvironment(base);
  const publicId = publicIdFor(identity, "audio", "record-id");
  assert.equal(ownedMediaUrl(`https://res.cloudinary.com/du6lhdq8t/video/upload/v123/${publicId}.mp3`,
    identity, publicId, "video"), true);
  for (const url of [
    `https://res.cloudinary.com/other/video/upload/${publicId}.mp3`,
    `https://res.cloudinary.com/du6lhdq8t/image/upload/${publicId}.mp3`,
    `https://res.cloudinary.com/du6lhdq8t/video/upload/${publicId}-other.mp3`,
    `https://res.cloudinary.com/du6lhdq8t/video/upload/${publicId}.mp3?token=example`,
  ]) assert.equal(ownedMediaUrl(url, identity, publicId, "video"), false);
});
