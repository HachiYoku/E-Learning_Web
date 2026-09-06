const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  type: { type: String, enum: ["system", "info", "course"], default: "system" },
  link: { type: String, default: "", trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  recipientCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Announcement", announcementSchema);
