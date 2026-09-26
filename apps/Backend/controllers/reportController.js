const User = require("../models/userModel");
const Course = require("../models/courseModel");
const Payment = require("../models/paymentModel");

const SUPPORTED_CURRENCIES = ["THB", "MMK"];

const getDateRange = (query) => {
  const requestedDays = Number(query.days);
  const startDate = query.startDate ? new Date(`${query.startDate}T00:00:00.000Z`) : ([7, 30, 90].includes(requestedDays) ? new Date(Date.now() - requestedDays * 24 * 60 * 60 * 1000) : null);
  const endDate = query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : null;
  if (startDate && Number.isNaN(startDate.getTime())) return null;
  if (endDate && Number.isNaN(endDate.getTime())) return null;
  if (startDate && endDate && startDate > endDate) return null;
  return { startDate, endDate };
};

const rangeMatch = (startDate, endDate) =>
  startDate || endDate ? { createdAt: { ...(startDate ? { $gte: startDate } : {}), ...(endDate ? { $lte: endDate } : {}) } } : {};

const toCsv = (res, filename, fields, data) => {
  const value = (field, row) => typeof field.value === "function" ? field.value(row) : row[field.value];
  const escape = (item) => `"${String(item ?? "").replace(/"/g, '""')}"`;
  const csv = [fields.map((field) => escape(field.label)), ...data.map((row) => fields.map((field) => escape(value(field, row))))]
    .map((row) => row.join(","))
    .join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.status(200).send(`\uFEFF${csv}`);
};

const paymentCurrency = (payment) => payment.currency || "THB";
const paymentCourseTitle = (payment) =>
  payment.courseSnapshot?.title || payment.courseId?.title || "Unknown course";
const paymentMethodName = (payment) =>
  payment.paymentMethodSnapshot?.name || "Uploaded transfer slip";
const paymentFinalAmount = (payment) => {
  const value = payment.amount ?? payment.courseSnapshot?.price ?? payment.courseId?.price ?? 0;
  return Number(value || 0);
};
const paymentOriginalAmount = (payment) => {
  const value =
    payment.originalAmount ??
    payment.courseSnapshot?.originalPrice ??
    payment.courseSnapshot?.price ??
    payment.courseId?.price ??
    payment.amount ??
    0;
  return Number(value || 0);
};

const paymentAmountExpression = {
  $ifNull: ["$amount", { $ifNull: ["$courseSnapshot.price", "$course.price"] }],
};
const paymentCurrencyExpression = { $ifNull: ["$currency", "THB"] };
const paymentCourseTitleExpression = {
  $ifNull: ["$courseSnapshot.title", { $ifNull: ["$course.title", "Unknown course"] }],
};

const emptyRevenueBucket = () => ({
  grossRevenue: 0,
  fees: 0,
  refunds: 0,
  netRevenue: 0,
  approvedPayments: 0,
  averagePayment: 0,
});

const makeRevenueBuckets = (rows) => {
  const buckets = Object.fromEntries(SUPPORTED_CURRENCIES.map((currency) => [currency, emptyRevenueBucket()]));
  rows.forEach((row) => {
    const currency = SUPPORTED_CURRENCIES.includes(row._id) ? row._id : "THB";
    const grossRevenue = Number(row.grossRevenue || 0);
    const fees = Number(row.fees || 0);
    const refunds = Number(row.refunds || 0);
    const approvedPayments = Number(row.approvedPayments || 0);
    buckets[currency] = {
      grossRevenue,
      fees,
      refunds,
      netRevenue: grossRevenue - fees - refunds,
      approvedPayments,
      averagePayment: approvedPayments ? grossRevenue / approvedPayments : 0,
    };
  });
  return buckets;
};

