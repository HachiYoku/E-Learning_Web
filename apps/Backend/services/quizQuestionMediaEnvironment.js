const cloudinary = require("../config/cloudinary");
const { TESTING_HOST, TESTING_DB, TESTING_CLOUD } = require("./quizSetCoverEnvironment");

const FOLDERS = Object.freeze({
  testing: "arun_thai/testing/quiz_media",
  production: "arun_thai/production/quiz_media",
});

function resolveQuestionMediaEnvironment(env = process.env) {
  const mode = env.QUIZ_QUESTION_MEDIA_ENV;
  if (!Object.hasOwn(FOLDERS, mode)) throw new Error("Question media environment is not configured.");
  if ((mode === "production") !== (env.NODE_ENV === "production")) {
    throw new Error("Question media environment does not match the runtime.");
  }
  let mongo;
  try { mongo = new URL(env.MONGO_DB); } catch { throw new Error("Question media database target is invalid."); }
  if (!["mongodb:", "mongodb+srv:"].includes(mongo.protocol) || !mongo.hostname
    || !/^\/[a-zA-Z0-9_-]+$/.test(mongo.pathname)
    || env.STANDALONE_QUIZ_EXPECTED_DB !== mongo.pathname.slice(1)) {
    throw new Error("Question media database target is invalid.");
  }
  if (mode === "testing" && (mongo.protocol !== "mongodb+srv:" || mongo.hostname !== TESTING_HOST
    || mongo.pathname.slice(1) !== TESTING_DB)) {
    throw new Error("Question media testing database is not approved.");
  }
  if (mode === "production" && (mongo.hostname === TESTING_HOST || mongo.pathname.slice(1) === TESTING_DB)) {
    throw new Error("Question media production database is not approved.");
  }
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET
    || env.CLOUDINARY_CLOUD_NAME !== TESTING_CLOUD
    || cloudinary.config().cloud_name !== env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("Question media Cloudinary account is not approved.");
  }
  if (env.CLOUDINARY_URL) {
    let configured;
    try { configured = new URL(env.CLOUDINARY_URL); } catch { throw new Error("Conflicting question media Cloudinary configuration."); }
    if (configured.protocol !== "cloudinary:" || configured.hostname !== env.CLOUDINARY_CLOUD_NAME
      || decodeURIComponent(configured.username) !== env.CLOUDINARY_API_KEY
      || decodeURIComponent(configured.password) !== env.CLOUDINARY_API_SECRET) {
      throw new Error("Conflicting question media Cloudinary configuration.");
    }
  }
  return { mode, cloudName: env.CLOUDINARY_CLOUD_NAME, folder: FOLDERS[mode] };
}

function publicIdFor(identity, mediaType, recordId) {
  return `${identity.folder}/${mediaType === "image" ? "images" : "audio"}/${recordId}`;
}

function ownedMediaUrl(url, identity, publicId, resourceType) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com" || parsed.port
      || parsed.username || parsed.password || parsed.search || parsed.hash) return false;
    const parts = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const prefix = [identity.cloudName, resourceType, "upload"];
    if (prefix.some((part, index) => parts[index] !== part)) return false;
    const suffix = publicId.split("/");
    const actual = parts.slice(-suffix.length);
    return actual.length === suffix.length
      && suffix.slice(0, -1).every((part, index) => actual[index] === part)
      && new RegExp(`^${suffix.at(-1)}\\.[a-zA-Z0-9]+$`).test(actual.at(-1));
  } catch { return false; }
}

module.exports = { resolveQuestionMediaEnvironment, publicIdFor, ownedMediaUrl };
