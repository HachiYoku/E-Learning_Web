const assert = require("node:assert/strict");
const test = require("node:test");
const Payment = require("../models/paymentModel");
const { deadline, eligible, DETAIL_FIELDS } = require("../services/paymentSnapshotMinimization");

test("snapshot minimization uses reviewedAt calendar months and terminal status", () => {
  const payment = { status: "approved", reviewedAt: new Date("2024-02-29T10:00:00Z"), proofRetentionHold: { active: false } };
  assert.equal(deadline(payment).toISOString(), "2025-02-28T10:00:00.000Z");
  assert.equal(eligible(payment, new Date("2025-02-27T10:00:00Z")), false);
  assert.equal(eligible(payment, new Date("2025-02-28T10:00:00Z")), true);
  assert.equal(eligible({ ...payment, status: "pending" }, new Date("2026-01-01")), false);
  assert.equal(eligible({ ...payment, proofRetentionHold: { active: true } }, new Date("2026-01-01")), false);
});

test("snapshot minimization targets only approved detailed fields", () => {
  assert.deepEqual(DETAIL_FIELDS, ["paymentMethodSnapshot.instructions", "paymentMethodSnapshot.recipient.accountName", "paymentMethodSnapshot.recipient.accountNumber", "paymentMethodSnapshot.recipient.bankName", "paymentMethodSnapshot.recipient.phoneNumber", "paymentMethodSnapshot.recipient.referenceHint", "paymentMethodSnapshot.qrImage.url", "paymentMethodSnapshot.qrImage.publicId"]);
  assert.ok(Payment.schema.path("rejectionReasonCode"));
  assert.equal(Payment.schema.path("rejectionNote").options.maxlength, 300);
});
