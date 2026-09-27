const mongoose = require("mongoose");

// Stores only a hash of a short-lived, one-time re-authentication token.
// The plaintext token is returned once to the authenticated browser and is
// never persisted alongside the account or password hash.
const accountDeletionConfirmationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    sessionVersion: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true, expires: 0, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccountDeletionConfirmation", accountDeletionConfirmationSchema);
