const mongoose = require("mongoose");
const { isSafeNotificationLink } = require("../services/notificationLinkValidator");

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  type: { type: String, enum: ["system", "info", "course"], default: "system" },
  link: {
    type: String,
    default: "",
    trim: true,
    validate: {
      validator: isSafeNotificationLink,
      message: "Announcement link must be a supported internal application path",
    },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  recipientCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Announcement", announcementSchema);
