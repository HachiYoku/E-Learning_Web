const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { createImageUpload, validateImageFileContent } = require("../middleware/uploadValidation");
const {
  createPayment,
  getMyPayments,
  getAllPayments,
  getPendingPaymentCount,
  approvePayment,
  rejectPayment,
} = require("../controllers/paymentController");

const router = express.Router();
const upload = createImageUpload();

router.get("/my", validateToken, getMyPayments);
router.get("/pending-count", validateToken, requireAdmin, getPendingPaymentCount);
router.get("/", validateToken, requireAdmin, getAllPayments);
router.post("/course/:courseId", validateToken, upload.single("paymentProof"), validateImageFileContent, createPayment);
router.patch("/:paymentId/approve", validateToken, requireAdmin, approvePayment);
router.patch("/:paymentId/reject", validateToken, requireAdmin, rejectPayment);

module.exports = router;
