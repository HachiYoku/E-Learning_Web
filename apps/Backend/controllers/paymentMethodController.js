const bcrypt = require("bcryptjs");
const PaymentMethod = require("../models/paymentMethodModel");
const Payment = require("../models/paymentModel");
const User = require("../models/userModel");
const { uploadStream } = require("../services/uploadStream");
const { writeAuditLog } = require("../services/auditLogger");
const { PREFIX, queue } = require("../services/paymentMethodQrCleanup");

const TYPES = ["qr", "bank_transfer", "wallet"];
const CURRENCIES = ["THB", "MMK"];
const clean = (value) => String(value || "").trim();
const validQr = (qr) => Boolean(qr?.url && typeof qr.publicId === "string" && qr.publicId.startsWith(PREFIX));

async function verifyAdminPassword(userId, adminPassword) {
  if (typeof adminPassword !== "string" || !adminPassword.trim()) throw Object.assign(new Error("Admin password is required to manage payment methods."), { status: 400 });
  const admin = await User.findById(userId).select("+password");
  if (!admin || !bcrypt.compareSync(adminPassword, admin.password)) throw Object.assign(new Error("Invalid admin password"), { status: 403 });
}

function methodFields(body) {
  const currency = clean(body.currency);
  const type = clean(body.type);
  const provider = clean(body.provider || "manual");
  const name = clean(body.name);
  if (!name || !CURRENCIES.includes(currency) || !TYPES.includes(type) || provider !== "manual") throw Object.assign(new Error("Enter a valid name, currency, type, and manual provider."), { status: 400 });
  const recipientSource = typeof body.recipient === "string" ? JSON.parse(body.recipient || "{}") : (body.recipient || {});
  return { name, currency, type, provider, instructions: clean(body.instructions), recipient: {
    accountName: clean(recipientSource.accountName), accountNumber: clean(recipientSource.accountNumber), bankName: clean(recipientSource.bankName), phoneNumber: clean(recipientSource.phoneNumber), referenceHint: clean(recipientSource.referenceHint),
  } };
}

exports.listPaymentMethods = async (_req, res) => {
  try { return res.json(await PaymentMethod.find().sort({ currency: 1, name: 1 })); }
  catch (_error) { return res.status(500).json({ message: "Unable to load payment methods" }); }
};

exports.createPaymentMethod = async (req, res) => {
  let uploaded;
  try {
    await verifyAdminPassword(req.user.id, req.body.adminPassword);
    const fields = methodFields(req.body);
    if (req.file?.buffer) {
      uploaded = await uploadStream(req.file.buffer, "arun_thai/payment_method_qr_codes");
      fields.qrImage = { url: uploaded.secure_url, publicId: uploaded.public_id };
    }
    const isActive = req.body.isActive !== "false" && req.body.isActive !== false;
    if (fields.type === "qr" && isActive && !validQr(fields.qrImage)) {
      if (uploaded?.public_id) await queue(uploaded.public_id);
      return res.status(400).json({ message: "An active QR payment method requires a valid QR image." });
    }
    const method = await PaymentMethod.create({ ...fields, isActive, createdBy: req.user.id, updatedBy: req.user.id });
    await writeAuditLog({ actorId: req.user.id, action: "payment_method.created", targetType: "payment_method", targetId: method._id, metadata: { currency: method.currency, type: method.type, provider: method.provider } });
    return res.status(201).json(method);
  } catch (error) { if (uploaded?.public_id) await queue(uploaded.public_id); return res.status(error.status || 400).json({ message: error.message || "Unable to create payment method" }); }
};

