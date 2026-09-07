const express = require("express");
const rateLimit = require("express-rate-limit");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { createContactLead, unsubscribeContactLead, listContactLeads, getUnreadContactLeadCount } = require("../controllers/contactController");

const router = express.Router();
const contactSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many contact requests. Please try again later." },
});

router.post("/", contactSubmissionLimiter, createContactLead);
router.get("/unsubscribe", unsubscribeContactLead);
router.get("/unread-count", validateToken, requireAdmin, getUnreadContactLeadCount);
router.get("/", validateToken, requireAdmin, listContactLeads);

module.exports = router;
