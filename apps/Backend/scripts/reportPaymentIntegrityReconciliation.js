// Read-only production reconciliation report. This script deliberately uses
// only find operations; it contains no migration, update, delete or insert.
require("dotenv").config({ quiet: true });
const { MongoClient } = require("mongoose").mongo;
const { assertPaymentIntegrityDatabase } = require("./paymentIntegrityDatabaseGuard");

const id = (value) => value == null ? null : String(value);
const date = (value) => value ?? null;

function paymentView(payment) {
  if (!payment) return null;
  return {
    paymentId: id(payment._id), userId: id(payment.userId), courseId: id(payment.courseId),
    status: payment.status ?? null, promoCode: payment.promoCode ?? null,
    promoRedemptionId: id(payment.promoRedemptionId), amount: payment.amount ?? null,
    originalAmount: payment.originalAmount ?? null, discountAmount: payment.discountAmount ?? null,
    createdAt: date(payment.createdAt), reviewedAt: date(payment.reviewedAt), reviewedBy: id(payment.reviewedBy),
    proofPresent: Boolean(payment.paymentProofPublicId || payment.paymentImagePublicId || payment.paymentImage),
    proofStorage: payment.paymentProofStorage ?? (payment.paymentImage ? "legacy" : null),
    courseSnapshot: payment.courseSnapshot ? {
      title: payment.courseSnapshot.title ?? null, price: payment.courseSnapshot.price ?? null,
    } : null,
  };
}

function redemptionView(redemption) {
  if (!redemption) return null;
  return {
    redemptionId: id(redemption._id), promoId: id(redemption.promoCode), userId: id(redemption.userId),
    paymentId: id(redemption.paymentId), active: redemption.active ?? null,
    createdAt: date(redemption.createdAt), releasedAt: date(redemption.releasedAt),
    releaseReason: redemption.releaseReason ?? null,
  };
}

function userView(user) {
  if (!user) return null;
  return {
    userId: id(user._id), name: user.name ?? null, email: user.email ?? null,
    role: user.role ?? null, isActive: user.isActive ?? null, createdAt: date(user.createdAt),
  };
}

function courseView(course) {
  if (!course) return { exists: false };
  return { exists: true, courseId: id(course._id), title: course.title ?? null, price: course.price ?? null, isPublished: course.isPublished ?? null, createdAt: date(course.createdAt) };
}

function auditView(log) {
  if (!log) return null;
  // Whitelist operational fields; audit metadata can otherwise include user PII.
  const metadata = {};
  for (const key of ["code", "userId", "courseId", "amount", "addedCourseIds", "removedCourseIds"]) {
    if (log.metadata?.[key] !== undefined) metadata[key] = log.metadata[key];
  }
  return { auditId: id(log._id), action: log.action, targetType: log.targetType, targetId: id(log.targetId), actorId: id(log.actorId), metadata, createdAt: date(log.createdAt) };
}

function notificationView(notification) {
  return { notificationId: id(notification._id), type: notification.type, title: notification.title, courseId: id(notification.courseId), isRead: notification.isRead, createdAt: date(notification.createdAt) };
}

function promoView(promo) {
  if (!promo) return null;
  return {
    promoId: id(promo._id), code: promo.code, discountType: promo.discountType ?? null,
    discountValue: promo.discountValue ?? null, usageCount: promo.usageCount ?? null,
    usageLimit: promo.usageLimit ?? null, isActive: promo.isActive ?? null,
    archivedAt: date(promo.archivedAt), createdAt: date(promo.createdAt),
  };
}

async function evidenceFor({ payment, redemption, payments, users, courses, enrollments, auditlogs, notifications }) {
  const user = payment ? await users.findOne({ _id: payment.userId }, { projection: { name: 1, email: 1, role: 1, isActive: 1, createdAt: 1 } }) : null;
  const course = payment ? await courses.findOne({ _id: payment.courseId }, { projection: { title: 1, price: 1, isPublished: 1, createdAt: 1 } }) : null;
  const enrollment = payment ? await enrollments.findOne({ userId: payment.userId, courseId: payment.courseId }) : null;
  const sameUserCoursePayments = payment ? await paymentsForUserCourse(payment, payments) : [];
  const ids = [payment?._id, redemption?._id, redemption?.promoCode, payment?.userId, payment?.courseId].filter(Boolean);
  const codes = [payment?.promoCode].filter(Boolean);
  const audit = await auditlogs.find({ $or: [
    { targetId: { $in: ids } },
    ...(codes.length ? [{ "metadata.code": { $in: codes } }] : []),
  ] }).sort({ createdAt: 1 }).toArray();
  const relevantNotifications = payment ? await notifications.find({
    userId: payment.userId,
    courseId: payment.courseId,
    type: { $in: ["payment", "enrollment"] },
  }).sort({ createdAt: 1 }).toArray() : [];
  return {
    payment: paymentView(payment), redemption: redemptionView(redemption), user: userView(user),
    course: courseView(course), currentEnrollment: enrollment ? { enrollmentId: id(enrollment._id), paymentId: id(enrollment.paymentId), createdAt: date(enrollment.createdAt), updatedAt: date(enrollment.updatedAt) } : null,
    otherPaymentsForSameUserAndCourse: sameUserCoursePayments.filter((item) => String(item._id) !== String(payment?._id)).map(paymentView),
    auditLogs: audit.map(auditView), notifications: relevantNotifications.map(notificationView),
  };
}

