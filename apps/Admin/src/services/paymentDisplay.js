export function formatPaymentAmount(amount, currency) {
  const value = Number(amount || 0).toLocaleString();
  // Historic payments created before currencies were captured were THB-only.
  // Never infer MMK from current course or method configuration.
  return currency === "MMK" ? `Ks ${value}` : `฿${value}`;
}

export function normalizePayment(payment) {
  if (!payment) return null;

  return {
    id: payment._id,
    userName: payment.userId?.name || "Unknown user",
    userEmail: payment.userId?.email || "",
    userAvatar:
      payment.userId?.avatar ||
      `https://ui-avatars.com/api/?background=f8b2c0&color=111827&name=${encodeURIComponent(payment.userId?.name || "User")}`,
    userDate: payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "",
    // Snapshots are the purchase record. Populated documents exist solely for
    // pre-Phase-5 legacy payments that do not have the equivalent snapshot.
    courseName: payment.courseSnapshot?.title || payment.courseId?.title || "Unknown course",
    amountValue: Number(payment.amount ?? payment.courseSnapshot?.price ?? payment.courseId?.price ?? 0),
    originalAmountValue: Number(payment.originalAmount ?? payment.courseSnapshot?.originalPrice ?? payment.courseSnapshot?.price ?? payment.courseId?.price ?? payment.amount ?? 0),
    discountAmount: Number(payment.discountAmount || 0),
    promoCode: payment.promoCode || "",
    feeValue: Number(payment.fee || 0),
    refundValue: Number(payment.refundAmount || 0),
    // Payment currency and method snapshot are immutable purchase evidence.
    // A later course or payment-method edit must not rewrite review history.
    currency: payment.currency || "THB",
    amount: formatPaymentAmount(payment.amount ?? payment.courseSnapshot?.price ?? payment.courseId?.price ?? 0, payment.currency),
    date: payment.status === "approved" && payment.reviewedAt
      ? new Date(payment.reviewedAt).toLocaleString()
      : payment.createdAt ? new Date(payment.createdAt).toLocaleString() : "",
    paymentMethod: payment.paymentMethodSnapshot?.name || "Uploaded transfer slip",
    paymentMethodType: payment.paymentMethodSnapshot?.type || "",
    cardInfo: payment.userId?.email || "",
    status: payment.status,
    denialReason: payment.rejectReason || "",
    hasPaymentProof: Boolean(payment.hasPaymentProof),
    proofStorage: payment.proofStorage || null,
  };
}
