const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const ContactLead = require("../models/contactLeadModel");
const ContactEnquiry = require("../models/contactEnquiryModel");

const CLAIM_MS = 5 * 60 * 1000;
const addCalendarYears = (date, years) => { const result = new Date(date); const day = result.getDate(); result.setDate(1); result.setFullYear(result.getFullYear() + years); result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate())); return result; };

async function contactTransaction(work) {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") throw Object.assign(new Error("Contact processing requires a transaction-capable database."), { status: 503 });
  return mongoose.connection.transaction(work, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
}
function claim(now, operation) { return { token: randomUUID(), operation, claimedAt: now, expiresAt: new Date(now.getTime() + CLAIM_MS) }; }
async function acquireLeadClaim(id, operation, now = new Date()) {
  const value = claim(now, operation);
  const lead = await ContactLead.findOneAndUpdate({ _id: id, "operationClaim.token": { $exists: false } }, { $set: { operationClaim: value } }, { returnDocument: "after" }).select("+operationClaim");
  return lead ? { lead, token: value.token } : null;
}
async function releaseLeadClaim(id, token) { await ContactLead.updateOne({ _id: id, "operationClaim.token": token }, { $unset: { operationClaim: 1 } }); }
async function submitEnquiry({ email, name, message, consent }) {
  const existing = await ContactLead.findOne({ email }).select("+operationClaim");
  if (!existing) {
    const now = new Date(); const value = claim(now, "submission");
    return contactTransaction(async (session) => {
      const [lead] = await ContactLead.create([{ email, name, marketingConsent: consent, operationClaim: value }], { session });
      await ContactEnquiry.create([{ contactLead: lead._id, message, isRead: false }], { session });
      await ContactLead.updateOne({ _id: lead._id, "operationClaim.token": value.token }, { $unset: { operationClaim: 1 } }, { session });
      return lead;
    });
  }
  const owned = await acquireLeadClaim(existing._id, "submission");
  if (!owned) throw Object.assign(new Error("Contact update is busy."), { status: 503, retryable: true });
  try {
    return await contactTransaction(async (session) => {
      const lead = await ContactLead.findOneAndUpdate({ _id: existing._id, "operationClaim.token": owned.token }, { $set: { name, marketingConsent: consent } }, { returnDocument: "after", session });
      if (!lead) throw Object.assign(new Error("Contact update is busy."), { status: 503, retryable: true });
      await ContactEnquiry.create([{ contactLead: lead._id, message, isRead: false }], { session });
      await ContactLead.updateOne({ _id: lead._id, "operationClaim.token": owned.token }, { $unset: { operationClaim: 1 } }, { session });
      return lead;
    });
  } catch (error) { await releaseLeadClaim(existing._id, owned.token); throw error; }
}
async function processContactLeadRetention({ limit = 50, now = new Date() } = {}) {
  const results = [];
  for await (const candidate of ContactLead.find({ "marketingConsent.status": "unsubscribed", "operationClaim.token": { $exists: false } }).sort({ "marketingConsent.withdrawnAt": 1 }).limit(limit)) {
    const owned = await acquireLeadClaim(candidate._id, "cleanup", now); if (!owned) continue;
    try { await contactTransaction(async (session) => {
      const lead = await ContactLead.findOne({ _id: candidate._id, "operationClaim.token": owned.token, "marketingConsent.status": "unsubscribed", "marketingConsent.withdrawnAt": { $ne: null } }).session(session);
      if (!lead) return;
      if (await ContactEnquiry.exists({ contactLead: lead._id }).session(session)) { await ContactLead.updateOne({ _id: lead._id, "operationClaim.token": owned.token }, { $unset: { operationClaim: 1 } }, { session }); results.push("preserved"); return; }
      if (lead.marketingConsent.withdrawnAt <= addCalendarYears(now, -3)) { await ContactLead.deleteOne({ _id: lead._id, "operationClaim.token": owned.token, "marketingConsent.status": "unsubscribed", "marketingConsent.withdrawnAt": lead.marketingConsent.withdrawnAt }, { session }); results.push("deleted"); return; }
      await ContactLead.updateOne({ _id: lead._id, "operationClaim.token": owned.token }, { $unset: { name: 1, "marketingConsent.lastOptedInAt": 1, "marketingConsent.lastOptInSource": 1, operationClaim: 1 } }, { session }); results.push("minimized");
    }); } catch (_error) { await releaseLeadClaim(candidate._id, owned.token); }
  }
  return results;
}
async function recoverStaleContactLeadClaims({ now = new Date() } = {}) { const result = await ContactLead.updateMany({ "operationClaim.expiresAt": { $lte: now } }, { $unset: { operationClaim: 1 } }); return result.modifiedCount; }
module.exports = { addCalendarYears, acquireLeadClaim, contactTransaction, processContactLeadRetention, recoverStaleContactLeadClaims, releaseLeadClaim, submitEnquiry };
