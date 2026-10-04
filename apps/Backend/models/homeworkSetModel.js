const mongoose = require("mongoose");

const HOMEWORK_SET_STATUSES = ["draft", "active", "archived"];

const homeworkSetSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  status: { type: String, enum: HOMEWORK_SET_STATUSES, default: "draft", index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

homeworkSetSchema.index({ status: 1, updatedAt: -1 });

const HomeworkSet = mongoose.model("HomeworkSet", homeworkSetSchema);
module.exports = HomeworkSet;
module.exports.HOMEWORK_SET_STATUSES = HOMEWORK_SET_STATUSES;
