const crypto = require("crypto");
const AccountDeletionConfirmation = require("../models/accountDeletionConfirmationModel");

const CONFIRMATION_TTL_MS = 30 * 1000;
const hashConfirmationToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

function createConfirmationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

async function issueDeletionConfirmation(userId, sessionVersion) {
  const token = createConfirmationToken();
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);
  await AccountDeletionConfirmation.findOneAndUpdate(
    { userId },
    { $set: { tokenHash: hashConfirmationToken(token), sessionVersion: Number(sessionVersion || 0), expiresAt } },
    { upsert: true, returnDocument: "after", runValidators: true }
  );
  return { token, expiresAt };
}

function validConfirmationToken(token) {
  return typeof token === "string" && token.length >= 32;
}

async function hasValidDeletionConfirmation(userId, sessionVersion, token) {
  if (!validConfirmationToken(token)) return false;
  return Boolean(await AccountDeletionConfirmation.exists({
    userId,
    tokenHash: hashConfirmationToken(token),
    sessionVersion: Number(sessionVersion || 0),
    expiresAt: { $gt: new Date() },
  }));
}

module.exports = { hashConfirmationToken, hasValidDeletionConfirmation, issueDeletionConfirmation, validConfirmationToken };
