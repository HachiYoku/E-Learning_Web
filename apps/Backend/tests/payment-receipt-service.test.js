const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");

const Payment = require("../models/paymentModel");
const User = require("../models/userModel");
const ReceiptDelivery = require("../models/receiptDeliveryModel");
const renderer = require("../services/paymentReceiptRenderer");
const email = require("../services/sendEmail");

const servicePath = require.resolve("../services/paymentReceiptService");

function paymentRecord() {
  return {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    status: "approved",
    paymentReference: "PAY-7KQ4M9DX",
    courseSnapshot: { title: "Thai Foundations", currency: "THB" },
    paymentMethodSnapshot: { kind: "method", name: "PromptPay" },
    amount: 1000,
    originalAmount: 1000,
    discountAmount: 0,
    currency: "THB",
    createdAt: new Date("2026-10-02T04:00:00.000Z"),
    reviewedAt: new Date("2026-10-02T05:00:00.000Z"),
  };
}

function loadService(render = async () => ({ pdfBuffer: Buffer.from("pdf") })) {
  mock.method(renderer, "renderPaymentReceipt", render);
  delete require.cache[servicePath];
  return require("../services/paymentReceiptService");
}

function chain(value) {
  return { populate: () => ({ lean: async () => value }) };
}

test("receipt filename and DTO use only the approved public payment fields", () => {
  const service = loadService();
  const receipt = service.receiptDto(paymentRecord(), { name: "Aye Aye", email: "aye@example.com" });
  assert.equal(service.receiptFilename("PAY-7KQ4M9DX"), "Arun-Thai-Payment-Receipt-PAY-7KQ4M9DX.pdf");
  assert.deepEqual(receipt, {
    studentName: "Aye Aye", studentEmail: "aye@example.com", paymentReference: "PAY-7KQ4M9DX",
    courseTitle: "Thai Foundations", amount: 1000, originalAmount: 1000, discountAmount: 0,
    currency: "THB", paymentMethodName: "PromptPay",
    submittedAt: new Date("2026-10-02T04:00:00.000Z"), approvedAt: new Date("2026-10-02T05:00:00.000Z"),
  });
});

test("receipt rendering is serialized per instance and a waiting render times out without starting", async () => {
  let active = 0;
  let maximumActive = 0;
  let releaseFirst;
  const firstRelease = new Promise((resolve) => { releaseFirst = resolve; });
  let renderCalls = 0;
  const service = loadService(async () => {
    renderCalls += 1;
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    if (renderCalls === 1) await firstRelease;
    active -= 1;
    return { pdfBuffer: Buffer.from("pdf") };
  });
  const first = service.runSerializedRender({ paymentReference: "PAY-ONE" });
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(service.runSerializedRender({ paymentReference: "PAY-TWO" }, { timeoutMs: 10 }), /temporarily unavailable/);
  releaseFirst();
  await first;
  assert.equal(maximumActive, 1);
  assert.equal(renderCalls, 1);
});

test("self-service permits one concurrent request and records only a provider-accepted send", async () => {
  const record = paymentRecord();
  let claimed = false;
  const deliveries = [];
  let releaseRender;
  const pendingRender = new Promise((resolve) => { releaseRender = resolve; });
  const service = loadService(async () => {
    await pendingRender;
    return { pdfBuffer: Buffer.from("pdf") };
  });
  mock.method(Payment, "findOneAndUpdate", () => ({ select: async () => {
    if (claimed) return null;
    claimed = true;
    return record;
  } }));
  mock.method(Payment, "findOne", () => chain(record));
  mock.method(Payment, "updateOne", async () => { claimed = false; });
  mock.method(User, "findById", () => ({ select: () => ({ lean: async () => ({ name: "Aye Aye", email: "aye@example.com" }) }) }));
  mock.method(ReceiptDelivery, "countDocuments", async () => deliveries.length);
  mock.method(ReceiptDelivery, "create", async (entry) => { deliveries.push(entry); return entry; });
  // The service captures sendEmail at module evaluation; replace its exported callable before reloading.
  const emailPath = require.resolve("../services/sendEmail");
  const originalEmail = require.cache[emailPath].exports;
  require.cache[emailPath].exports = async () => ({ data: { id: "accepted" } });
  delete require.cache[servicePath];
  const reloaded = require("../services/paymentReceiptService");
  const first = reloaded.selfServiceReceipt(record._id, record.userId);
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(reloaded.selfServiceReceipt(record._id, record.userId), /already being processed/);
  releaseRender();
  await first;
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].deliveryType, "self_service");
  require.cache[emailPath].exports = originalEmail;
});

