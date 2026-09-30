const mongoose = require("mongoose");

const marketingConsentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["never_subscribed", "subscribed", "unsubscribed"],
      default: "never_subscribed",
      index: true,
    },
    lastOptedInAt: { type: Date, default: null },
    lastOptInSource: { type: String, trim: true, maxlength: 80, default: "" },
    withdrawnAt: { type: Date, default: null },
    withdrawalSource: { type: String, trim: true, maxlength: 80, default: "" },
  },
  { _id: false }
);
const operationClaimSchema = new mongoose.Schema({
  token: { type: String, required: true },
  operation: { type: String, enum: ["submission", "consent", "cleanup"], required: true },
  claimedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { _id: false });

const contactLeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    marketingConsent: { type: marketingConsentSchema, default: () => ({}) },
    operationClaim: { type: operationClaimSchema, default: undefined, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContactLead", contactLeadSchema);
