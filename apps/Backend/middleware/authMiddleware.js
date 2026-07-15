const jwt = require("jsonwebtoken");

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

const validateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res
        .status(401)
        .json({ message: "Authorization header is missing" });
    }

    req.user = extractUserFromHeader(authHeader);
    next();
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

const attachUserIfPresent = (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      req.user = extractUserFromHeader(authHeader);
    }
  } catch (_error) {
    req.user = undefined;
  }

  next();
};

module.exports = validateToken;
module.exports.attachUserIfPresent = attachUserIfPresent;
