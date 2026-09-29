const AuditLog = require("../models/auditLogModel");

const SIX_MONTH_ACTIONS = new Set([
  "announcement.deleted",
  "student_feedback.published",
  "student_feedback.not_selected",
  "student_feedback.removed_from_website",
]);

const TWELVE_MONTH_ACTIONS = new Set([
  "course.deleted",
  "promo.created",
  "promo.updated",
  "promo.archived",
  "promo.deleted",
  "payment_method.created",
  "payment_method.updated",
  "payment_method.activated",
  "payment_method.deactivated",
  "payment_method.deactivated_with_history",
  "payment_method.deleted",
  "payment.approved",
  "payment.rejected",
  "user.activated",
  "user.deactivated",
  "user.course_access_updated",
  "user.self_deleted",
  "user.deleted",
]);

class UnclassifiedAuditActionError extends Error {
  constructor(action) {
    super(`Audit action is not classified for retention: ${action}`);
    this.name = "UnclassifiedAuditActionError";
  }
}

function retentionMonthsForAuditAction(action) {
  if (SIX_MONTH_ACTIONS.has(action)) return 6;
  if (TWELVE_MONTH_ACTIONS.has(action)) return 12;
  throw new UnclassifiedAuditActionError(action);
}

function addCalendarMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function buildAuditLogEntry({ actorId, action, targetType, targetId, metadata = {} }, createdAt = new Date()) {
  const eventCreatedAt = new Date(createdAt);
  return {
    actorId,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: eventCreatedAt,
    expiresAt: addCalendarMonths(eventCreatedAt, retentionMonthsForAuditAction(action)),
  };
}

async function writeAuditLog(event) {
  const entry = buildAuditLogEntry(event);
  try {
    await AuditLog.create(entry);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

module.exports = {
  SIX_MONTH_ACTIONS,
  TWELVE_MONTH_ACTIONS,
  UnclassifiedAuditActionError,
  addCalendarMonths,
  buildAuditLogEntry,
  retentionMonthsForAuditAction,
  writeAuditLog,
};
