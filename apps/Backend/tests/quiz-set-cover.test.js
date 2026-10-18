const assert = require('node:assert/strict');
const { test, mock, before, after } = require('node:test');
const { Writable } = require('node:stream');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const QuizSet = require('../models/quizSetModel');
const CoverAsset = require('../models/quizSetCoverAssetModel');
const covers = require('../services/quizSetCoverService');
const sets = require('../services/standaloneQuizSets');
const { resolveCoverEnvironment, TESTING_FOLDER, PRODUCTION_FOLDER } = require('../services/quizSetCoverEnvironment');

const env = { QUIZ_SET_COVER_ENV: 'testing', NODE_ENV: 'test',
  MONGO_DB: 'mongodb+srv://example:example@englishkafe.xhqpzdd.mongodb.net/english_kafe',
  STANDALONE_QUIZ_EXPECTED_DB: 'english_kafe', CLOUDINARY_CLOUD_NAME: 'du6lhdq8t',
  CLOUDINARY_API_KEY: 'mock-key', CLOUDINARY_API_SECRET: 'mock-secret' };
const productionEnv = { ...env, QUIZ_SET_COVER_ENV: 'production', NODE_ENV: 'production',
  MONGO_DB: 'mongodb+srv://example:example@production.example/arunthai',
  STANDALONE_QUIZ_EXPECTED_DB: 'arunthai' };

const setId = new mongoose.Types.ObjectId();
const ownedUrl = (asset, cloud = 'du6lhdq8t') =>
  `https://res.cloudinary.com/${cloud}/image/upload/v1/${asset.publicId}.jpg`;
const baseSet = () => ({ _id: setId, version: 1, coverImage: '', coverAsset: null });
const image = { buffer: Buffer.from([0xff, 0xd8, 0xff]) };
let configuredCloud = 'du6lhdq8t';
let cloudConfig;
before(() => { cloudConfig = mock.method(cloudinary, 'config', () => ({ cloud_name: configuredCloud })); });
after(() => cloudConfig?.mock.restore());

function providerUpload({ fail = false } = {}) {
  return mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => new Writable({
    write(_chunk, _encoding, done) { done(); },
    final(done) {
      if (fail) callback(new Error('provider unavailable'));
      else callback(null, { public_id: `${options.folder}/${options.public_id}`,
        secure_url: `https://res.cloudinary.com/test/image/upload/v1/${options.folder}/${options.public_id}.jpg`, resource_type: 'image' });
      done();
    },
  }));
}

