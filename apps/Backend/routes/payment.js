const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { createImageUpload, validateImageFileContent } = require("../middleware/uploadValidation");
const {
  createPayment,
  quoteCheckout,
  getCheckoutPaymentMethods,
  getMyPayments,
  getAllPayments,
  getPendingPaymentCount,
  replacePaymentProof,
  getPaymentProofAccess,
  streamAuthorizedPaymentProof,
  streamStudentRejectedPaymentProof,
  openPaymentProofRetentionHold,
  resolvePaymentProofRetentionHold,
  approvePayment,
  rejectPayment,
  emailMyReceipt,
  generateAdminReceiptPdf,
} = require("../controllers/paymentController");

const router = express.Router();
const upload = createImageUpload();

router.get("/my", validateToken, getMyPayments);
router.get("/course/:courseId/methods", validateToken, getCheckoutPaymentMethods);
router.post("/course/:courseId/quote", validateToken, quoteCheckout);
router.get("/pending-count", validateToken, requireAdmin, getPendingPaymentCount);
router.get("/", validateToken, requireAdmin, getAllPayments);
router.post("/course/:courseId", validateToken, upload.single("paymentProof"), validateImageFileContent, createPayment);
router.put("/:paymentId/proof", validateToken, upload.single("paymentProof"), validateImageFileContent, replacePaymentProof);
router.get("/:paymentId/proof-access", validateToken, requireAdmin, getPaymentProofAccess);
router.get("/:paymentId/student-proof", validateToken, streamStudentRejectedPaymentProof);
router.post("/:paymentId/receipt-email", validateToken, emailMyReceipt);
router.get("/:paymentId/receipt-pdf", validateToken, requireAdmin, generateAdminReceiptPdf);
router.get("/:paymentId/proof", streamAuthorizedPaymentProof);
router.post("/:paymentId/proof-retention-hold", validateToken, requireAdmin, openPaymentProofRetentionHold);
router.patch("/:paymentId/proof-retention-hold/resolve", validateToken, requireAdmin, resolvePaymentProofRetentionHold);
router.patch("/:paymentId/approve", validateToken, requireAdmin, approvePayment);
router.patch("/:paymentId/reject", validateToken, requireAdmin, rejectPayment);

module.exports = router;
