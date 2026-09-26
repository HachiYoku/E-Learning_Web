import assert from "node:assert/strict";
import test from "node:test";
import { orderStatusView, rejectedPaymentResubmissionPath, savedPaymentDetails } from "./orderStatusView.js";

test("pending status communicates waiting for review without an action CTA", () => {
  const view = orderStatusView({ status: "pending" });
  assert.equal(view.title, "Waiting for review");
  assert.equal(view.action, null);
  assert.deepEqual(view.steps, ["complete", "active", "upcoming"]);
});

test("rejected status is action-required and starts a new payment", () => {
  const view = orderStatusView({ status: "rejected" });
  assert.equal(view.title, "Payment needs attention");
  assert.equal(view.action, "Submit a new payment");
  assert.equal(view.steps, null);
  assert.equal(rejectedPaymentResubmissionPath("course-123"), "/payment/course-123");
});

test("historical rejected payments use backend-derived newer payment and enrollment state", () => {
  const pending = orderStatusView({ status: "rejected", coursePaymentState: { kind: "newer_pending", currentPaymentId: "payment-c" } });
  assert.equal(pending.kind, "newer_pending");
  assert.equal(pending.currentPaymentId, "payment-c");
  assert.equal(pending.action, "View latest payment");

  const newerRejected = orderStatusView({ status: "rejected", coursePaymentState: { kind: "newer_rejected", currentPaymentId: "payment-b" } });
  assert.equal(newerRejected.kind, "newer_rejected");
  assert.equal(newerRejected.action, "View latest payment");

  const enrolled = orderStatusView({ status: "rejected", coursePaymentState: { kind: "enrolled" } });
  assert.equal(enrolled.kind, "resolved");
  assert.equal(enrolled.action, "Start learning");
});

test("approved status leads directly to learning", () => {
  const view = orderStatusView({ status: "approved" });
  assert.equal(view.title, "Enrollment complete");
  assert.equal(view.action, "Start learning");
  assert.deepEqual(view.steps, ["complete", "complete", "complete"]);
});

test("payment details use saved THB or MMK data", () => {
  assert.deepEqual(savedPaymentDetails({ amount: 3900, currency: "THB", paymentMethod: { name: "Thai bank" } }), { amount: "฿3,900", currency: "THB", method: "Thai bank" });
  assert.deepEqual(savedPaymentDetails({ amount: 120000, currency: "MMK", paymentMethod: { name: "KBZPay" } }), { amount: "Ks 120,000", currency: "MMK", method: "KBZPay" });
});
