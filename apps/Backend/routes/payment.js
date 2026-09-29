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
  approvePayment,
  rejectPayment,
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
router.get("/:paymentId/proof", streamAuthorizedPaymentProof);
router.patch("/:paymentId/approve", validateToken, requireAdmin, approvePayment);
router.patch("/:paymentId/reject", validateToken, requireAdmin, rejectPayment);

module.exports = router;
