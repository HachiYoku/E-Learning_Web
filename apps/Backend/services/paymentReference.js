const crypto = require("node:crypto");

const PAYMENT_REFERENCE_PREFIX = "PAY-";
const PAYMENT_REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PAYMENT_REFERENCE_PATTERN = /^PAY-[A-HJKMNPQRSTUVWXYZ2-9]{8}$/;
const PAYMENT_REFERENCE_RANDOM_LENGTH = 8;
const MAX_PAYMENT_REFERENCE_ATTEMPTS = 3;

function createPaymentReference() {
  let randomPart = "";
  const acceptedByteLimit = Math.floor(256 / PAYMENT_REFERENCE_ALPHABET.length) * PAYMENT_REFERENCE_ALPHABET.length;

  while (randomPart.length < PAYMENT_REFERENCE_RANDOM_LENGTH) {
    const bytes = crypto.randomBytes(PAYMENT_REFERENCE_RANDOM_LENGTH - randomPart.length);
    for (const byte of bytes) {
      // Reject values outside the largest evenly divisible range so modulo does
      // not make some human-friendly characters more likely than others.
      if (byte >= acceptedByteLimit) continue;
      randomPart += PAYMENT_REFERENCE_ALPHABET[byte % PAYMENT_REFERENCE_ALPHABET.length];
    }
  }

  return `${PAYMENT_REFERENCE_PREFIX}${randomPart}`;
}

function normalizePaymentReference(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function isPaymentReferenceDuplicate(error) {
  if (error?.code !== 11000) return false;
  return Boolean(error.keyPattern?.paymentReference || error.keyValue?.paymentReference || /paymentReference/i.test(String(error.message || "")));
}

module.exports = {
  PAYMENT_REFERENCE_PATTERN,
  PAYMENT_REFERENCE_ALPHABET,
  MAX_PAYMENT_REFERENCE_ATTEMPTS,
  createPaymentReference,
  normalizePaymentReference,
  isPaymentReferenceDuplicate,
};