test('owned upload reserves before Cloudinary, then attaches with a version guard', async () => {
  const order = [];
  const set = baseSet();
  const methods = [
    mock.method(QuizSet, 'findById', async () => set),
    mock.method(CoverAsset, 'create', async (record) => { order.push('reserve'); return record; }),
    mock.method(CoverAsset, 'updateOne', async () => ({ matchedCount: 1 })),
    mock.method(QuizSet, 'findOneAndUpdate', async (filter, update) => {
      order.push('attach');
      assert.equal(filter.version, 1);
      assert.equal(filter._id, setId);
      assert.equal(update.$inc.version, 1);
      return { ...set, ...update.$set, version: 2 };
    }),
    providerUpload(),
  ];
  try {
    const result = await covers.uploadCover(setId, 1, image, { env });
    assert.equal(result.set.version, 2);
    assert.match(result.set.coverImage, /^https:\/\/res\.cloudinary\.com\/test\/image\/upload\//);
    assert.deepEqual(order, ['reserve', 'attach']);
    assert.equal(methods[1].mock.calls[0].arguments[0].environment, 'testing');
    assert.match(methods[1].mock.calls[0].arguments[0].publicId, new RegExp(`^${TESTING_FOLDER}/`));
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('conflict or provider failure never attaches a cover and retains a reservation', async () => {
  let reservations = 0;
  let attachments = 0;
  const methods = [
    mock.method(QuizSet, 'findById', async () => baseSet()),
    mock.method(CoverAsset, 'create', async (record) => { reservations += 1; return record; }),
    mock.method(CoverAsset, 'updateOne', async () => ({ matchedCount: 1 })),
    mock.method(QuizSet, 'findOneAndUpdate', async () => { attachments += 1; return null; }),
    providerUpload(),
  ];
  try {
    await assert.rejects(covers.uploadCover(setId, 1, image, { env }), { code: 'stale_quiz_set' });
    assert.equal(reservations, 1);
    assert.equal(attachments, 1);
    methods.at(-1).mock.restore();
    methods[methods.length - 1] = providerUpload({ fail: true });
    await assert.rejects(covers.uploadCover(setId, 1, image, { env }), { code: 'cover_upload_uncertain' });
    assert.equal(reservations, 2);
    assert.equal(attachments, 1);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('removal keeps legacy URLs out of Cloudinary deletion', async () => {
  const set = { ...baseSet(), coverImage: 'https://res.cloudinary.com/legacy/image/upload/old.jpg' };
  const methods = [
    mock.method(QuizSet, 'findById', async () => set),
    mock.method(QuizSet, 'findOneAndUpdate', async (_filter, update) => ({ ...set, ...update.$set, version: 2 })),
    mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('must not delete legacy URL'); }),
  ];
  try {
    const result = await covers.removeCover(setId, 1, { env });
    assert.equal(result.set.coverImage, '');
    assert.equal(result.cleanup, 'complete');
    assert.equal(methods[2].mock.calls.length, 0);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('replacement cleanup checks references and preserves a retry record on provider failure', async () => {
  const asset = { _id: new mongoose.Types.ObjectId(), quizSet: setId,
    url: 'https://res.cloudinary.com/test/image/upload/old.jpg', state: 'active', abandonAfter: new Date(0) };
  asset.environment = 'testing';
  asset.publicId = `${TESTING_FOLDER}/${asset._id}`;
  asset.url = ownedUrl(asset);
  const methods = [
    mock.method(QuizSet, 'exists', async () => false),
    mock.method(CoverAsset, 'findOneAndUpdate', async () => asset),
    mock.method(CoverAsset, 'updateOne', async (_filter, update) => {
      assert.equal(update.$set.state, 'cleanup_pending'); return { matchedCount: 1 };
    }),
    mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('provider unavailable'); }),
  ];
  try { assert.equal(await covers.cleanupCoverAsset(asset, { env }), false); }
  finally { methods.forEach((method) => method.mock.restore()); }
});

test('abandoned cover waits seven days and cannot delete a referenced asset', async () => {
  const asset = { _id: new mongoose.Types.ObjectId(), quizSet: setId,
    url: 'https://res.cloudinary.com/test/image/upload/owned.jpg', state: 'available',
    abandonAfter: new Date('2030-01-08') };
  asset.environment = 'testing';
  asset.publicId = `${TESTING_FOLDER}/${asset._id}`;
  asset.url = ownedUrl(asset);
  const methods = [
    mock.method(CoverAsset, 'findOneAndUpdate', async () => asset),
    mock.method(CoverAsset, 'updateOne', async () => ({ matchedCount: 1 })),
    mock.method(QuizSet, 'exists', async (filter) => {
      assert.deepEqual(filter.$or[0], { coverAsset: asset._id });
      assert.deepEqual(filter.$or[1], { coverImage: { $regex: String(asset._id), $options: 'i' } });
      return true; // A different Set may still reference the asset URL.
    }),
    mock.method(cloudinary.uploader, 'destroy', async () => ({ result: 'ok' })),
  ];
  try {
    assert.equal(await covers.cleanupCoverAsset(asset, { abandoned: true, now: new Date('2030-01-07'), env }), false);
    assert.equal(await covers.cleanupCoverAsset(asset, { abandoned: true, now: new Date('2030-01-09'), env }), false);
    assert.equal(methods[3].mock.calls.length, 0);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('an unreferenced abandoned cover is eligible after seven days', async () => {
  const asset = { _id: new mongoose.Types.ObjectId(), quizSet: setId,
    url: 'https://res.cloudinary.com/test/image/upload/owned.jpg', state: 'available',
    abandonAfter: new Date('2030-01-08') };
  asset.environment = 'testing';
  asset.publicId = `${TESTING_FOLDER}/${asset._id}`;
  asset.url = ownedUrl(asset);
  const methods = [
    mock.method(QuizSet, 'exists', async () => false),
    mock.method(CoverAsset, 'findOneAndUpdate', async () => asset),
    mock.method(CoverAsset, 'updateOne', async (_filter, update) => {
      assert.equal(update.$set.state, 'deleted'); return { matchedCount: 1 };
    }),
    mock.method(cloudinary.uploader, 'destroy', async (publicId) => {
      assert.equal(publicId, asset.publicId); return { result: 'ok' };
    }),
  ];
  try {
    assert.equal(await covers.cleanupCoverAsset(asset, { abandoned: true, now: new Date('2030-01-09'), env }), true);
    assert.equal(methods[3].mock.calls.length, 1);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('ordinary Set creation rejects client-supplied cover URLs', async () => {
  await assert.rejects(sets.createSet({ name: 'Thai', coverImage: 'https://res.cloudinary.com/other/image/upload/a.jpg' }),
    { code: 'invalid_quiz_set' });
});

function owned(state = 'cleanup_pending', extras = {}) {
  const _id = new mongoose.Types.ObjectId();
  const publicId = `${TESTING_FOLDER}/${_id}`;
  return { _id, quizSet: setId, environment: 'testing', publicId,
    url: `https://res.cloudinary.com/du6lhdq8t/image/upload/v1/${publicId}.jpg`,
    state, abandonAfter: new Date('2020-01-01'), cleanupAttempts: 0, ...extras };
}

test('a mismatched configured Cloudinary cloud prevents Set handoff and provider deletion', async () => {
  const asset = owned();
  const claim = mock.method(CoverAsset, 'findOneAndUpdate', async () => { throw new Error('must not claim'); });
  const destroy = mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('must not delete'); });
  configuredCloud = 'different-cloud';
  try {
    await assert.rejects(covers.queueSetCoverDeletion({ _id: setId, coverAsset: asset._id }, {}, { env }),
      { code: 'quiz_set_cover_unverified' });
    assert.equal(await covers.cleanupCoverAsset(asset, { env }), false);
    assert.equal(claim.mock.calls.length, 0);
    assert.equal(destroy.mock.calls.length, 0);
  } finally { configuredCloud = 'du6lhdq8t'; claim.mock.restore(); destroy.mock.restore(); }
});

test('dry-run is bounded and never claims, mutates, or deletes', async () => {
  const methods = [
    mock.method(CoverAsset, 'aggregate', async (pipeline) => {
      assert.equal(pipeline[0].$match.environment, 'testing');
      assert.deepEqual(pipeline[0].$match.$or[2].state.$in, ['reserved', 'available']);
      assert.equal(pipeline[0].$match.$or[1].cleanupReason, 'abandoned');
      assert.equal(pipeline.find((step) => step.$limit)?.$limit, 2);
      assert.ok(pipeline.find((step) => step.$lookup));
      return [owned()];
    }),
    mock.method(CoverAsset, 'findOneAndUpdate', async () => { throw new Error('claim in dry-run'); }),
    mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('delete in dry-run'); }),
  ];
  try {
    assert.deepEqual(await covers.retryCoverCleanup({ limit: 2, env }),
      { mode: 'dry-run', candidates: 1, attempted: 0, deleted: 0, skipped: 0, failed: 0 });
    assert.equal(methods[1].mock.calls.length, 0);
    assert.equal(methods[2].mock.calls.length, 0);
    await assert.rejects(covers.retryCoverCleanup({ limit: 101, env }), { code: 'invalid_quiz_set_cover' });
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('pending retry claims atomically and treats provider not-found as idempotent success', async () => {
  const asset = owned();
  let latest = { cleanupAttempts: 1, cleanupOutcome: 'not found' };
  const methods = [
    mock.method(CoverAsset, 'aggregate', async () => [asset]),
    mock.method(CoverAsset, 'findOneAndUpdate', async (filter, update) => {
      assert.equal(filter.state, 'cleanup_pending');
      assert.equal(update.$set.state, 'cleanup_processing');
      return asset;
    }),
    mock.method(CoverAsset, 'findById', () => ({ select: () => ({ lean: async () => latest }) })),
    mock.method(CoverAsset, 'updateOne', async (_filter, update) => { assert.equal(update.$set.state, 'deleted'); return { matchedCount: 1 }; }),
    mock.method(QuizSet, 'exists', async () => false),
    mock.method(cloudinary.uploader, 'destroy', async () => ({ result: 'not found' })),
  ];
  try {
    const result = await covers.retryCoverCleanup({ execute: true, env });
    assert.deepEqual(result, { mode: 'execute', candidates: 1, attempted: 1, deleted: 1, skipped: 0, failed: 0 });
    assert.equal(methods[5].mock.calls.length, 1);
    latest = { cleanupAttempts: 1, cleanupOutcome: 'not found' };
    methods[0].mock.mockImplementation(async () => []);
    assert.equal((await covers.retryCoverCleanup({ execute: true, env })).deleted, 0);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('operator retry records a provider failure and leaves the asset retryable', async () => {
  const asset = owned();
  const methods = [
    mock.method(CoverAsset, 'aggregate', async () => [asset]),
    mock.method(CoverAsset, 'findOneAndUpdate', async () => asset),
    mock.method(CoverAsset, 'findById', () => ({ select: () => ({ lean: async () =>
      ({ cleanupAttempts: 1, cleanupOutcome: 'failed' }) }) })),
    mock.method(CoverAsset, 'updateOne', async (_filter, update) => {
      assert.equal(update.$set.state, 'cleanup_pending'); return { matchedCount: 1 };
    }),
    mock.method(QuizSet, 'exists', async () => false),
    mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('unavailable'); }),
  ];
  try {
    assert.deepEqual(await covers.retryCoverCleanup({ execute: true, env }),
      { mode: 'execute', candidates: 1, attempted: 1, deleted: 0, skipped: 0, failed: 1 });
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('concurrent claim loser and active or cross-Set references cannot delete', async () => {
  const asset = owned('cleanup_pending');
  let claimed = false;
  let referenced = false;
  const methods = [
    mock.method(CoverAsset, 'findOneAndUpdate', async () => {
      if (claimed) return null;
      claimed = true;
      return asset;
    }),
    mock.method(CoverAsset, 'updateOne', async (_filter, update) => {
      assert.equal(update.$set.cleanupOutcome, 'referenced'); return { matchedCount: 1 };
    }),
    mock.method(QuizSet, 'exists', async (filter) => {
      assert.deepEqual(filter.$or[1], { coverImage: { $regex: String(asset._id), $options: 'i' } });
      return referenced;
    }),
    mock.method(cloudinary.uploader, 'destroy', async () => ({ result: 'ok' })),
  ];
  try {
    referenced = true; // Reference may belong to another Set.
    assert.equal(await covers.cleanupCoverAsset(asset, { env }), false);
    assert.equal(await covers.cleanupCoverAsset(asset, { env }), false);
    assert.equal(methods[3].mock.calls.length, 0);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('cross-Set ownership mismatch fails its atomic claim before provider deletion', async () => {
  const asset = owned();
  const otherSet = new mongoose.Types.ObjectId();
  const methods = [
    mock.method(CoverAsset, 'findOneAndUpdate', async (filter) => {
      assert.equal(filter.quizSet, asset.quizSet);
      assert.notEqual(filter.quizSet, otherSet);
      return null; // Persisted ownership belongs to another Set.
    }),
    mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('must not delete'); }),
  ];
  try {
    assert.equal(await covers.cleanupCoverAsset(asset, { env }), false);
    assert.equal(methods[1].mock.calls.length, 0);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('abandoned reservations wait seven days; spoofed ownership cannot claim', async () => {
  const reservation = owned('reserved', { abandonAfter: new Date('2030-01-08') });
  const claim = mock.method(CoverAsset, 'findOneAndUpdate', async () => reservation);
  try {
    assert.equal(await covers.cleanupCoverAsset(reservation, { abandoned: true, now: new Date('2030-01-07'), env }), false);
    assert.equal(await covers.cleanupCoverAsset({ ...reservation, publicId: 'legacy' }, { env }), false);
    assert.equal(claim.mock.calls.length, 0);
  } finally { claim.mock.restore(); }
});

test('operator command requires explicit execution and the approved testing target', () => {
  const command = require('../scripts/retryQuizSetCoverCleanup');
  assert.deepEqual(command.options([]), { execute: false, limit: 20, production: false });
  assert.deepEqual(command.options(['--execute', '--limit=1']), { execute: true, limit: 1, production: false });
  assert.throws(() => command.options(['--limit=101']));
  assert.doesNotThrow(() => command.assertTestingTarget(env.MONGO_DB, env));
  assert.doesNotThrow(() => command.assertConfiguredCloud(command.assertTestingTarget(env.MONGO_DB, env), 'du6lhdq8t'));
  assert.throws(() => command.assertConfiguredCloud(command.assertTestingTarget(env.MONGO_DB, env), 'other'));
  assert.throws(() => command.assertTestingTarget('mongodb+srv://user:pass@production.example/english_kafe', env));
  assert.throws(() => command.assertTestingTarget(env.MONGO_DB, { ...env, CLOUDINARY_CLOUD_NAME: 'other' }));
  assert.throws(() => command.assertTestingTarget(env.MONGO_DB, productionEnv));
});

test('cover namespace requires an explicit consistent environment and database guard', () => {
  assert.equal(resolveCoverEnvironment(env).folder, TESTING_FOLDER);
  assert.equal(resolveCoverEnvironment(productionEnv).folder, PRODUCTION_FOLDER);
  assert.throws(() => resolveCoverEnvironment({ ...env, QUIZ_SET_COVER_ENV: undefined }));
  assert.throws(() => resolveCoverEnvironment({ ...env, NODE_ENV: 'production' }));
  assert.throws(() => resolveCoverEnvironment({ ...productionEnv, NODE_ENV: 'test' }));
  assert.throws(() => resolveCoverEnvironment({ ...env, STANDALONE_QUIZ_EXPECTED_DB: 'other' }));
  assert.throws(() => resolveCoverEnvironment({ ...env, MONGO_DB: 'mongodb+srv://example:example@other.example/english_kafe' }));
  assert.throws(() => resolveCoverEnvironment({ ...env, CLOUDINARY_CLOUD_NAME: 'other' }));
  assert.throws(() => resolveCoverEnvironment({ ...env, CLOUDINARY_URL: 'cloudinary://other:secret@du6lhdq8t' }));
  assert.doesNotThrow(() => resolveCoverEnvironment({ ...env, CLOUDINARY_URL: 'cloudinary://mock-key:mock-secret@du6lhdq8t' }));
  assert.throws(() => resolveCoverEnvironment({ ...productionEnv, MONGO_DB: env.MONGO_DB,
    STANDALONE_QUIZ_EXPECTED_DB: 'english_kafe' }));
  assert.throws(() => resolveCoverEnvironment({ ...productionEnv, MONGO_DB: 'mongodb+srv://example:example@production.example/english_kafe',
    STANDALONE_QUIZ_EXPECTED_DB: 'english_kafe' }));
});

test('production cover path remains unchanged; testing cannot delete a production asset', async () => {
  const productionAsset = owned('cleanup_pending', { environment: 'production' });
  productionAsset.publicId = `${PRODUCTION_FOLDER}/${productionAsset._id}`;
  const claim = mock.method(CoverAsset, 'findOneAndUpdate', async () => { throw new Error('must not claim'); });
  const destroy = mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('must not delete'); });
  try {
    assert.equal(await covers.cleanupCoverAsset(productionAsset, { env }), false);
    assert.equal(claim.mock.calls.length, 0);
    assert.equal(destroy.mock.calls.length, 0);
  } finally { claim.mock.restore(); destroy.mock.restore(); }
});

test('production upload still uses the original production cover folder', async () => {
  const methods = [
    mock.method(QuizSet, 'findById', async () => baseSet()),
    mock.method(CoverAsset, 'create', async (record) => {
      assert.equal(record.environment, 'production');
      assert.match(record.publicId, new RegExp(`^${PRODUCTION_FOLDER}/`));
      return record;
    }),
    mock.method(CoverAsset, 'updateOne', async () => ({ matchedCount: 1 })),
    mock.method(QuizSet, 'findOneAndUpdate', async (_filter, update) => ({ ...baseSet(), ...update.$set, version: 2 })),
    providerUpload(),
  ];
  try {
    const result = await covers.uploadCover(setId, 1, image, { env: productionEnv });
    assert.match(result.set.coverImage, /arun_thai\/quiz_set_covers/);
    assert.doesNotMatch(result.set.coverImage, /arun_thai\/testing/);
  } finally { methods.forEach((method) => method.mock.restore()); }
});

test('pending work is prioritized and referenced or active assets cannot occupy a bounded batch', async () => {
  const pending = owned();
  const aggregate = mock.method(CoverAsset, 'aggregate', async (pipeline) => {
    assert.equal(pipeline[0].$match.environment, 'testing');
    assert.equal(pipeline[0].$match.$or.some((item) => item.state === 'active'), false);
    assert.deepEqual(pipeline[2].$sort, { cleanupPriority: 1, _id: 1 });
    assert.equal(pipeline[4].$match.references.$size, 0);
    assert.equal(pipeline[5].$limit, 1);
    return [pending];
  });
  try {
    assert.equal((await covers.retryCoverCleanup({ limit: 1, env })).candidates, 1);
  } finally { aggregate.mock.restore(); }
});
