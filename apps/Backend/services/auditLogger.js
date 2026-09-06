const AuditLog = require("../models/auditLogModel");

async function writeAuditLog({ actorId, action, targetType, targetId, metadata = {} }) {
  try {
    await AuditLog.create({ actorId, action, targetType, targetId, metadata });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

module.exports = { writeAuditLog };