test("provider failure creates no delivery record and releases the self-service claim", async () => {
  const record = paymentRecord();
  let claimed = false;
  loadService();
  mock.method(Payment, "findOneAndUpdate", () => ({ select: async () => {
    if (claimed) return null;
    claimed = true;
    return record;
  } }));
  mock.method(Payment, "findOne", () => chain(record));
  mock.method(Payment, "updateOne", async () => { claimed = false; });
  mock.method(User, "findById", () => ({ select: () => ({ lean: async () => ({ name: "Aye Aye", email: "aye@example.com" }) }) }));
  mock.method(ReceiptDelivery, "countDocuments", async () => 0);
  const created = mock.method(ReceiptDelivery, "create", async () => { throw new Error("must not record"); });
  const emailPath = require.resolve("../services/sendEmail");
  const originalEmail = require.cache[emailPath].exports;
  require.cache[emailPath].exports = async () => {
    const error = new Error("provider rejected the message");
    error.definitiveProviderFailure = true;
    throw error;
  };
  delete require.cache[servicePath];
  const reloaded = require("../services/paymentReceiptService");
  await assert.rejects(reloaded.selfServiceReceipt(record._id, record.userId), /provider rejected the message/);
  assert.equal(created.mock.callCount(), 0);
  assert.equal(claimed, false);
  require.cache[emailPath].exports = originalEmail;
});

test("approval receipt rendering failure releases its reservation and remains non-blocking", async () => {
  const record = paymentRecord();
  const updates = [];
  const service = loadService(async () => { throw new Error("synthetic renderer failure"); });
  mock.method(Payment, "findOneAndUpdate", () => ({ select: async () => record }));
  mock.method(Payment, "findOne", () => chain(record));
  mock.method(User, "findById", () => ({ select: () => ({ lean: async () => ({ name: "Aye Aye", email: "aye@example.com" }) }) }));
  mock.method(ReceiptDelivery, "countDocuments", async () => 0);
  mock.method(Payment, "updateOne", async (query, update) => { updates.push({ query, update }); });

  const prepared = await service.prepareApprovalReceipt(record);

  assert.equal(prepared, null);
  assert.ok(updates.some(({ update }) => update.$unset?.receiptEmailReservation === 1));
});

test("a reservation that has passed its rendering deadline cannot cross the provider-send boundary", async () => {
  const service = loadService();
  const update = mock.method(Payment, "findOneAndUpdate", async () => null);
  const startedAt = new Date("2026-10-02T04:00:00.000Z");
  await assert.rejects(
    service.beginProviderSend({ paymentId: "payment-one", token: "token-one" }, new Date(startedAt.getTime() + service.RENDER_DEADLINE_MS)),
    /temporarily unavailable/,
  );
  assert.equal(update.mock.callCount(), 1);
  assert.equal(update.mock.calls[0].arguments[0]["receiptEmailReservation.renderDeadlineAt"].$gt.getTime(), startedAt.getTime() + service.RENDER_DEADLINE_MS);
  update.mock.restore();
});

test("an ambiguous provider outcome remains conservatively reserved instead of creating a delivery record", async () => {
  const record = paymentRecord();
  let reservationState = "rendering";
  const updates = [];
  loadService();
  mock.method(Payment, "findOneAndUpdate", () => ({ select: async () => {
    if (reservationState === "rendering") {
      reservationState = "reserved";
      return record;
    }
    return record;
  } }));
  mock.method(Payment, "findOne", () => chain(record));
  mock.method(Payment, "updateOne", async (query, update) => {
    updates.push({ query, update });
    if (update.$set?.["receiptEmailReservation.state"] === "uncertain") reservationState = "uncertain";
  });
  mock.method(User, "findById", () => ({ select: () => ({ lean: async () => ({ name: "Aye Aye", email: "aye@example.com" }) }) }));
  mock.method(ReceiptDelivery, "countDocuments", async () => 0);
  const create = mock.method(ReceiptDelivery, "create", async () => { throw new Error("must not record"); });
  const emailPath = require.resolve("../services/sendEmail");
  const originalEmail = require.cache[emailPath].exports;
  require.cache[emailPath].exports = async () => { throw new Error("network outcome unknown"); };
  delete require.cache[servicePath];
  const service = require("../services/paymentReceiptService");
  try {
    await assert.rejects(service.selfServiceReceipt(record._id, record.userId), (error) => error.receiptCode === "receipt_uncertain");
    assert.equal(create.mock.callCount(), 0);
    assert.equal(reservationState, "uncertain");
    assert.ok(updates.some(({ update }) => update.$set?.["receiptEmailReservation.state"] === "uncertain"));
  } finally {
    require.cache[emailPath].exports = originalEmail;
  }
});

test("lifetime receipt accounting never resets and remains independent per Payment", async () => {
  const service = loadService();
  const record = paymentRecord();
  mock.method(Payment, "findOneAndUpdate", () => ({ select: async () => record }));
  mock.method(Payment, "updateOne", async () => undefined);
  mock.method(ReceiptDelivery, "countDocuments", async ({ paymentId }) => paymentId === record._id ? 3 : 0);
  await assert.rejects(
    service.reserveReceipt({ paymentId: record._id, userId: record.userId, deliveryType: "self_service", now: new Date("2030-01-01T00:00:00.000Z") }),
    (error) => error.receiptCode === "receipt_limit_reached",
  );
  const permitted = await service.reserveReceipt({ paymentId: "different-payment", userId: record.userId, deliveryType: "self_service", now: new Date("2030-01-01T00:00:00.000Z") });
  assert.equal(permitted.deliveryType, "self_service");
});
