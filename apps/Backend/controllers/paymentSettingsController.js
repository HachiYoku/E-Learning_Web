const PaymentSettings = require("../models/paymentSettingsModel");
const { uploadStream } = require("../services/uploadStream");
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");

const SETTINGS_KEY = "global";

async function getOrCreateSettings() {
  let settings = await PaymentSettings.findOne({ key: SETTINGS_KEY });

  if (!settings) {
    settings = await PaymentSettings.create({ key: SETTINGS_KEY });
  }

  return settings;
}

const getPaymentSettings = async (_req, res) => {
  try {
    const settings = await getOrCreateSettings();

    return res.status(200).json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updatePaymentSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

      // Require admin password for sensitive changes
      const { adminPassword } = req.body;
      if (typeof adminPassword !== 'string' || !adminPassword.trim()) {
        return res.status(400).json({ message: "Admin password is required to perform this action" });
      }

      // Verify admin password
      const adminUser = await User.findById(req.user?.id);
      if (!adminUser) {
        return res.status(403).json({ message: "Admin user not found" });
      }

      const isAdminPasswordValid = bcrypt.compareSync(adminPassword, adminUser.password);
      if (!isAdminPasswordValid) {
        // Use 403 Forbidden so the frontend does not treat this as an authentication/token error (401)
        return res.status(403).json({ message: "Invalid admin password" });
      }

      if (req.file?.buffer) {
      const result = await uploadStream(
        req.file.buffer,
        "english_kafe/payment_qr_codes"
      );
      settings.paymentQr = result.secure_url;
      settings.paymentQrPublicId = result.public_id;
    } else if (req.body.paymentQr !== undefined) {
      settings.paymentQr = String(req.body.paymentQr || "").trim();
      settings.paymentQrPublicId = undefined;
    }

    settings.updatedBy = req.user.id;
    await settings.save();

    return res.status(200).json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPaymentSettings,
  updatePaymentSettings,
};
