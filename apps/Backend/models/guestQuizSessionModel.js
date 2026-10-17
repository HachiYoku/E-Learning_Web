const mongoose = require("mongoose");
const { SESSION_MS } = require("../services/guestQuizSecurity");

// Guest ownership is a hash of a server-issued secret, never a User reference.
const schema = new mongoose.Schema({
  ownerHash: { type: String, required: true, immutable: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, immutable: true },
  contextType: { type: String, enum: ["standalone"], default: "standalone", required: true, immutable: true },
  revision: { type: Number, required: true, min: 1, immutable: true },
  setEpoch: { type: Number, min: 0, default: undefined, immutable: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  startedAt: { type: Date, required: true, immutable: true },
  expiresAt: { type: Date, required: true, immutable: true },
  invalidatedAt: { type: Date, default: null },
  activeSlot: { type: Boolean, default: true },
}, { collection: "guestquizsessions", timestamps: true });

schema.path("expiresAt").validate(function exactlyOneDay(value) {
  return this.startedAt instanceof Date && value instanceof Date
    && value.getTime() - this.startedAt.getTime() === SESSION_MS;
}, "Guest session must expire exactly 24 hours after creation.");

schema.index({ quiz: 1, ownerHash: 1 }, { name: "one_active_guest_quiz_session", unique: true,
  partialFilterExpression: { activeSlot: true } });
schema.index({ expiresAt: 1 }, { name: "guest_quiz_session_expiry", expireAfterSeconds: 0 });
schema.index({ quiz: 1, expiresAt: 1 });

schema.pre("save", function preserveSnapshot() {
  if (!this.isNew && this.isModified("snapshot")) throw new Error("Guest session snapshots are immutable.");
});
schema.pre(["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne"], function preserveSessionIdentity() {
  const update = this.getUpdate() || {};
  const paths = Object.entries(update).flatMap(([key, value]) => key.startsWith("$")
    ? Object.keys(value || {}) : [key]);
  const protectedPaths = ["ownerHash", "quiz", "contextType", "revision", "setEpoch", "snapshot", "startedAt", "expiresAt"];
  if (paths.some((path) => protectedPaths.some((protectedPath) => path === protectedPath || path.startsWith(`${protectedPath}.`)))) {
    throw new Error("Guest session identity and snapshot are immutable.");
  }
});

module.exports = mongoose.model("GuestQuizSession", schema);
