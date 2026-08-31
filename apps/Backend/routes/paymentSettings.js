const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { createImageUpload, validateImageFileContent } = require("../middleware/uploadValidation");
const {
  getPaymentSettings,
  updatePaymentSettings,
} = require("../controllers/paymentSettingsController");

const router = express.Router();
const upload = createImageUpload();

router.get("/", getPaymentSettings);
router.put("/", validateToken, requireAdmin, upload.single("paymentQr"), validateImageFileContent, updatePaymentSettings);

module.exports = router;
