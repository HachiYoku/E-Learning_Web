const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const Announcement = require("../models/announcementModel");
const { writeAuditLog } = require("../services/auditLogger");

const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false,
    });

    return res.status(200).json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createNotification = async ({
  userId,
  type = "info",
  title,
  message,
  link = "",
}) => {
  if (!userId || !title || !message) {
    return null;
  }

  return Notification.create({
    userId,
    type,
    title,
    message,
    link,
    isRead: false,
  });
};

const broadcastNotificationToAllUsers = async (req, res) => {
  try {
    const { title, message, type = "system", link = "" } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const users = await User.find({ role: "user", isVerified: true, isActive: true }).select("_id");

    const announcement = await Announcement.create({
      title: title.trim(),
      message: message.trim(),
      type,
      link: link?.trim() || "",
      createdBy: req.user.id,
      recipientCount: users.length,
    });

    const payload = users.map((user) => ({
      userId: user._id,
      announcementId: announcement._id,
      type,
      title: title.trim(),
      message: message.trim(),
      link: link?.trim() || "",
      isRead: false,
    }));

    let result = [];
    try {
      if (payload.length) result = await Notification.insertMany(payload);
    } catch (error) {
      await Announcement.deleteOne({ _id: announcement._id });
      throw error;
    }

    return res.status(200).json({
      message: "Announcement sent to all users",
      sentCount: result.length,
      announcement,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAnnouncements = async (_req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.status(200).json(announcements);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });
    if (String(announcement.createdBy) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only delete announcements you created" });
    }

    await Notification.deleteMany({ announcementId: announcement._id });
    await announcement.deleteOne();
    await writeAuditLog({
      actorId: req.user.id,
      action: "announcement.deleted",
      targetType: "announcement",
      targetId: announcement._id,
      metadata: { title: announcement.title, recipientCount: announcement.recipientCount },
    });
    return res.status(200).json({ message: "Announcement deleted for all recipients" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
  broadcastNotificationToAllUsers,
  getAnnouncements,
  deleteAnnouncement,
};
