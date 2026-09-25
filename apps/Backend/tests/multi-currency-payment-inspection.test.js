const assert = require("node:assert/strict");
const test = require("node:test");
const {
  classifyFinancialSnapshot,
  classifyPaymentMethodHistory,
  buildInspectionReport,
} = require("../scripts/inspectMultiCurrencyPaymentReadiness");

test("classifies legacy financial snapshots without treating absent fields as zero", () => {
  assert.equal(classifyFinancialSnapshot({}), "missing_all_amounts");
  assert.equal(classifyFinancialSnapshot({ originalAmount: null, discountAmount: null, amount: null }), "missing_all_amounts");
  assert.equal(classifyFinancialSnapshot({ amount: 100 }), "partial_amount_snapshot");
  assert.equal(classifyFinancialSnapshot({ originalAmount: 100, discountAmount: 25, amount: 75 }), "complete_consistent_snapshot");
  assert.equal(classifyFinancialSnapshot({ originalAmount: 100, discountAmount: 25, amount: 70 }), "complete_inconsistent_snapshot");
  assert.equal(classifyFinancialSnapshot({ originalAmount: "not-a-number", discountAmount: 0, amount: 0 }), "invalid_amount_field");
});

test("classifies payment-method history without reconstructing a legacy method", () => {
  assert.equal(classifyPaymentMethodHistory({}), "missing_method_identity_and_snapshot");
  assert.equal(classifyPaymentMethodHistory({ paymentMethodId: "method-id" }), "identity_without_snapshot");
  assert.equal(classifyPaymentMethodHistory({ paymentMethodSnapshot: { name: "Saved method" } }), "snapshot_present");
});

test("inventory report identifies THB fixed-promo migration and QR-history limits", () => {
  const report = buildInspectionReport({
    databaseName: "english_kafe",
    courses: [{ _id: "course-1", title: "Legacy course", price: 3000, originalPrice: 3000, paymentQr: "https://example.test/qr.png" }],
    paymentSettings: [{ _id: "settings-1", key: "global", paymentQr: "https://example.test/global-qr.png" }],
    payments: [{ _id: "payment-1", courseId: "course-1", amount: 2500, originalAmount: 3000, discountAmount: 500, status: "approved" }],
    promos: [{ _id: "promo-1", code: "OLDTHB", discountType: "fixed", discountValue: 500, usageCount: 1 }, { _id: "promo-2", code: "PERCENT", discountType: "percent", discountValue: 10 }],
    paymentMethods: [],
  });
  assert.equal(report.mode, "read-only");
  assert.equal(report.summary.legacyPaymentsMissingCurrency, 1);
  assert.equal(report.summary.legacyPaymentsMissingMethodHistory, 1);
  assert.equal(report.summary.fixedPromosNeedingThbMigration, 1);
  assert.equal(report.summary.paymentMethods, 0);
  assert.equal(report.courses.perCourseQr.count, 1);
  assert.equal(report.globalPaymentSettings.settingsWithQr, 1);
  assert.equal(report.historicalQrLimitations.paymentsWithoutSavedMethodHistory, 1);
  assert.ok(report.thbOnlyReportingAndFormattingPaths.length > 0);
});
