const assert = require("node:assert/strict");
const test = require("node:test");
const { replaceAvatarForUser } = require("../services/avatarReplacement");

function createUser({ avatarPublicId = "avatars/previous", avatar = "https://old.example/avatar" } = {}) {
  return {
    _id: "user-1",
    avatarPublicId,
    avatar,
    name: "Mali",
    async save() {},
  };
}

function dependenciesFor(user, overrides = {}) {
  const calls = { cleanup: [], clean: [], removed: [] };
  return {
    calls,
    dependencies: {
      upload: async () => ({ public_id: "avatars/new", secure_url: "https://new.example/avatar" }),
      transaction: async (work) => work({ id: "session-1" }),
      findUser: async () => user,
      createCleanup: async (publicId) => {
        calls.cleanup.push(publicId);
        return [{ _id: "cleanup-1" }];
      },
      clean: async (id) => {
        calls.clean.push(id);
        return { cleaned: true };
      },
      removeUncommitted: async (publicId) => calls.removed.push(publicId),
      ...overrides,
    },
  };
}

test("replacing an avatar saves the new record before queueing and cleaning the old asset", async () => {
  const user = createUser();
  const { calls, dependencies } = dependenciesFor(user);
  const result = await replaceAvatarForUser({ userId: user._id, name: "Mali Updated", buffer: Buffer.from("image") }, dependencies);

  assert.equal(user.avatarPublicId, "avatars/new");
  assert.equal(user.avatar, "https://new.example/avatar");
  assert.equal(user.name, "Mali Updated");
  assert.deepEqual(calls.cleanup, ["avatars/previous"]);
  assert.deepEqual(calls.clean, ["cleanup-1"]);
  assert.deepEqual(calls.removed, []);
  assert.equal(result.assetCleanup.cleaned, true);
});

test("replacing an avatar without a previous asset does not enqueue cleanup", async () => {
  const user = createUser({ avatarPublicId: "", avatar: "" });
  const { calls, dependencies } = dependenciesFor(user);
  const result = await replaceAvatarForUser({ userId: user._id, buffer: Buffer.from("image") }, dependencies);

  assert.deepEqual(calls.cleanup, []);
  assert.deepEqual(calls.clean, []);
  assert.equal(result.assetCleanup.cleaned, true);
});

test("a database failure retains the old avatar and removes only the uncommitted upload", async () => {
  const user = createUser();
  const { calls, dependencies } = dependenciesFor(user, {
    transaction: async () => { throw new Error("database unavailable"); },
  });

  await assert.rejects(() => replaceAvatarForUser({ userId: user._id, buffer: Buffer.from("image") }, dependencies), /database unavailable/);
  assert.equal(user.avatarPublicId, "avatars/previous");
  assert.deepEqual(calls.cleanup, []);
  assert.deepEqual(calls.clean, []);
  assert.deepEqual(calls.removed, ["avatars/new"]);
});

test("a Cloudinary cleanup failure remains retryable after the new avatar is saved", async () => {
  const user = createUser();
  const { calls, dependencies } = dependenciesFor(user, {
    clean: async (id) => {
      calls.clean.push(id);
      return { cleaned: false, error: "Cloudinary unavailable" };
    },
  });
  const result = await replaceAvatarForUser({ userId: user._id, buffer: Buffer.from("image") }, dependencies);

  assert.equal(user.avatarPublicId, "avatars/new");
  assert.deepEqual(calls.cleanup, ["avatars/previous"]);
  assert.deepEqual(calls.clean, ["cleanup-1"]);
  assert.equal(result.assetCleanup.cleaned, false);
});
