const mongoose = require("mongoose");
const { isSafeNotificationLink } = require("../services/notificationLinkValidator");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Makes course-related notices removable when an administrator deletes
    // the course, without relying on a title or message text match.
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["payment", "enrollment", "course", "system", "info"],
      default: "info",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: "",
      trim: true,
      validate: {
        validator: isSafeNotificationLink,
        message: "Notification link must be a supported internal application path",
      },
    },
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Announcement",
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
