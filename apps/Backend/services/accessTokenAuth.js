const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

function accessTokenError(message, code = "UNAUTHORIZED") {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function authenticateAccessToken(token) {
  if (!token || typeof token !== "string") {
    throw accessTokenError("Access token is missing");
  }

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.id).select("role isActive isVerified sessionVersion");

  if (!user || !user.isActive || !user.isVerified || Number(user.sessionVersion || 0) !== Number(payload.sessionVersion || 0)) {
    throw accessTokenError("Session is no longer valid");
  }

  return {
    id: user._id.toString(),
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

module.exports = { authenticateAccessToken };
