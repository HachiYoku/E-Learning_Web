const Course = require("../models/courseModel");
const Payment = require("../models/paymentModel");
const User = require("../models/userModel");

function getStartDate(days) {
  if (![7, 30, 90].includes(days)) {
    return null;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return startDate;
}

function getDateRange(query) {
  const requestedDays = Number(query.days);
  const startDate = query.startDate ? new Date(`${query.startDate}T00:00:00.000Z`) : getStartDate(requestedDays);
  const endDate = query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : null;

  if (startDate && Number.isNaN(startDate.getTime())) return null;
  if (endDate && Number.isNaN(endDate.getTime())) return null;
  if (startDate && endDate && startDate > endDate) return null;

  return { startDate, endDate };
}

function getEventDateMatch(createdAt) {
  if (!createdAt) return {};
  return { $or: [{ status: "approved", reviewedAt: createdAt }, { status: { $ne: "approved" }, createdAt }] };
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

const exportReportCsv = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    if (!dateRange) return res.status(400).json({ message: "Invalid report date range" });

    const { startDate, endDate } = dateRange;
    const createdAt = startDate || endDate ? { ...(startDate ? { $gte: startDate } : {}), ...(endDate ? { $lte: endDate } : {}) } : undefined;
    const paymentMatch = createdAt ? getEventDateMatch(createdAt) : {};
    const type = req.query.type || "payments";
    let headers;
    let rows;

    if (type === "users") {
      const users = await User.find({ role: "user", isVerified: true, ...(createdAt ? { createdAt } : {}) }).select("name email createdAt isActive").lean();
      headers = ["Name", "Email", "Date joined", "Active"];
      rows = users.map((user) => [user.name, user.email, user.createdAt?.toISOString(), user.isActive ? "Yes" : "No"]);
    } else if (type === "courses") {
      const courses = await Course.find().select("title price isPublished enrollmentCount").lean();
      headers = ["Course", "Price", "Published", "Enrolments"];
      rows = courses.map((course) => [course.title, course.price, course.isPublished ? "Yes" : "No", course.enrollmentCount || 0]);
    } else if (type === "payments") {
      const payments = await Payment.find(paymentMatch).populate("userId", "name email").populate("courseId", "title price").sort({ createdAt: -1 }).lean();
      headers = ["Date", "User", "Email", "Course", "Amount", "Fee", "Refund", "Status"];
      rows = payments.map((payment) => [payment.status === "approved" && payment.reviewedAt ? payment.reviewedAt.toISOString() : payment.createdAt.toISOString(), payment.userId?.name, payment.userId?.email, payment.courseId?.title, payment.amount ?? payment.courseId?.price ?? 0, payment.fee || 0, payment.refundAmount || 0, payment.status]);
    } else {
      return res.status(400).json({ message: "Unsupported report export type" });
    }

    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${type}-report.csv`);
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getReportSummary = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    if (!dateRange) {
      return res.status(400).json({ message: "Invalid report date range" });
    }

    const { startDate, endDate } = dateRange;
    const createdAt = startDate || endDate ? { ...(startDate ? { $gte: startDate } : {}), ...(endDate ? { $lte: endDate } : {}) } : undefined;
    const paymentMatch = createdAt ? getEventDateMatch(createdAt) : {};
    const userMatch = { role: "user", isVerified: true, ...(createdAt ? { createdAt } : {}) };

    const [paymentSummary, statusCounts, coursePerformance, userCount, publishedCourseCount] = await Promise.all([
      Payment.aggregate([
        { $match: { ...paymentMatch, status: "approved" } },
        { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
        { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, grossRevenue: { $sum: { $ifNull: ["$amount", { $ifNull: ["$course.price", 0] }] } }, fees: { $sum: { $ifNull: ["$fee", 0] } }, refunds: { $sum: { $ifNull: ["$refundAmount", 0] } }, approvedPayments: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: paymentMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { ...paymentMatch, status: "approved" } },
        { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
        { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
        { $group: { _id: "$courseId", courseName: { $first: { $ifNull: ["$course.title", "Unknown course"] } }, count: { $sum: 1 }, revenue: { $sum: { $ifNull: ["$amount", { $ifNull: ["$course.price", 0] }] } } } },
        { $sort: { revenue: -1 } },
        { $project: { _id: 0, courseName: 1, count: 1, revenue: 1 } },
      ]),
      User.countDocuments(userMatch),
      Course.countDocuments({ isPublished: true }),
    ]);

    const pendingPayment = await Payment.findOne({ ...paymentMatch, status: "pending" }).sort({ createdAt: 1 }).select("createdAt").lean();

    const trendStart = new Date();
    trendStart.setHours(0, 0, 0, 0);
    trendStart.setDate(trendStart.getDate() - 6);
    const trendPayments = await Payment.aggregate([
      { $match: { status: "approved", createdAt: { $gte: trendStart } } },
      { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
      { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: { $ifNull: ["$amount", { $ifNull: ["$course.price", 0] }] } } } },
      { $sort: { _id: 1 } },
    ]);

    const revenueByDate = new Map(trendPayments.map((item) => [item._id, item.revenue]));
    const revenueTrend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(trendStart);
      date.setDate(date.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, revenue: revenueByDate.get(key) || 0 };
    });

    return res.status(200).json({
      period: startDate || endDate ? (req.query.days || "custom") : "all",
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      grossRevenue: paymentSummary[0]?.grossRevenue || 0,
      fees: paymentSummary[0]?.fees || 0,
      refunds: paymentSummary[0]?.refunds || 0,
      revenue: Math.max(0, (paymentSummary[0]?.grossRevenue || 0) - (paymentSummary[0]?.fees || 0) - (paymentSummary[0]?.refunds || 0)),
      approvedPayments: paymentSummary[0]?.approvedPayments || 0,
      userCount,
      publishedCourseCount,
      pendingPayment: pendingPayment ? { createdAt: pendingPayment.createdAt } : null,
      statusCounts: statusCounts.reduce((result, item) => ({ ...result, [item._id]: item.count }), {}),
      coursePerformance,
      revenueTrend,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { getReportSummary, exportReportCsv };