const exportReportCsv = async (req, res) => {
  try {
    const { type = "payments" } = req.query;
    const dateRange = getDateRange(req.query);
    if (!dateRange) return res.status(400).json({ message: "Invalid report date range" });
    const dateMatch = rangeMatch(dateRange.startDate, dateRange.endDate);

    if (type === "users") {
      const users = await User.find({ role: "user", isVerified: true, ...dateMatch }).select("name email role createdAt isActive").lean();
      return toCsv(res, "users-report.csv", [
        { label: "Name", value: "name" },
        { label: "Email", value: "email" },
        { label: "Role", value: "role" },
        { label: "Joined", value: (row) => row.createdAt?.toISOString() || "" },
        { label: "Status", value: (row) => (row.isActive ? "Active" : "Inactive") },
      ], users);
    }

    if (type === "courses") {
      const courses = await Course.find().select("title price originalPrice prices isPublished enrollmentCount").lean();
      return toCsv(res, "courses-report.csv", [
        { label: "Course", value: "title" },
        { label: "THB Price", value: (row) => row.prices?.THB?.price ?? row.price ?? "" },
        { label: "THB Original Price", value: (row) => row.prices?.THB?.originalPrice ?? row.originalPrice ?? "" },
        { label: "MMK Price", value: (row) => row.prices?.MMK?.price ?? "" },
        { label: "MMK Original Price", value: (row) => row.prices?.MMK?.originalPrice ?? "" },
        { label: "Published", value: (row) => (row.isPublished ? "Yes" : "No") },
        { label: "Enrollments", value: (row) => row.enrollmentCount || 0 },
      ], courses);
    }

    const payments = await Payment.find(dateMatch)
      .populate("userId", "name email")
      .populate("courseId", "title price")
      .select("userId courseId courseSnapshot paymentMethodSnapshot currency originalAmount discountAmount amount promoCode status createdAt reviewedAt fee refundAmount")
      .lean();
    return toCsv(res, "payments-report.csv", [
      { label: "Submitted", value: (row) => row.createdAt?.toISOString() || "" },
      { label: "Reviewed", value: (row) => row.reviewedAt?.toISOString() || "" },
      { label: "Student", value: (row) => row.userId?.name || "Unknown student" },
      { label: "Email", value: (row) => row.userId?.email || "" },
      { label: "Course", value: paymentCourseTitle },
      { label: "Currency", value: paymentCurrency },
      { label: "Original Amount", value: paymentOriginalAmount },
      { label: "Discount Amount", value: (row) => Number(row.discountAmount || 0) },
      { label: "Final Amount", value: paymentFinalAmount },
      { label: "Promo Code", value: (row) => row.promoCode || "" },
      { label: "Payment Method", value: paymentMethodName },
      { label: "Fee", value: (row) => Number(row.fee || 0) },
      { label: "Refund", value: (row) => Number(row.refundAmount || 0) },
      { label: "Status", value: "status" },
    ], payments);
  } catch (error) {
    res.status(500).json({ message: "Unable to export report." });
  }
};

const getReportSummary = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    if (!dateRange) return res.status(400).json({ message: "Invalid report date range" });
    const { startDate, endDate } = dateRange;
    const paymentDateMatch = rangeMatch(startDate, endDate);

    const [userCount, courseCount, paymentStatusCounts, revenueRows, coursePerformance, revenueTrend] = await Promise.all([
      User.countDocuments({ role: "user", isVerified: true, ...paymentDateMatch }),
      Course.countDocuments({ isPublished: true }),
      Payment.aggregate([
        { $match: paymentDateMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { ...paymentDateMatch, status: "approved" } },
        { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
        { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: paymentCurrencyExpression,
          grossRevenue: { $sum: paymentAmountExpression },
          fees: { $sum: { $ifNull: ["$fee", 0] } },
          refunds: { $sum: { $ifNull: ["$refundAmount", 0] } },
          approvedPayments: { $sum: 1 },
        } },
      ]),
      Payment.aggregate([
        { $match: { ...paymentDateMatch, status: "approved" } },
        { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
        { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { currency: paymentCurrencyExpression, courseId: "$courseId" },
          courseName: { $first: paymentCourseTitleExpression },
          revenue: { $sum: paymentAmountExpression },
          payments: { $sum: 1 },
        } },
        { $project: { _id: 0, currency: "$_id.currency", courseId: "$_id.courseId", courseName: 1, revenue: 1, payments: 1 } },
        { $sort: { currency: 1, revenue: -1 } },
      ]),
      Payment.aggregate([
        { $match: { ...paymentDateMatch, status: "approved" } },
        { $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            currency: paymentCurrencyExpression,
          },
          revenue: { $sum: paymentAmountExpression },
          payments: { $sum: 1 },
        } },
        { $project: { _id: 0, date: "$_id.date", currency: "$_id.currency", revenue: 1, payments: 1 } },
        { $sort: { date: 1, currency: 1 } },
      ]),
    ]);

    const paymentCounts = paymentStatusCounts.reduce((counts, row) => {
      counts[row._id || "unknown"] = row.count;
      return counts;
    }, {});

    return res.json({
      period: startDate || endDate ? (req.query.days || "custom") : "all",
      startDate: startDate?.toISOString() || null,
      endDate: endDate?.toISOString() || null,
      // Counts remain cross-currency safe because they are not money.
      userCount,
      publishedCourseCount: courseCount,
      statusCounts: paymentCounts,
      revenueByCurrency: makeRevenueBuckets(revenueRows),
      coursePerformance,
      revenueTrend,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load report summary." });
  }
};

exports.exportReportCsv = exportReportCsv;
exports.getReportSummary = getReportSummary;

exports.__testables = {
  makeRevenueBuckets,
  paymentCurrency,
  paymentCourseTitle,
  paymentMethodName,
  paymentFinalAmount,
  paymentOriginalAmount,
};
