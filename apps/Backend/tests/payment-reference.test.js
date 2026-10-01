const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const Payment = require("../models/paymentModel");
const {
  PAYMENT_REFERENCE_ALPHABET,
  PAYMENT_REFERENCE_PATTERN,
  createPaymentReference,
  isPaymentReferenceDuplicate,
  normalizePaymentReference,
} = require("../services/paymentReference");

test("Payment References use the approved opaque human-friendly format", () => {
  const references = new Set(Array.from({ length: 100 }, createPaymentReference));
  assert.equal(references.size, 100);
  for (const paymentReference of references) {
    assert.match(paymentReference, PAYMENT_REFERENCE_PATTERN);
    for (const character of paymentReference.slice(4)) assert.ok(PAYMENT_REFERENCE_ALPHABET.includes(character));
  }
});

test("Payment Reference normalization and duplicate detection are exact", () => {
  assert.equal(normalizePaymentReference("  pay-7kq4m9dx  "), "PAY-7KQ4M9DX");
  assert.equal(isPaymentReferenceDuplicate({ code: 11000, keyPattern: { paymentReference: 1 } }), true);
  assert.equal(isPaymentReferenceDuplicate({ code: 11000, keyPattern: { userId: 1, courseId: 1 } }), false);
  assert.equal(isPaymentReferenceDuplicate({ code: 11000, keyPattern: { promoCode: 1 } }), false);
});

test("new Payments receive a valid reference before validation while an invalid supplied reference cannot validate", async () => {
  const base = { userId: new mongoose.Types.ObjectId(), courseId: new mongoose.Types.ObjectId(), amount: 1 };
  const generated = new Payment(base);
  await generated.validate();
  assert.match(generated.paymentReference, PAYMENT_REFERENCE_PATTERN);

  const invalid = new Payment({ ...base, paymentReference: "PAY-INVALID" });
  await assert.rejects(invalid.validate(), /paymentReference/);
});
