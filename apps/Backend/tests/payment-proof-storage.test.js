const assert = require("node:assert/strict");
const { afterEach, mock, test } = require("node:test");
const cloudinary = require("../config/cloudinary");
const { deletePaymentProof } = require("../services/paymentProofStorage");

afterEach(() => mock.restoreAll());

test("payment-proof deletion treats an already-missing Cloudinary asset as success", async () => {
  const destroy = mock.method(cloudinary.uploader, "destroy", async () => ({ result: "not found" }));
  await assert.doesNotReject(() => deletePaymentProof("arun_thai/payment_proofs/missing"));
  assert.equal(destroy.mock.calls.length, 1);
});

test("payment-proof deletion accepts a successful Cloudinary deletion", async () => {
  mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));
  await assert.doesNotReject(() => deletePaymentProof("arun_thai/payment_proofs/deleted"));
});

test("payment-proof deletion rejects unexpected Cloudinary results", async () => {
  mock.method(cloudinary.uploader, "destroy", async () => ({ result: "error" }));
  await assert.rejects(() => deletePaymentProof("arun_thai/payment_proofs/error"), /Cloudinary payment-proof deletion failed/);
});

test("payment-proof deletion preserves genuine Cloudinary failures", async () => {
  mock.method(cloudinary.uploader, "destroy", async () => { throw new Error("network unavailable"); });
  await assert.rejects(() => deletePaymentProof("arun_thai/payment_proofs/network"), /network unavailable/);
});
