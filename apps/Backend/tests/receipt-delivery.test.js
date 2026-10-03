const assert = require("node:assert/strict");
const test = require("node:test");
const ReceiptDelivery = require("../models/receiptDeliveryModel");
const { receiptFilename } = require("../services/paymentReceiptService");

test("ReceiptDelivery stores only minimal durable lifetime-accounting fields", () => {
  const paths = ReceiptDelivery.schema.paths;
  assert.deepEqual(Object.keys(paths).sort(), ["__v", "_id", "createdAt", "deliveryType", "paymentId", "sentAt", "updatedAt"].sort());
  assert.equal(ReceiptDelivery.schema.indexes().some(([, options]) => options.expireAfterSeconds != null), false);
  assert.equal(receiptFilename("PAY-7KQ4M9DX"), "Arun-Thai-Payment-Receipt-PAY-7KQ4M9DX.pdf");
});

test("Payment receipt reservations contain no learner or receipt content", () => {
  const Payment = require("../models/paymentModel");
  const reservation = Payment.schema.path("receiptEmailReservation").schema.paths;
  assert.deepEqual(Object.keys(reservation).sort(), ["deliveryType", "renderDeadlineAt", "startedAt", "state", "token"].sort());
});
