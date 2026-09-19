const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const RefreshSession = require("../models/refreshSessionModel");

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14);
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const newOpaqueToken = () => crypto.randomBytes(48).toString("base64url");

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Production frontends and the API are commonly on different sites
  // (for example Vercel and Render), which requires SameSite=None.
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/auth",
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

const clearRefreshCookieOptions = () => {
  const { maxAge, ...options } = refreshCookieOptions();
  return options;
};

const issueAccessToken = (user) => jwt.sign(
  { id: user._id, role: user.role, sessionVersion: user.sessionVersion || 0 },
  process.env.JWT_SECRET,
  { expiresIn: ACCESS_TOKEN_TTL }
);

async function createRefreshSession(user) {
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await RefreshSession.create({
    userId: user._id,
    tokenHash: hashToken(token),
    sessionVersion: Number(user.sessionVersion || 0),
    expiresAt,
  });
  return token;
}

async function rotateRefreshSession(token) {
  if (!token) return null;

  // Mark first, rather than delete, so a replay of an already-rotated token
  // can invalidate all sessions for that user.
  const session = await RefreshSession.findOneAndUpdate(
    { tokenHash: hashToken(token), revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } },
    { new: false }
  );
  if (!session) {
    // A previously revoked token being presented is a replay signal. It can
    // happen when a token is stolen, so revoke the user's remaining sessions.
    const replayedSession = await RefreshSession.findOne({ tokenHash: hashToken(token), revokedAt: { $ne: null } });
    if (replayedSession) await revokeAllUserSessions(replayedSession.userId);
    return null;
  }

  const User = require("../models/userModel");
  const user = await User.findById(session.userId).select("role isActive isVerified sessionVersion");
  if (!user || !user.isActive || !user.isVerified || Number(user.sessionVersion || 0) !== session.sessionVersion) {
    return { invalid: true, userId: session.userId };
  }

  return { user, refreshToken: await createRefreshSession(user) };
}

async function revokeRefreshSession(token) {
  if (!token) return;
  await RefreshSession.updateOne(
    { tokenHash: hashToken(token), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

async function revokeAllUserSessions(userId) {
  await RefreshSession.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

module.exports = {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  clearRefreshCookieOptions,
  issueAccessToken,
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession,
  revokeAllUserSessions,
};
