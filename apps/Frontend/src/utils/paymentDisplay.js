export const formatSavedPaymentAmount = (amount, currency) =>
  `${currency === "MMK" ? "Ks " : "฿"}${Number(amount || 0).toLocaleString()}`;