async function paymentsForUserCourse(payment, payments) {
  if (!payment) return [];
  return payments.find({ userId: payment.userId, courseId: payment.courseId }).sort({ createdAt: 1 }).toArray();
}

async function main() {
  if (!process.argv.includes("--read-only")) {
    throw new Error("Pass --read-only to acknowledge that this produces a production reconciliation report without modifying data.");
  }
  if (!process.env.MONGO_DB) throw new Error("MONGO_DB is required.");
  const client = new MongoClient(process.env.MONGO_DB, { readPreference: "primary", readConcern: { level: "majority" } });
  await client.connect();
  try {
    const db = client.db();
    assertPaymentIntegrityDatabase(db);
    const redemptions = db.collection("promoredemptions");
    const payments = db.collection("payments");
    const promos = db.collection("promocodes");
    const users = db.collection("users");
    const courses = db.collection("courses");
    const enrollments = db.collection("enrollments");
    const auditlogs = db.collection("auditlogs");
    const notifications = db.collection("notifications");
    const allRedemptions = await redemptions.find({}).toArray();
    const promotionIds = allRedemptions.map((item) => item.promoCode).filter(Boolean);
    const promotions = new Map((await promos.find({ _id: { $in: promotionIds } }).toArray()).map((item) => [String(item._id), item]));
    const redemptionById = new Map(allRedemptions.map((item) => [String(item._id), item]));
    const missingPromoCases = [];
    const validRedemptionIds = [];

    for (const redemption of allRedemptions) {
      const payment = await payments.findOne({ promoRedemptionId: redemption._id }) || (redemption.paymentId ? await payments.findOne({ _id: redemption.paymentId }) : null);
      const promo = promotions.get(String(redemption.promoCode));
      const valid = payment && ["pending", "approved", "rejected"].includes(payment.status)
        && String(payment.userId) === String(redemption.userId) && promo
        && payment.promoCode === promo.code && String(payment.promoRedemptionId) === String(redemption._id);
      if (valid) validRedemptionIds.push(redemption._id);
      if (!promo) {
        missingPromoCases.push({
          reason: "missing_promo",
          ...await evidenceFor({ payment, redemption, payments, users, courses, enrollments, auditlogs, notifications }),
        });
      }
    }

    const missingEvidencePayments = await payments.find({ promoRedemptionId: { $ne: null, $nin: validRedemptionIds } }).toArray();
    const approvedWithoutEnrollment = [];
    for await (const payment of payments.find({ status: "approved" })) {
      if (!await enrollments.findOne({ userId: payment.userId, courseId: payment.courseId })) {
        approvedWithoutEnrollment.push(await evidenceFor({ payment, redemption: redemptionById.get(String(payment.promoRedemptionId)), payments, users, courses, enrollments, auditlogs, notifications }));
      }
    }
    const welcomeRejected = [];
    for (const payment of missingEvidencePayments.filter((item) => item.promoCode === "WELCOME01" && item.status === "rejected")) {
      welcomeRejected.push(await evidenceFor({ payment, redemption: redemptionById.get(String(payment.promoRedemptionId)), payments, users, courses, enrollments, auditlogs, notifications }));
    }
    const promoCodeInvestigations = [];
    for (const code of ["HAPPY28", "WELCOME01"]) {
      const promo = await promos.findOne({ code });
      const codePayments = await payments.find({ promoCode: code }).sort({ createdAt: 1 }).toArray();
      const redemptionIds = codePayments.map((payment) => payment.promoRedemptionId).filter(Boolean);
      const codeRedemptions = await redemptions.find({ $or: [
        ...(promo ? [{ promoCode: promo._id }] : []),
        ...(redemptionIds.length ? [{ _id: { $in: redemptionIds } }] : []),
      ] }).sort({ createdAt: 1 }).toArray();
      const promoAuditLogs = await auditlogs.find({ $or: [
        ...(promo ? [{ targetId: promo._id }] : []),
        { "metadata.code": code },
      ] }).sort({ createdAt: 1 }).toArray();
      promoCodeInvestigations.push({
        code, promo: promoView(promo), redemptions: codeRedemptions.map(redemptionView),
        payments: await Promise.all(codePayments.map((payment) => evidenceFor({ payment, redemption: redemptionById.get(String(payment.promoRedemptionId)), payments, users, courses, enrollments, auditlogs, notifications }))),
        promoAuditLogs: promoAuditLogs.map(auditView),
      });
    }
    const report = {
      mode: "read-only", database: db.databaseName,
      generatedAt: new Date().toISOString(),
      factsOnly: true,
      summary: {
        missingPromoRedemptions: missingPromoCases.length,
        paymentsWithMissingOrIncompleteRedemptionEvidence: missingEvidencePayments.length,
        approvedWithoutEnrollment: approvedWithoutEnrollment.length,
      },
      promoCodeInvestigations,
      missingPromoRedemptions: missingPromoCases,
      rejectedWelcome01Cases: welcomeRejected,
      paymentsWithMissingOrIncompleteRedemptionEvidence: await Promise.all(missingEvidencePayments.map((payment) => evidenceFor({ payment, redemption: redemptionById.get(String(payment.promoRedemptionId)), payments, users, courses, enrollments, auditlogs, notifications }))),
      approvedWithoutEnrollment,
      limitations: [
        "No enrollment history collection exists; this reports only the current enrollment document and matching audit logs.",
        "Absence of an audit log does not prove an action did not occur because audit logging is best-effort and may predate the action.",
        "This report cannot prove whether a record came from a development/test/manual database operation unless persisted audit or record evidence explicitly says so.",
      ],
    };
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
