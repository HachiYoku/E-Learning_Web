const test = require("node:test");
const assert = require("node:assert/strict");

const receiptServicePath = require.resolve("../services/paymentReceiptService");
const controllerPath = require.resolve("../controllers/paymentController");
const AuditLog = require("../models/auditLogModel");
require("../services/paymentReceiptService");

function response() {
  return {
    statusCode: 200,
    body: undefined,
    headers: undefined,
    sent: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    set(value) { this.headers = value; return this; },
    send(value) { this.sent = value; return this; },
  };
}

function loadController(receiptService) {
  const original = require.cache[receiptServicePath].exports;
  require.cache[receiptServicePath].exports = {
    prepareApprovalReceipt: async () => null,
    selfServiceReceipt: async () => { throw new Error("not configured"); },
    renderForPayment: async () => null,
    ...receiptService,
  };
  delete require.cache[controllerPath];
  const controller = require("../controllers/paymentController");
  return {
    controller,
    restore() {
      require.cache[receiptServicePath].exports = original;
      delete require.cache[controllerPath];
    },
  };
}

test("receipt self-service is available only to a normal student and uses the authenticated owner ID", async () => {
  const calls = [];
  const loaded = loadController({
    selfServiceReceipt: async (paymentId, userId) => {
      calls.push({ paymentId, userId });
      return { payment: { paymentReference: "PAY-7KQ4M9DX" } };
    },
  });
  try {
    const adminResponse = response();
    await loaded.controller.emailMyReceipt({ params: { paymentId: "payment-one" }, user: { id: "admin-one", role: "admin" } }, adminResponse);
    assert.equal(adminResponse.statusCode, 403);
    assert.equal(calls.length, 0);

    const studentResponse = response();
    await loaded.controller.emailMyReceipt({ params: { paymentId: "payment-one" }, user: { id: "student-one", role: "user" }, body: { email: "other@example.com", amount: 1 } }, studentResponse);
    assert.equal(studentResponse.statusCode, 200);
    assert.deepEqual(calls, [{ paymentId: "payment-one", userId: "student-one" }]);
    assert.deepEqual(studentResponse.body, { message: "Receipt sent", paymentReference: "PAY-7KQ4M9DX" });
  } finally {
    loaded.restore();
  }
});

test("student receipt business restrictions return safe, recognizable API states", async () => {
  const receiptError = new Error("Receipt email limit reached. Contact support if you need another copy.");
  receiptError.status = 429;
  receiptError.receiptCode = "receipt_limit_reached";
  const loaded = loadController({ selfServiceReceipt: async () => { throw receiptError; } });
  try {
    const res = response();
    await loaded.controller.emailMyReceipt({ params: { paymentId: "payment-one" }, user: { id: "student-one", role: "user" } }, res);
    assert.equal(res.statusCode, 429);
    assert.deepEqual(res.body, { message: "Receipt email limit reached. Contact support if you need another copy.", code: "receipt_limit_reached" });
  } finally {
    loaded.restore();
  }
});

test("student receipt renderer failures remain generic to the browser", async () => {
  const loaded = loadController({
    selfServiceReceipt: async () => {
      throw new Error("Chromium executable at /private/student@example.com/receipt.pdf is unavailable");
    },
  });
  try {
    const res = response();
    await loaded.controller.emailMyReceipt({ params: { paymentId: "payment-one" }, user: { id: "student-one", role: "user" } }, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { message: "Receipt is temporarily unavailable. Please try again or contact support." });
    assert.doesNotMatch(res.body.message, /Chromium|student@example\.com|receipt\.pdf/);
  } finally {
    loaded.restore();
  }
});

test("admin receipt PDF generation returns only an in-memory attachment and writes the minimal audit event", async () => {
  const auditEvents = [];
  const originalCreate = AuditLog.create;
  AuditLog.create = async (event) => { auditEvents.push(event); };
  const loaded = loadController({
    renderForPayment: async () => ({
      payment: { _id: "payment-one" },
      filename: "Arun-Thai-Payment-Receipt-PAY-7KQ4M9DX.pdf",
      pdfBuffer: Buffer.from("pdf"),
    }),
  });
  try {
    const res = response();
    await loaded.controller.generateAdminReceiptPdf({ params: { paymentId: "payment-one" }, user: { id: "admin-one", role: "admin" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.sent.toString(), "pdf");
    assert.equal(res.headers["Content-Type"], "application/pdf");
    assert.equal(res.headers["Content-Disposition"], 'attachment; filename="Arun-Thai-Payment-Receipt-PAY-7KQ4M9DX.pdf"');
    assert.equal(auditEvents.length, 1);
    assert.equal(auditEvents[0].actorId, "admin-one");
    assert.equal(auditEvents[0].action, "payment_receipt_generated");
    assert.equal(auditEvents[0].targetType, "payment");
    assert.equal(auditEvents[0].targetId, "payment-one");
    assert.deepEqual(auditEvents[0].metadata, {});
  } finally {
    loaded.restore();
    AuditLog.create = originalCreate;
  }
});

test("failed admin rendering returns no PDF and creates no successful-generation audit event", async () => {
  const auditEvents = [];
  const originalCreate = AuditLog.create;
  AuditLog.create = async (event) => { auditEvents.push(event); };
  const loaded = loadController({ renderForPayment: async () => { throw new Error("renderer unavailable"); } });
  try {
    const res = response();
    await loaded.controller.generateAdminReceiptPdf({ params: { paymentId: "payment-one" }, user: { id: "admin-one", role: "admin" } }, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.sent, undefined);
    assert.deepEqual(auditEvents, []);
  } finally {
    loaded.restore();
    AuditLog.create = originalCreate;
  }
});

test("admin receipt PDF is not returned when required audit persistence fails", async () => {
  const originalCreate = AuditLog.create;
  AuditLog.create = async () => { throw new Error("audit storage unavailable"); };
  const loaded = loadController({
    renderForPayment: async () => ({ payment: { _id: "payment-one" }, filename: "Arun-Thai-Payment-Receipt-PAY-7KQ4M9DX.pdf", pdfBuffer: Buffer.from("pdf") }),
  });
  try {
    const res = response();
    await loaded.controller.generateAdminReceiptPdf({ params: { paymentId: "payment-one" }, user: { id: "admin-one", role: "admin" } }, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.sent, undefined);
  } finally {
    loaded.restore();
    AuditLog.create = originalCreate;
  }
});
