const mongoose = require("mongoose");

function healthCheck(_req, res) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: "unavailable" });
  }
  return res.status(200).json({ status: "ok" });
}

module.exports = healthCheck;
