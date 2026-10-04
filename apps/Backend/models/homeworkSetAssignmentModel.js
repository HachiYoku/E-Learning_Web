const mongoose = require("mongoose");

const ASSIGNMENT_STATES = ["active", "removed"];

const homeworkSetAssignmentSchema = new mongoose.Schema({
  homeworkSet: { type: mongoose.Schema.Types.ObjectId, ref: "HomeworkSet", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  state: { type: String, enum: ASSIGNMENT_STATES, default: "active", index: true },
  assignedAt: { type: Date, default: Date.now, immutable: true },
  lastAssignedAt: { type: Date, default: Date.now },
  removedAt: { type: Date, default: null },
}, { timestamps: true });

homeworkSetAssignmentSchema.index({ homeworkSet: 1, user: 1 }, { unique: true });
homeworkSetAssignmentSchema.index({ user: 1, state: 1, homeworkSet: 1 });

homeworkSetAssignmentSchema.methods.assign = function assign(now = new Date()) {
  this.state = "active";
  this.lastAssignedAt = now;
  this.removedAt = null;
  return this;
};

homeworkSetAssignmentSchema.methods.markRemoved = function markRemoved(now = new Date()) {
  this.state = "removed";
  this.removedAt = now;
  return this;
};

const HomeworkSetAssignment = mongoose.model("HomeworkSetAssignment", homeworkSetAssignmentSchema);
module.exports = HomeworkSetAssignment;
module.exports.ASSIGNMENT_STATES = ASSIGNMENT_STATES;
