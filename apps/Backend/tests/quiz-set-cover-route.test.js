const assert = require('node:assert/strict');
const { before, after, test, mock } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const covers = require('../services/quizSetCoverService');
const errorHandler = require('../middleware/errorHandler');

const oldSecret = process.env.JWT_SECRET;
const users = new Map();
let server;
let base;
let userLookup;
let upload;

function token(role) {
  const id = String(new mongoose.Types.ObjectId());
  users.set(id, { _id: new mongoose.Types.ObjectId(id), role, isActive: true, isVerified: true, sessionVersion: 0 });
  return jwt.sign({ id, sessionVersion: 0 }, process.env.JWT_SECRET);
}

async function send({ auth, blob, name = 'cover.jpg' } = {}) {
  const form = new FormData();
  form.append('expectedVersion', '1');
  if (blob) form.append('cover', blob, name);
  const response = await fetch(`${base}/quizzes/admin/standalone/sets/507f1f77bcf86cd799439011/cover`, {
    method: 'POST', headers: auth ? { Authorization: `Bearer ${auth}` } : {}, body: form,
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  process.env.JWT_SECRET = 'isolated-cover-route-test-secret';
  userLookup = mock.method(User, 'findById', (id) => ({ select: async () => users.get(String(id)) || null }));
  upload = mock.method(covers, 'uploadCover', async () => ({
    set: { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), name: 'Thai',
      status: 'disabled', version: 2, displayOrder: 1, coverImage: 'https://res.cloudinary.com/test/image/upload/cover.jpg' },
    cleanup: 'complete',
  }));
  const app = express();
  app.use('/quizzes', require('../routes/quiz'));
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  userLookup?.mock.restore(); upload?.mock.restore();
  if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
});

test('cover route denies guests and non-admin accounts', async () => {
  const jpg = new Blob([Buffer.from([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
  assert.equal((await send({ blob: jpg })).status, 401);
  assert.equal((await send({ auth: token('user'), blob: jpg })).status, 403);
  assert.equal(upload.mock.calls.length, 0);
});

test('cover route accepts valid image and rejects MIME, signature, and size failures', async () => {
  const admin = token('admin');
  const jpg = new Blob([Buffer.from([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
  assert.equal((await send({ auth: admin, blob: jpg })).status, 200);
  assert.equal(upload.mock.calls.length, 1);
  assert.equal((await send({ auth: admin, blob: new Blob(['bad'], { type: 'text/plain' }), name: 'bad.txt' })).status, 400);
  assert.equal((await send({ auth: admin, blob: new Blob(['bad'], { type: 'image/png' }), name: 'bad.png' })).status, 400);
  assert.equal((await send({ auth: admin, blob: new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }) })).status, 400);
  assert.equal(upload.mock.calls.length, 1);
});

test('cover upload is limited to 20 requests per Admin account in 15 minutes', async () => {
  const admin = token('admin');
  for (let count = 0; count < 20; count += 1) assert.equal((await send({ auth: admin })).status, 200);
  assert.equal((await send({ auth: admin })).status, 429);
  assert.equal((await send({ auth: token('admin') })).status, 200);
});
