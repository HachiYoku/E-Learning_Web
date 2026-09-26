import assert from "node:assert/strict";
import test from "node:test";
import { createProofObjectUrl, proofRequestKey, rejectedProofDisplayState, revokeProofObjectUrl, shouldFetchProof, shouldShowRejectedProof } from "./studentProofViewer.js";

test("only rejected payments with a stored proof render the student proof section", () => {
  assert.equal(shouldShowRejectedProof({ status: "rejected", hasPaymentProof: true }), true);
  assert.equal(shouldShowRejectedProof({ status: "pending", hasPaymentProof: true }), false);
  assert.equal(shouldShowRejectedProof({ status: "approved", hasPaymentProof: true }), false);
  assert.equal(shouldShowRejectedProof({ status: "rejected", hasPaymentProof: false }), false);
});

test("proof blob URLs are created for viewing and revoked during cleanup", () => {
  const revoked = [];
  const urlApi = { createObjectURL: () => "blob:private-proof", revokeObjectURL: (url) => revoked.push(url) };
  const url = createProofObjectUrl(new Blob(["proof"]), urlApi);
  assert.equal(url, "blob:private-proof");
  revokeProofObjectUrl(url, urlApi);
  assert.deepEqual(revoked, ["blob:private-proof"]);
});

test("proof loading, success, and failures stay local to the thumbnail section", () => {
  assert.equal(rejectedProofDisplayState({ loading: true, failed: false, thumbnailUrl: "" }), "loading");
  assert.equal(rejectedProofDisplayState({ loading: false, failed: false, thumbnailUrl: "blob:private-proof" }), "thumbnail");
  assert.equal(rejectedProofDisplayState({ loading: false, failed: true, thumbnailUrl: "" }), "failed");
});

test("a retry gets a new proof request while a successful request is not repeated", () => {
  const first = proofRequestKey("payment-1", 0);
  assert.equal(shouldFetchProof({ paymentId: "payment-1", retryCount: 0, loadedRequestKey: "" }), true);
  assert.equal(shouldFetchProof({ paymentId: "payment-1", retryCount: 0, loadedRequestKey: first }), false);
  assert.equal(shouldFetchProof({ paymentId: "payment-1", retryCount: 1, loadedRequestKey: first }), true);
});
