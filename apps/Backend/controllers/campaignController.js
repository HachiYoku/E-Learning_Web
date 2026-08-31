const Campaign = require("../models/campaignModel");
const ContactLead = require("../models/contactLeadModel");
const User = require("../models/userModel");
const sendEmail = require("../services/sendEmail");
const { uploadStream } = require("../services/uploadStream");
const cloudinary = require("../config/cloudinary");

const escapeHtml = (value = "") => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

const sixMonthsFrom = (date) => {
  const expiry = new Date(date);
  expiry.setMonth(expiry.getMonth() + 6);
  return expiry;
};

const createCampaign = async (req, res) => {
  try {
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!subject || !message) return res.status(400).json({ message: "A subject and message are required." });

    let recipientKeys = req.body?.recipientIds || [];
    if (typeof recipientKeys === "string") {
      try { recipientKeys = JSON.parse(recipientKeys); } catch { recipientKeys = []; }
    }
    if (!Array.isArray(recipientKeys) || !recipientKeys.length) {
      return res.status(400).json({ message: "Choose at least one recipient." });
    }
    const systemIds = recipientKeys.filter((key) => typeof key === "string" && key.startsWith("system:")).map((key) => key.slice(7));
    const contactIds = recipientKeys.filter((key) => typeof key === "string" && key.startsWith("contact:")).map((key) => key.slice(8));
    const [systemUsers, optedInLeads] = await Promise.all([
      User.find({ _id: { $in: systemIds }, role: "user" }).select("_id name email"),
      ContactLead.find({ _id: { $in: contactIds }, marketingOptIn: true }).select("_id name email"),
    ]);
    const selectedRecipients = [
      ...systemUsers.map((user) => ({ recordType: "system", recipientId: user._id, name: user.name, email: user.email })),
      ...optedInLeads.map((lead) => ({ recordType: "contact", recipientId: lead._id, name: lead.name, email: lead.email })),
    ];
    if (!selectedRecipients.length) return res.status(400).json({ message: "Choose at least one valid recipient." });

    let image = "";
    let imagePublicId = "";
    if (req.file?.buffer) {
      const uploaded = await uploadStream(req.file.buffer, "english_kafe/campaigns");
      image = uploaded.secure_url;
      imagePublicId = uploaded.public_id;
    }

    const campaign = await Campaign.create({
      subject,
      message,
      selectedRecipients,
      image,
      imagePublicId,
      createdBy: req.user.id,
    });
    return res.status(201).json(campaign);
  } catch (_error) {
    return res.status(500).json({ message: "Unable to create the campaign." });
  }
};

const listCampaigns = async (_req, res) => {
  try {
    const campaigns = await Campaign.find({}).populate("createdBy", "name email").sort({ createdAt: -1 });
    return res.status(200).json(campaigns);
  } catch (_error) {
    return res.status(500).json({ message: "Unable to load campaign history." });
  }
};

const sendCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found." });
    if (campaign.status !== "draft") return res.status(409).json({ message: "This campaign has already been sent." });

    const selectedRecipients = campaign.selectedRecipients || [];
    const systemIds = selectedRecipients.filter((item) => item.recordType === "system").map((item) => item.recipientId);
    const contactIds = selectedRecipients.filter((item) => item.recordType === "contact").map((item) => item.recipientId);
    const [systemUsers, leads] = await Promise.all([
      User.find({ _id: { $in: systemIds }, role: "user", isActive: true }).select("name email"),
      ContactLead.find({ _id: { $in: contactIds }, marketingOptIn: true }).select("name email"),
    ]);
    const recipients = [
      ...systemUsers.map((user) => ({ name: user.name, email: user.email, recordType: "system" })),
      ...leads.map((lead) => ({ name: lead.name, email: lead.email, recordType: "contact" })),
    ];
    if (!recipients.length) return res.status(400).json({ message: "None of the selected recipients are currently eligible." });
    const safeSubject = escapeHtml(campaign.subject);
    const safeMessage = escapeHtml(campaign.message).replace(/\n/g, "<br />");
    const results = await Promise.allSettled(recipients.map((lead) => sendEmail(
      lead.email,
      campaign.subject,
      `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2D2E30"><p>Hello ${escapeHtml(lead.name)},</p>${campaign.image ? `<img src="${campaign.image}" alt="" style="display:block;width:100%;max-width:620px;border-radius:12px;margin:16px 0" />` : ""}<h2>${safeSubject}</h2><p>${safeMessage}</p><p>— Arun Thai Academy</p></div>`
    )));
    const sentCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - sentCount;

    campaign.recipients = recipients;
    campaign.recipientCount = recipients.length;
    campaign.sentCount = sentCount;
    campaign.failedCount = failedCount;
    campaign.status = failedCount === 0 ? "sent" : sentCount > 0 ? "partial" : "failed";
    campaign.sentAt = new Date();
    campaign.expiresAt = sixMonthsFrom(campaign.sentAt);
    await campaign.save();

    return res.status(200).json(campaign);
  } catch (_error) {
    return res.status(500).json({ message: "Unable to send the campaign." });
  }
};

const deleteDraftCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found." });
    if (campaign.status !== "draft") return res.status(409).json({ message: "Only drafts can be deleted." });

    if (campaign.imagePublicId) {
      await cloudinary.uploader.destroy(campaign.imagePublicId).catch(() => undefined);
    }
    await campaign.deleteOne();
    return res.status(200).json({ message: "Draft deleted successfully." });
  } catch (_error) {
    return res.status(500).json({ message: "Unable to delete the draft." });
  }
};

const updateDraftCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found." });
    if (campaign.status !== "draft") return res.status(409).json({ message: "Only drafts can be edited." });

    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    let recipientKeys = req.body?.recipientIds || [];
    if (typeof recipientKeys === "string") {
      try { recipientKeys = JSON.parse(recipientKeys); } catch { recipientKeys = []; }
    }
    if (!subject || !message || !Array.isArray(recipientKeys) || !recipientKeys.length) {
      return res.status(400).json({ message: "Subject, message, and at least one recipient are required." });
    }

    const systemIds = recipientKeys.filter((key) => typeof key === "string" && key.startsWith("system:")).map((key) => key.slice(7));
    const contactIds = recipientKeys.filter((key) => typeof key === "string" && key.startsWith("contact:")).map((key) => key.slice(8));
    const [systemUsers, optedInLeads] = await Promise.all([
      User.find({ _id: { $in: systemIds }, role: "user" }).select("_id name email"),
      ContactLead.find({ _id: { $in: contactIds }, marketingOptIn: true }).select("_id name email"),
    ]);
    const selectedRecipients = [
      ...systemUsers.map((user) => ({ recordType: "system", recipientId: user._id, name: user.name, email: user.email })),
      ...optedInLeads.map((lead) => ({ recordType: "contact", recipientId: lead._id, name: lead.name, email: lead.email })),
    ];
    if (!selectedRecipients.length) return res.status(400).json({ message: "Choose at least one valid recipient." });

    campaign.subject = subject;
    campaign.message = message;
    campaign.selectedRecipients = selectedRecipients;
    if (req.file?.buffer) {
      const uploaded = await uploadStream(req.file.buffer, "english_kafe/campaigns");
      if (campaign.imagePublicId) await cloudinary.uploader.destroy(campaign.imagePublicId).catch(() => undefined);
      campaign.image = uploaded.secure_url;
      campaign.imagePublicId = uploaded.public_id;
    }
    await campaign.save();
    return res.status(200).json(campaign);
  } catch (_error) {
    return res.status(500).json({ message: "Unable to update the draft." });
  }
};

module.exports = { createCampaign, listCampaigns, sendCampaign, deleteDraftCampaign, updateDraftCampaign };
