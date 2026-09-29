const assert = require("node:assert/strict");
const test = require("node:test");
const {
  __testables: {
    makeRevenueBuckets,
    paymentCourseTitle,
    paymentCurrency,
    paymentFinalAmount,
    paymentMethodName,
    paymentOriginalAmount,
  },
} = require("../controllers/reportController");
const reportController = require("../controllers/reportController");
const Payment = require("../models/paymentModel");
const Course = require("../models/courseModel");
const User = require("../models/userModel");

test("reporting keeps THB and MMK monetary values in separate buckets", () => {
  const buckets = makeRevenueBuckets([
    { _id: "THB", grossRevenue: 3900, fees: 100, refunds: 0, approvedPayments: 1 },
    { _id: "MMK", grossRevenue: 120000, fees: 2000, refunds: 1000, approvedPayments: 2 },
  ]);
  assert.deepEqual(buckets.THB, { grossRevenue: 3900, fees: 100, refunds: 0, netRevenue: 3800, approvedPayments: 1, averagePayment: 3900 });
  assert.deepEqual(buckets.MMK, { grossRevenue: 120000, fees: 2000, refunds: 1000, netRevenue: 117000, approvedPayments: 2, averagePayment: 60000 });
  assert.equal(Object.hasOwn(buckets, "totalRevenue"), false);
});

test("legacy payments without a currency stay in the THB reporting bucket", () => {
  assert.equal(paymentCurrency({}), "THB");
});

test("report exports use immutable saved course, method and financial payment fields", () => {
  const payment = {
    currency: "MMK",
    amount: 120000,
    originalAmount: 130000,
    courseSnapshot: { title: "Course at purchase", price: 130000 },
    paymentMethodSnapshot: { name: "Saved KBZPay" },
    courseId: { title: "Renamed course", price: 999 },
  };
  assert.equal(paymentCourseTitle(payment), "Course at purchase");
  assert.equal(paymentMethodName(payment), "Saved KBZPay");
  assert.equal(paymentOriginalAmount(payment), 130000);
  assert.equal(paymentFinalAmount(payment), 120000);
});

test("summary response exposes currency-scoped trend, course revenue and averages without a mixed total", async () => {
  const original = { aggregate: Payment.aggregate, userCount: User.countDocuments, courseCount: Course.countDocuments };
  const aggregateResults = [
    [{ _id: "approved", count: 3 }],
    [
      { _id: "THB", grossRevenue: 3900, fees: 0, refunds: 0, approvedPayments: 1 },
      { _id: "MMK", grossRevenue: 120000, fees: 0, refunds: 0, approvedPayments: 2 },
    ],
    [{ currency: "MMK", courseId: "course-1", courseName: "Saved course", revenue: 120000, payments: 2 }],
    [{ date: "2026-09-26", currency: "MMK", revenue: 120000, payments: 2 }],
  ];
  Payment.aggregate = async () => aggregateResults.shift();
  User.countDocuments = async () => 4;
  Course.countDocuments = async () => 2;
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await reportController.getReportSummary({ query: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.revenueByCurrency.THB.grossRevenue, 3900);
    assert.equal(response.body.revenueByCurrency.MMK.averagePayment, 60000);
    assert.deepEqual(response.body.coursePerformance, [{ currency: "MMK", courseId: "course-1", courseName: "Saved course", revenue: 120000, payments: 2 }]);
    assert.deepEqual(response.body.revenueTrend, [{ date: "2026-09-26", currency: "MMK", revenue: 120000, payments: 2 }]);
    assert.equal(Object.hasOwn(response.body, "revenue"), false);
    assert.equal(Object.hasOwn(response.body, "grossRevenue"), false);
  } finally {
    Payment.aggregate = original.aggregate;
    User.countDocuments = original.userCount;
    Course.countDocuments = original.courseCount;
  }
});
