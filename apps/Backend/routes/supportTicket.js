const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { createSupportTicket, getMySupportTickets, getSupportTickets, updateTicketStatus, replyToSupportTicket } = require("../controllers/supportTicketController");

const router = express.Router();
router.post("/", validateToken, createSupportTicket);
router.get("/mine", validateToken, getMySupportTickets);
router.get("/", validateToken, requireAdmin, getSupportTickets);
router.patch("/:id/status", validateToken, requireAdmin, updateTicketStatus);
router.post("/:id/replies", validateToken, requireAdmin, replyToSupportTicket);
module.exports = router;
