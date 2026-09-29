const mongoose = require("mongoose");

const twelveMonthsFromNow = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 12);
  return date;
};

const campaignSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 10000 },
    status: { type: String, enum: ["draft", "sent", "partial", "failed"], default: "draft" },
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    recipients: [{ name: String, email: String, recordType: String }],
    selectedRecipients: [{
      recordType: { type: String, enum: ["system", "contact"] },
      recipientId: { type: mongoose.Schema.Types.ObjectId },
      name: String,
      email: String,
    }],
    image: String,
    imagePublicId: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sentAt: Date,
    // Explicitly processed by the campaign lifecycle worker; deliberately not a
    // MongoDB TTL index because an image may require durable external cleanup.
    expiresAt: { type: Date, required: true, default: twelveMonthsFromNow },
    cleanupState: { type: String, enum: ["active", "claimed"], default: "active", index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", campaignSchema);
