const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const extractUserFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token) {
    const error = new Error("Authorization header must be in the format: Bearer <token>");
    error.status = 401;
    throw error;
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};

const validateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res
        .status(401)
        .json({ message: "Authorization header is missing" });
    }

    const payload = extractUserFromHeader(authHeader);
    const user = await User.findById(payload.id).select("role isActive isVerified sessionVersion");
    if (!user || !user.isActive || !user.isVerified || Number(user.sessionVersion || 0) !== Number(payload.sessionVersion || 0)) {
      return res.status(401).json({ message: "Session is no longer valid" });
    }
    // Authoritative database role prevents a stale token retaining admin access.
    req.user = { id: user._id.toString(), role: user.role, sessionVersion: user.sessionVersion };
    return next();
  } catch (err) {
    if (err.message === "Authorization header must be in the format: Bearer <token>") {
      return res.status(401).json({ message: err.message });
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token has expired" });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }

    return res.status(401).json({ message: "User is not authorized!" });
  }
};

const attachUserIfPresent = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const payload = extractUserFromHeader(authHeader);
      const user = await User.findById(payload.id).select("role isActive isVerified sessionVersion");
      if (user && user.isActive && user.isVerified && Number(user.sessionVersion || 0) === Number(payload.sessionVersion || 0)) {
        req.user = { id: user._id.toString(), role: user.role, sessionVersion: user.sessionVersion };
      }
    }
  } catch (_error) {
    req.user = undefined;
  }

  next();
};

module.exports = validateToken;
module.exports.attachUserIfPresent = attachUserIfPresent;