exports.updatePaymentMethod = async (req, res) => {
  let uploaded;
  try {
    await verifyAdminPassword(req.user.id, req.body.adminPassword);
    let method = await PaymentMethod.findById(req.params.id);
    if (!method) return res.status(404).json({ message: "Payment method not found" });
    const fields = methodFields(req.body);
    if (req.file?.buffer) {
      uploaded = await uploadStream(req.file.buffer, "arun_thai/payment_method_qr_codes");
      fields.qrImage = { url: uploaded.secure_url, publicId: uploaded.public_id };
    }
    // A QR asset is owned only by its current PaymentMethod reference.  Old
    // assets are queued only after this compare-and-set update commits.
    const nextQr = fields.type === "qr" ? (fields.qrImage || method.qrImage) : { url: "", publicId: "" };
    if (fields.type === "qr" && method.isActive && !validQr(nextQr)) return res.status(400).json({ message: "An active QR payment method requires a valid QR image." });
    const previousQr = method.qrImage?.publicId;
    const current = { name: method.name, currency: method.currency, type: method.type, provider: method.provider, instructions: method.instructions, recipient: method.recipient?.toObject?.() || method.recipient, qrImage: method.qrImage?.toObject?.() || method.qrImage };
    const replacement = { ...fields, qrImage: nextQr };
    const changed = JSON.stringify(current) !== JSON.stringify(replacement);
    if (!changed) return res.json(method);
    const updated = await PaymentMethod.findOneAndUpdate(
      { _id: method._id, mutationVersion: Number(method.mutationVersion || 0) },
      { $set: { ...replacement, updatedBy: req.user.id }, $inc: { mutationVersion: 1 } },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) throw Object.assign(new Error("Payment method was changed by another administrator. Reload and try again."), { status: 409 });
    if (previousQr && previousQr !== updated.qrImage?.publicId) await queue(previousQr);
    await writeAuditLog({ actorId: req.user.id, action: "payment_method.updated", targetType: "payment_method", targetId: updated._id, metadata: { currency: updated.currency, type: updated.type, mutationVersion: updated.mutationVersion } });
    return res.json(updated);
  } catch (error) { if (uploaded?.public_id) await queue(uploaded.public_id); return res.status(error.status || 400).json({ message: error.message || "Unable to update payment method" }); }
};

exports.setPaymentMethodActive = async (req, res) => {
  try {
    await verifyAdminPassword(req.user.id, req.body.adminPassword);
    if (typeof req.body.isActive !== "boolean") return res.status(400).json({ message: "isActive must be a boolean" });
    const method = await PaymentMethod.findById(req.params.id);
    if (!method) return res.status(404).json({ message: "Payment method not found" });
    if (req.body.isActive && method.type === "qr" && !validQr(method.qrImage)) return res.status(400).json({ message: "Upload a valid QR image before activating this payment method." });
    let updated = method;
    if (method.isActive !== req.body.isActive) {
      const previousQr = method.qrImage?.publicId;
      updated = await PaymentMethod.findOneAndUpdate(
        { _id: method._id, mutationVersion: Number(method.mutationVersion || 0) },
        { $set: { isActive: req.body.isActive, ...(req.body.isActive ? {} : { qrImage: {} }), updatedBy: req.user.id }, $inc: { mutationVersion: 1 } },
        { returnDocument: "after", runValidators: true },
      );
      if (!updated) throw Object.assign(new Error("Payment method was changed by another administrator. Reload and try again."), { status: 409 });
      if (!req.body.isActive && previousQr) await queue(previousQr);
    }
    await writeAuditLog({ actorId: req.user.id, action: `payment_method.${updated.isActive ? "activated" : "deactivated"}`, targetType: "payment_method", targetId: updated._id, metadata: { mutationVersion: updated.mutationVersion } });
    return res.json(updated);
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || "Unable to update payment method" }); }
};

exports.deletePaymentMethod = async (req, res) => {
  try {
    await verifyAdminPassword(req.user.id, req.body.adminPassword);
    let method = await PaymentMethod.findById(req.params.id);
    if (!method) return res.status(404).json({ message: "Payment method not found" });
    const hasHistory = Boolean(await Payment.exists({ $or: [{ paymentMethodId: method._id }, { "paymentMethodSnapshot.methodId": method._id }] }));
    if (hasHistory) {
      if (method.isActive || method.qrImage?.publicId) {
        const previousQr = method.qrImage?.publicId;
        const updated = await PaymentMethod.findOneAndUpdate(
          { _id: method._id, mutationVersion: Number(method.mutationVersion || 0) },
          { $set: { isActive: false, qrImage: {}, updatedBy: req.user.id }, $inc: { mutationVersion: 1 } },
          { returnDocument: "after", runValidators: true },
        );
        if (!updated) throw Object.assign(new Error("Payment method was changed by another administrator. Reload and try again."), { status: 409 });
        method = updated;
        if (previousQr) await queue(previousQr);
      }
    }
    else {
      const previousQr = method.qrImage?.publicId;
      const deleted = await PaymentMethod.findOneAndDelete({ _id: method._id, mutationVersion: Number(method.mutationVersion || 0) });
      if (!deleted) throw Object.assign(new Error("Payment method was changed by another administrator. Reload and try again."), { status: 409 });
      if (previousQr) await queue(previousQr);
    }
    await writeAuditLog({ actorId: req.user.id, action: hasHistory ? "payment_method.deactivated_with_history" : "payment_method.deleted", targetType: "payment_method", targetId: method._id });
    return res.json({ deleted: !hasHistory, deactivated: hasHistory, method });
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || "Unable to delete payment method" }); }
};
