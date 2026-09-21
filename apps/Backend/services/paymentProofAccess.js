const jwt = require("jsonwebtoken");

const PAYMENT_PROOF_ACCESS_TTL_SECONDS = 5 * 60;

function issuePaymentProofAccessToken({ paymentId, adminId, now = Date.now() }) {
  return jwt.sign(
    { purpose: "payment-proof-view", paymentId: String(paymentId), adminId: String(adminId) },
    process.env.JWT_SECRET,
    // jsonwebtoken treats numeric `notBefore` values as a duration from iat,
    // not an absolute Unix timestamp. A relative value permits a one-second
    // clock tolerance without making newly issued links unusable.
    { expiresIn: PAYMENT_PROOF_ACCESS_TTL_SECONDS, notBefore: "-1s" }
  );
}

function verifyPaymentProofAccessToken(token, paymentId) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.purpose !== "payment-proof-view" || String(payload.paymentId) !== String(paymentId) || !payload.adminId) {
    const error = new Error("Invalid payment proof access link");
    error.status = 401;
    throw error;
  }
  return payload;
}

module.exports = { PAYMENT_PROOF_ACCESS_TTL_SECONDS, issuePaymentProofAccessToken, verifyPaymentProofAccessToken };
