const bcrypt = require("bcryptjs");
const PaymentMethod = require("../models/paymentMethodModel");
const Payment = require("../models/paymentModel");
const User = require("../models/userModel");
const { uploadStream } = require("../services/uploadStream");
const { writeAuditLog } = require("../services/auditLogger");

const TYPES = ["qr", "bank_transfer", "wallet"];
const CURRENCIES = ["THB", "MMK"];
const clean = (value) => String(value || "").trim();

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
  try {
    await verifyAdminPassword(req.user.id, req.body.adminPassword);
    const fields = methodFields(req.body);
    if (req.file?.buffer) {
      const upload = await uploadStream(req.file.buffer, "arun_thai/payment_method_qr_codes");
      fields.qrImage = { url: upload.secure_url, publicId: upload.public_id };
    }
    const method = await PaymentMethod.create({ ...fields, isActive: req.body.isActive !== "false" && req.body.isActive !== false, createdBy: req.user.id, updatedBy: req.user.id });
    await writeAuditLog({ actorId: req.user.id, action: "payment_method.created", targetType: "payment_method", targetId: method._id, metadata: { currency: method.currency, type: method.type, provider: method.provider } });
    return res.status(201).json(method);
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || "Unable to create payment method" }); }
};

exports.updatePaymentMethod = async (req, res) => {
  try {
    await verifyAdminPassword(req.user.id, req.body.adminPassword);
    const method = await PaymentMethod.findById(req.params.id);
    if (!method) return res.status(404).json({ message: "Payment method not found" });
    const fields = methodFields(req.body);
    if (req.file?.buffer) {
      const upload = await uploadStream(req.file.buffer, "arun_thai/payment_method_qr_codes");
      fields.qrImage = { url: upload.secure_url, publicId: upload.public_id };
    }
    const changed = JSON.stringify({ name: method.name, currency: method.currency, type: method.type, provider: method.provider, instructions: method.instructions, recipient: method.recipient?.toObject?.() || method.recipient, qrImage: method.qrImage?.toObject?.() || method.qrImage }) !== JSON.stringify({ ...fields, qrImage: fields.qrImage || (method.qrImage?.toObject?.() || method.qrImage) });
    Object.assign(method, fields, { updatedBy: req.user.id });
    if (changed) method.mutationVersion = Number(method.mutationVersion || 0) + 1;
    await method.save();
    await writeAuditLog({ actorId: req.user.id, action: "payment_method.updated", targetType: "payment_method", targetId: method._id, metadata: { currency: method.currency, type: method.type, mutationVersion: method.mutationVersion } });
    return res.json(method);
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || "Unable to update payment method" }); }
};

exports.setPaymentMethodActive = async (req, res) => {
  try {
    await verifyAdminPassword(req.user.id, req.body.adminPassword);
    if (typeof req.body.isActive !== "boolean") return res.status(400).json({ message: "isActive must be a boolean" });
    const method = await PaymentMethod.findById(req.params.id);
    if (!method) return res.status(404).json({ message: "Payment method not found" });
    if (method.isActive !== req.body.isActive) { method.isActive = req.body.isActive; method.updatedBy = req.user.id; method.mutationVersion = Number(method.mutationVersion || 0) + 1; await method.save(); }
    await writeAuditLog({ actorId: req.user.id, action: `payment_method.${method.isActive ? "activated" : "deactivated"}`, targetType: "payment_method", targetId: method._id, metadata: { mutationVersion: method.mutationVersion } });
    return res.json(method);
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || "Unable to update payment method" }); }
};

exports.deletePaymentMethod = async (req, res) => {
  try {
    await verifyAdminPassword(req.user.id, req.body.adminPassword);
    const method = await PaymentMethod.findById(req.params.id);
    if (!method) return res.status(404).json({ message: "Payment method not found" });
    const hasHistory = Boolean(await Payment.exists({ $or: [{ paymentMethodId: method._id }, { "paymentMethodSnapshot.methodId": method._id }] }));
    if (hasHistory) {
      if (method.isActive) {
        method.isActive = false;
        method.updatedBy = req.user.id;
        method.mutationVersion = Number(method.mutationVersion || 0) + 1;
        await method.save();
      }
    }
    else await method.deleteOne();
    await writeAuditLog({ actorId: req.user.id, action: hasHistory ? "payment_method.deactivated_with_history" : "payment_method.deleted", targetType: "payment_method", targetId: method._id });
    return res.json({ deleted: !hasHistory, deactivated: hasHistory, method });
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || "Unable to delete payment method" }); }
};
