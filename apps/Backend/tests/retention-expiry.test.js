const assert = require("node:assert/strict");
const { mock, test } = require("node:test");
const AuditLog = require("../models/auditLogModel");
const ContactEnquiry = require("../models/contactEnquiryModel");
const ContactLead = require("../models/contactLeadModel");
const Payment = require("../models/paymentModel");
const {
  SIX_MONTH_ACTIONS,
  TWELVE_MONTH_ACTIONS,
  UnclassifiedAuditActionError,
  buildAuditLogEntry,
  retentionMonthsForAuditAction,
  writeAuditLog,
} = require("../services/auditLogger");
const { deletionAuditEntry } = require("../services/studentAccountDeletion");

const indexFor = (Model, key) => Model.schema.indexes().find(([fields]) => JSON.stringify(fields) === JSON.stringify(key));

test("ContactEnquiry has one 12-month TTL index and ContactLead has no expiry index", () => {
  const [, options] = indexFor(ContactEnquiry, { submittedAt: 1 });
  assert.equal(options.expireAfterSeconds, 365 * 24 * 60 * 60);
  assert.equal(ContactLead.schema.indexes().some(([, options]) => options.expireAfterSeconds != null), false);
});

test("AuditLog has an absolute expiresAt TTL index without affecting Payment records", () => {
  const [, options] = indexFor(AuditLog, { expiresAt: 1 });
  assert.equal(options.expireAfterSeconds, 0);
  assert.equal(Payment.schema.indexes().some(([, paymentOptions]) => paymentOptions.expireAfterSeconds != null), false);
});

test("all currently emitted audit actions have an explicit retention classification", () => {
  const emittedActions = [
    "announcement.deleted", "student_feedback.published", "student_feedback.not_selected", "student_feedback.removed_from_website",
    "course.deleted", "promo.created", "promo.updated", "promo.archived", "promo.deleted",
    "payment_method.created", "payment_method.updated", "payment_method.activated", "payment_method.deactivated", "payment_method.deactivated_with_history", "payment_method.deleted",
    "payment.approved", "payment.rejected", "user.activated", "user.deactivated", "user.course_access_updated", "user.self_deleted", "user.deleted",
  ];
  for (const action of emittedActions) assert.ok(SIX_MONTH_ACTIONS.has(action) || TWELVE_MONTH_ACTIONS.has(action), action);
  assert.equal(emittedActions.length, SIX_MONTH_ACTIONS.size + TWELVE_MONTH_ACTIONS.size);
});

test("audit retention uses calendar-month expiry and rejects unknown actions", () => {
  const createdAt = new Date("2024-08-31T12:00:00.000Z");
  const sixMonth = buildAuditLogEntry({ actorId: "actor", action: "announcement.deleted", targetType: "announcement", targetId: "target" }, createdAt);
  const twelveMonth = buildAuditLogEntry({ actorId: "actor", action: "user.deleted", targetType: "user", targetId: "target" }, createdAt);
  assert.equal(sixMonth.expiresAt.toISOString(), "2025-02-28T12:00:00.000Z");
  assert.equal(twelveMonth.expiresAt.toISOString(), "2025-08-31T12:00:00.000Z");
  assert.throws(() => retentionMonthsForAuditAction("unexpected.action"), UnclassifiedAuditActionError);
});

test("generic and direct student-deletion events receive centrally generated expiry", async () => {
  const untrustedExpiry = new Date("2099-01-01T00:00:00.000Z");
  const generic = buildAuditLogEntry({ actorId: "actor", action: "payment.approved", targetType: "payment", targetId: "payment", expiresAt: untrustedExpiry });
  const deletion = deletionAuditEntry({ actorId: "admin", initiatedBy: "admin", studentId: "student" });
  let persisted;
  const create = mock.method(AuditLog, "create", async (entry) => { persisted = entry; });
  await writeAuditLog({ actorId: "actor", action: "announcement.deleted", targetType: "announcement", targetId: "announcement", expiresAt: untrustedExpiry });
  create.mock.restore();

  assert.equal(generic.expiresAt.getTime() === untrustedExpiry.getTime(), false);
  assert.equal(persisted.action, "announcement.deleted");
  assert.equal(persisted.expiresAt.getTime() === untrustedExpiry.getTime(), false);
  assert.equal(deletion.action, "user.deleted");
  assert.equal(retentionMonthsForAuditAction(deletion.action), 12);
  assert.ok(deletion.expiresAt > deletion.createdAt);
});
