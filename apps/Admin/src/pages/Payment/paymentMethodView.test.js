import test from "node:test";
import assert from "node:assert/strict";
import { methodDetails, typeLabel } from "./paymentMethodView.js";

test("payment method display uses clear type labels and recipient summaries", () => {
  assert.equal(typeLabel("bank_transfer"), "Bank transfer");
  assert.deepEqual(methodDetails({ recipient: { accountName: "Arun Thai", accountNumber: "123" }, qrImage: { url: "https://example.test/qr" } }), { summary: "Arun Thai", qr: true });
});

test("payment method display handles optional recipient and QR fields", () => {
  assert.deepEqual(methodDetails({ type: "wallet", recipient: { phoneNumber: "099" } }), { summary: "099", qr: false });
});
