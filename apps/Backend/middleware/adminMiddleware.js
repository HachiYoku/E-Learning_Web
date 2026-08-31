const User = require("../models/userModel");

const requireAdmin = async (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }

  try {
    const admin = await User.findById(req.user.id).select("role isActive");
    if (!admin || !admin.isActive || admin.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "User is not authorized" });
  }
};

module.exports = requireAdmin;
