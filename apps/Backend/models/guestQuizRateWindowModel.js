const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  keyHash: { type: String, required: true, immutable: true },
  operation: { type: String, enum: ["start", "submit"], required: true, immutable: true },
  windowStart: { type: Date, required: true, immutable: true },
  count: { type: Number, required: true, min: 0 },
  expiresAt: { type: Date, required: true },
}, { collection: "guestquizratewindows", versionKey: false });

schema.index({ keyHash: 1, operation: 1, windowStart: 1 }, { name: "one_guest_quiz_rate_window", unique: true });
schema.index({ expiresAt: 1 }, { name: "guest_quiz_rate_window_expiry", expireAfterSeconds: 0 });

module.exports = mongoose.model("GuestQuizRateWindow", schema);
