const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  broadcastNotificationToAllUsers,
} = require("../controllers/notificationController");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/", validateToken, getUserNotifications);
router.post("/broadcast", validateToken, requireAdmin, broadcastNotificationToAllUsers);
router.patch("/:id/read", validateToken, markNotificationRead);
router.patch("/read-all", validateToken, markAllNotificationsRead);

module.exports = router;
