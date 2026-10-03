const mongoose = require("mongoose");
const { PAYMENT_REFERENCE_PATTERN, createPaymentReference } = require("../services/paymentReference");

const paymentRecipientSnapshotSchema = new mongoose.Schema({
  accountName: { type: String, trim: true, default: "" },
  accountNumber: { type: String, trim: true, default: "" },
  bankName: { type: String, trim: true, default: "" },
  phoneNumber: { type: String, trim: true, default: "" },
  referenceHint: { type: String, trim: true, default: "" },
}, { _id: false });

const paymentQrSnapshotSchema = new mongoose.Schema({
  url: { type: String, trim: true, default: "" },
  publicId: { type: String, trim: true, default: "" },
}, { _id: false });

const paymentMethodSnapshotSchema = new mongoose.Schema({
  schemaVersion: { type: Number, required: true, min: 1 },
  kind: { type: String, required: true, enum: ["legacy", "method"] },
  // A legacy marker says only that the old system did not capture a method.
  // It intentionally contains no invented QR, recipient, or account details.
  reason: { type: String, trim: true, default: "" },
  methodId: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod", default: null },
  methodVersion: { type: Number, min: 0 },
  name: { type: String, trim: true, default: "" },
  currency: { type: String, enum: ["THB", "MMK"] },
  type: { type: String, enum: ["qr", "bank_transfer", "wallet"] },
  provider: { type: String, enum: ["manual"] },
  instructions: { type: String, default: "" },
  recipient: { type: paymentRecipientSnapshotSchema, default: undefined },
  qrImage: { type: paymentQrSnapshotSchema, default: undefined },
}, { _id: false });

// This is deliberately a pseudonymous, operational hold record: it prevents
// proof cleanup but does not alter the financial Payment record's retention.
const proofRetentionHoldSchema = new mongoose.Schema({
  active: { type: Boolean, default: false },
  reason: { type: String, enum: ["dispute", "refund", "investigation"], default: null },
  openedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { _id: false });

// A short-lived worker lease, not a retention decision. It is intentionally
// private because it is an operational concurrency control record.
const proofRetentionCleanupClaimSchema = new mongoose.Schema({
  token: { type: String, required: true },
  publicId: { type: String, required: true },
  storage: { type: String, enum: ["authenticated", "legacy"], required: true },
  claimedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { _id: false });
const snapshotMinimizationClaimSchema = new mongoose.Schema({ token: { type: String, required: true }, claimedAt: { type: Date, required: true }, expiresAt: { type: Date, required: true } }, { _id: false });
// Final financial-record deletion has no automatic lease recovery. A paused
// destructive operation must be reconciled explicitly with writers stopped.
const finalDeletionClaimSchema = new mongoose.Schema({ token: { type: String, required: true }, claimedAt: { type: Date, required: true } }, { _id: false });
// Private receipt-send reservation. It contains no receipt or learner data:
// it prevents concurrent sends and conservatively protects a lifetime slot
// after an uncertain provider outcome.
const receiptEmailReservationSchema = new mongoose.Schema({
  token: { type: String, required: true },
  deliveryType: { type: String, enum: ["approval", "self_service"], required: true },
  state: { type: String, enum: ["rendering", "sending", "uncertain"], required: true },
  startedAt: { type: Date, required: true },
  renderDeadlineAt: { type: Date, default: null },
}, { _id: false });

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    // A human-facing opaque identifier. Existing rows predate it and remain
    // readable; every newly-created Payment receives it before validation.
    paymentReference: {
      type: String,
      trim: true,
      uppercase: true,
      immutable: true,
      match: PAYMENT_REFERENCE_PATTERN,
      required: function requirePaymentReferenceForNewPayments() { return this.isNew; },
    },
    // Retains the purchase description for order history if the course is
    // later removed from the catalogue.
    courseSnapshot: {
      title: { type: String, trim: true, default: "" },
      description: { type: String, default: "" },
      thumbnail: { type: String, default: "" },
      price: { type: Number, min: 0 },
      originalPrice: { type: Number, min: 0 },
      currency: { type: String, enum: ["THB", "MMK"] },
    },
    courseDeletedAt: { type: Date, default: null },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    originalAmount: { type: Number, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ["THB", "MMK"], default: undefined },
    paymentMethodId: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod", default: null },
    paymentMethodSnapshot: { type: paymentMethodSnapshotSchema, default: undefined },
    promoCode: { type: String, trim: true, uppercase: true },
    promoRedemptionId: { type: mongoose.Schema.Types.ObjectId, ref: "PromoRedemption", default: null },
    fee: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentImage: {
      type: String,
      trim: true,
      select: false,
    },
    paymentImagePublicId: {
      type: String,
      trim: true,
      select: false,
    },
    paymentProofPublicId: {
      type: String,
      trim: true,
      select: false,
    },
    paymentProofFormat: {
      type: String,
      trim: true,
      select: false,
    },
    paymentProofStorage: {
      type: String,
      enum: ["authenticated", "legacy"],
      select: false,
    },
    proofRetentionHold: { type: proofRetentionHoldSchema, default: undefined, select: false },
    proofRetentionCleanupClaim: { type: proofRetentionCleanupClaimSchema, default: undefined, select: false },
    paymentMethodSnapshotMinimizationClaim: { type: snapshotMinimizationClaimSchema, default: undefined, select: false },
    paymentFinalDeletionClaim: { type: finalDeletionClaimSchema, default: undefined, select: false },
    receiptEmailReservation: { type: receiptEmailReservationSchema, default: undefined, select: false },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    rejectReason: {
      type: String,
      trim: true,
    },
    rejectionReasonCode: { type: String, enum: ["receipt_unreadable", "receipt_incomplete", "receipt_unverifiable"], default: undefined },
    rejectionNote: { type: String, trim: true, maxlength: 300, default: undefined },
  },
  { timestamps: true }
);

paymentSchema.pre("validate", function validatePaymentMethodSnapshot() {
  if (this.isNew && !this.paymentReference) this.paymentReference = createPaymentReference();
  const snapshot = this.paymentMethodSnapshot;
  if (!snapshot) return; // Existing pre-migration rows remain readable.
  if (snapshot.kind === "legacy") {
    if (this.paymentMethodId || snapshot.methodId || snapshot.name || snapshot.currency || snapshot.type || snapshot.provider || snapshot.instructions || snapshot.recipient || snapshot.qrImage) {
      throw new Error("Legacy payment-method snapshots must not invent payment-method details.");
    }
    if (snapshot.reason !== "legacy_method_not_captured") throw new Error("Legacy payment-method snapshots require the standard legacy marker.");
    return;
  }
  if (!this.paymentMethodId || !snapshot.methodId || String(this.paymentMethodId) !== String(snapshot.methodId)) {
    throw new Error("Payment-method snapshots must match paymentMethodId.");
  }
  if (!snapshot.name || !snapshot.currency || !snapshot.type || !snapshot.provider || snapshot.methodVersion == null) {
    throw new Error("Payment-method snapshots require immutable method context.");
  }
  if (this.currency && this.currency !== snapshot.currency) throw new Error("Payment currency must match the method snapshot currency.");
});

paymentSchema.index({ userId: 1, courseId: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
paymentSchema.index(
  { paymentReference: 1 },
  { unique: true, partialFilterExpression: { paymentReference: { $type: "string" } } },
);

module.exports = mongoose.model("Payment", paymentSchema);
