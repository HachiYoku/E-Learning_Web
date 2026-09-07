const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  broadcastNotificationToAllUsers,
  getAnnouncements,
  deleteAnnouncement,
} = require("../controllers/notificationController");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/", validateToken, getUserNotifications);
router.post("/broadcast", validateToken, requireAdmin, broadcastNotificationToAllUsers);
router.get("/announcements", validateToken, requireAdmin, getAnnouncements);
router.delete("/announcements/:id", validateToken, requireAdmin, deleteAnnouncement);
router.patch("/:id/read", validateToken, markNotificationRead);
router.patch("/read-all", validateToken, markAllNotificationsRead);

module.exports = router;
