const courseKey = (value) => {
  const courseId = value?.courseId?._id || value?.courseId || value?.courseKey;
  return courseId ? String(courseId) : "";
};

const paymentKey = (payment) => String(payment?._id || payment?.id || "");

// Payments must be supplied newest-first. This only decorates historical
// rejected attempts; it never changes the payment status stored in MongoDB.
const deriveCoursePaymentStates = (payments, enrolledCourseIds = new Set()) => {
  const byCourse = new Map();
  payments.forEach((payment) => {
    const key = courseKey(payment);
    if (!key) return;
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push(payment);
  });

  const states = new Map();
  byCourse.forEach((coursePayments, key) => {
    coursePayments.forEach((payment, index) => {
      if (payment.status !== "rejected") return;
      if (enrolledCourseIds.has(key)) {
        states.set(paymentKey(payment), { kind: "enrolled" });
        return;
      }

      const newerPayments = coursePayments.slice(0, index);
      const newerPending = newerPayments.find((candidate) => candidate.status === "pending");
      if (newerPending) {
        states.set(paymentKey(payment), { kind: "newer_pending", currentPaymentId: paymentKey(newerPending) });
        return;
      }

      const newerRejected = newerPayments.find((candidate) => candidate.status === "rejected");
      if (newerRejected) {
        states.set(paymentKey(payment), { kind: "newer_rejected", currentPaymentId: paymentKey(newerRejected) });
        return;
      }

      states.set(paymentKey(payment), { kind: "action_required" });
    });
  });
  return states;
};

module.exports = { courseKey, deriveCoursePaymentStates };
