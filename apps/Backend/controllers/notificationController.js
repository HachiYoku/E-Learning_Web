const Notification = require("../models/notificationModel");
const User = require("../models/userModel");

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

    const users = await User.find({ role: "user" }).select("_id");

    const payload = users.map((user) => ({
      userId: user._id,
      type,
      title: title.trim(),
      message: message.trim(),
      link: link?.trim() || "",
      isRead: false,
    }));

    if (payload.length === 0) {
      return res.status(200).json({
        message: "No users found to notify",
        sentCount: 0,
      });
    }

    const result = await Notification.insertMany(payload);

    return res.status(200).json({
      message: "Announcement sent to all users",
      sentCount: result.length,
    });
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
};
