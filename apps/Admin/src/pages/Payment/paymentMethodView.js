export const typeLabel = (type) => ({ qr: "QR payment", bank_transfer: "Bank transfer", wallet: "Wallet" }[type] || "Payment method");

export const methodDetails = (method = {}) => {
  const recipient = method.recipient || {};
  const summary = recipient.accountName || recipient.bankName || recipient.accountNumber || recipient.phoneNumber || "";
  return { summary, qr: Boolean(method.qrImage?.url) };
};
