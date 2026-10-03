const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const User = require("../models/userModel");
const AccountAssetCleanup = require("../models/accountAssetCleanupModel");
const { uploadStream } = require("./uploadStream");
const { cleanAccountAsset } = require("./accountAssetCleanup");

async function removeUncommittedAvatar(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      type: "upload",
      invalidate: true,
    });
  } catch (_error) {
    // The new asset was never attached to an account. Do not mask the database
    // failure if Cloudinary is temporarily unavailable.
  }
}

async function replaceAvatarForUser({ userId, name, buffer }, overrides = {}) {
  const dependencies = {
    upload: uploadStream,
    transaction: (work) => mongoose.connection.transaction(work),
    findUser: (id, session) => User.findById(id).session(session),
    createCleanup: (publicId, session) => AccountAssetCleanup.create([{ publicId }], { session }),
    clean: cleanAccountAsset,
    removeUncommitted: removeUncommittedAvatar,
    ...overrides,
  };

  const uploaded = await dependencies.upload(buffer, "english_kafe/avatars");
  let cleanupId = null;
  let updatedUser;

  try {
    await dependencies.transaction(async (session) => {
      const user = await dependencies.findUser(userId, session);
      if (!user) {
        const error = new Error("User not found");
        error.status = 404;
        throw error;
      }

      const previousPublicId = user.avatarPublicId;
      if (name) user.name = name;
      user.avatar = uploaded.secure_url;
      user.avatarPublicId = uploaded.public_id;
      await user.save({ session });

      if (previousPublicId && previousPublicId !== uploaded.public_id) {
        const [cleanup] = await dependencies.createCleanup(previousPublicId, session);
        cleanupId = cleanup._id;
      }
      updatedUser = user;
    });
  } catch (error) {
    await dependencies.removeUncommitted(uploaded.public_id);
    throw error;
  }

  const assetCleanup = cleanupId ? await dependencies.clean(cleanupId) : { cleaned: true };
  return { user: updatedUser, assetCleanup };
}

module.exports = { replaceAvatarForUser, removeUncommittedAvatar };
