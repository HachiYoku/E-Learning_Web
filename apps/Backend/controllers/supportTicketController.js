const SupportTicket = require("../models/supportTicketModel");
const { createNotification } = require("./notificationController");

const populateTicket = (query) => query.populate("studentId", "name email avatar").populate("replies.authorId", "name");

const createSupportTicket = async (req, res) => {
  try {
    const { category = "general", subject, message } = req.body || {};
    if (!subject?.trim() || !message?.trim()) return res.status(400).json({ message: "A subject and message are required." });
    const ticket = await SupportTicket.create({ studentId: req.user.id, category, subject: subject.trim(), message: message.trim() });
    return res.status(201).json(await populateTicket(SupportTicket.findById(ticket._id)));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getMySupportTickets = async (req, res) => {
  try {
    return res.status(200).json(await populateTicket(SupportTicket.find({ studentId: req.user.id }).sort({ updatedAt: -1 })));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getSupportTickets = async (_req, res) => {
  try {
    return res.status(200).json(await populateTicket(SupportTicket.find({}).sort({ updatedAt: -1 })));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["open", "in_progress", "resolved"].includes(status)) return res.status(400).json({ message: "Invalid ticket status." });
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!ticket) return res.status(404).json({ message: "Support request not found." });
    return res.status(200).json(await populateTicket(SupportTicket.findById(ticket._id)));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const replyToSupportTicket = async (req, res) => {
  try {
    const message = req.body?.message?.trim();
    if (!message) return res.status(400).json({ message: "A reply message is required." });
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Support request not found." });
    ticket.replies.push({ authorId: req.user.id, authorRole: "admin", message });
    if (ticket.status === "open") ticket.status = "in_progress";
    await ticket.save();
    await createNotification({ userId: ticket.studentId, type: "info", title: "Support replied to your request", message: `There is a new reply about “${ticket.subject}”.`, link: "/app/support" });
    return res.status(200).json(await populateTicket(SupportTicket.findById(ticket._id)));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { createSupportTicket, getMySupportTickets, getSupportTickets, updateTicketStatus, replyToSupportTicket };
