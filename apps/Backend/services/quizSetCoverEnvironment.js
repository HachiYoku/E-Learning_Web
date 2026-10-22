const TESTING_FOLDER = "arun_thai/testing/quiz_set_covers";
const PRODUCTION_FOLDER = "arun_thai/quiz_set_covers";
const TESTING_HOST = "englishkafe.xhqpzdd.mongodb.net";
const TESTING_DB = "english_kafe";
const TESTING_CLOUD = "du6lhdq8t";

function resolveCoverEnvironment(env = process.env) {
  const mode = env.QUIZ_SET_COVER_ENV;
  if (!['testing', 'production'].includes(mode)) throw new Error('Quiz Set cover environment must be explicitly configured.');
  if (mode === 'testing' && env.NODE_ENV === 'production') throw new Error('Testing covers cannot run in production mode.');
  if (mode === 'production' && env.NODE_ENV !== 'production') throw new Error('Production covers require production mode.');
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary identity and credentials must be configured for Quiz Set covers.');
  }
  if (env.CLOUDINARY_URL) {
    let cloudUrl;
    try { cloudUrl = new URL(env.CLOUDINARY_URL); } catch { throw new Error('Conflicting Cloudinary configuration.'); }
    if (cloudUrl.protocol !== 'cloudinary:' || cloudUrl.hostname !== env.CLOUDINARY_CLOUD_NAME
      || decodeURIComponent(cloudUrl.username) !== env.CLOUDINARY_API_KEY
      || decodeURIComponent(cloudUrl.password) !== env.CLOUDINARY_API_SECRET) {
      throw new Error('Conflicting Cloudinary configuration.');
    }
  }
  let mongo;
  try { mongo = new URL(env.MONGO_DB); } catch { throw new Error('Quiz Set cover database target is not configured.'); }
  if (!['mongodb:', 'mongodb+srv:'].includes(mongo.protocol) || !mongo.hostname || !/^\/[a-zA-Z0-9_-]+$/.test(mongo.pathname)) {
    throw new Error('Quiz Set cover database target is invalid.');
  }
  const database = mongo.pathname.slice(1);
  if (env.STANDALONE_QUIZ_EXPECTED_DB !== database) throw new Error('Quiz Set cover database guard does not match.');
  if (mode === 'testing' && (mongo.protocol !== 'mongodb+srv:' || mongo.hostname !== TESTING_HOST
    || database !== TESTING_DB || env.CLOUDINARY_CLOUD_NAME !== TESTING_CLOUD)) {
    throw new Error('Testing Quiz Set covers require the approved database and Cloudinary cloud.');
  }
  if (mode === 'production' && (mongo.hostname === TESTING_HOST || database === TESTING_DB)) {
    throw new Error('Production covers cannot target the testing database.');
  }
  return { mode, folder: mode === 'testing' ? TESTING_FOLDER : PRODUCTION_FOLDER,
    cloudName: env.CLOUDINARY_CLOUD_NAME, database, host: mongo.hostname };
}

module.exports = { resolveCoverEnvironment, TESTING_FOLDER, PRODUCTION_FOLDER, TESTING_HOST, TESTING_DB, TESTING_CLOUD };
