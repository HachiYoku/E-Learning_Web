const Campaign = require("../models/campaignModel");
const ContactLead = require("../models/contactLeadModel");
const User = require("../models/userModel");
const sendEmail = require("../services/sendEmail");
const { uploadStream } = require("../services/uploadStream");
const cloudinary = require("../config/cloudinary");

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

const sixMonthsFrom = (date) => {
  const expiry = new Date(date);
  expiry.setMonth(expiry.getMonth() + 6);
  return expiry;
};

const uniqueRecipientsByEmail = (recipients) => {
  const seenEmails = new Set();

  return recipients.filter((recipient) => {
    const email = String(recipient.email || "").trim().toLowerCase();
    if (!email || seenEmails.has(email)) return false;
    seenEmails.add(email);
    return true;
  });
};

const buildCampaignEmail = ({ recipientName, subject, message, image }) => {
  const safeName = escapeHtml(recipientName || "there");
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
  const imageBlock = image
    ? `<tr><td style="padding: 0 32px 8px;"><img src="${escapeHtml(image)}" alt="" width="536" style="display: block; width: 100%; max-width: 536px; height: auto; border: 0; border-radius: 14px;" /></td></tr>`
    : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <title>${safeSubject}</title>
      </head>
      <body style="margin: 0; padding: 0; background: #FFF9EA; font-family: Arial, Helvetica, sans-serif; color: #2D2E30;">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${safeSubject}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #FFF9EA;">
          <tr>
            <td align="center" style="padding: 32px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; overflow: hidden; border-radius: 20px; background: #FFFFFF; box-shadow: 0 10px 30px rgba(45, 46, 48, 0.08);">
                <tr><td style="padding: 28px 32px; background: #2D2E30; color: #FFFFFF;"><div style="font-family: Georgia, 'Times New Roman', serif; font-size: 27px; font-style: italic; line-height: 1;">Arun Thai</div><div style="margin-top: 8px; color: #F8C56A; font-size: 11px; font-weight: bold; letter-spacing: 1.7px;">LEARN WITH CONFIDENCE</div></td></tr>
                <tr><td style="padding: 32px 32px 20px;"><div style="display: inline-block; border-radius: 999px; background: #FFF1D0; color: #C97112; padding: 7px 10px; font-size: 11px; font-weight: bold; letter-spacing: 0.8px;">ARUN THAI UPDATE</div><p style="margin: 20px 0 0; color: #765F55; font-size: 16px; line-height: 25px;">Hi ${safeName},</p><h1 style="margin: 12px 0 0; color: #2D2E30; font-size: 28px; line-height: 36px; letter-spacing: -0.4px;">${safeSubject}</h1></td></tr>
                ${imageBlock}
                <tr><td style="padding: 20px 32px 34px; color: #765F55; font-size: 16px; line-height: 26px;">${safeMessage}</td></tr>
              </table>
              <p style="max-width: 600px; margin: 18px 0 0; color: #9B867C; font-size: 12px; line-height: 18px; text-align: center;">You are receiving this update from Arun Thai because you signed up for course news and updates.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>`;
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
    const selectedRecipients = uniqueRecipientsByEmail([
      ...systemUsers.map((user) => ({ recordType: "system", recipientId: user._id, name: user.name, email: user.email })),
      ...optedInLeads.map((lead) => ({ recordType: "contact", recipientId: lead._id, name: lead.name, email: lead.email })),
    ]);
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
    const recipients = uniqueRecipientsByEmail([
      ...systemUsers.map((user) => ({ name: user.name, email: user.email, recordType: "system" })),
      ...leads.map((lead) => ({ name: lead.name, email: lead.email, recordType: "contact" })),
    ]);
    if (!recipients.length) return res.status(400).json({ message: "None of the selected recipients are currently eligible." });
    const results = await Promise.allSettled(recipients.map((lead) => sendEmail(
      lead.email,
      campaign.subject,
      buildCampaignEmail({
        recipientName: lead.name,
        subject: campaign.subject,
        message: campaign.message,
        image: campaign.image,
      })
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
    const selectedRecipients = uniqueRecipientsByEmail([
      ...systemUsers.map((user) => ({ recordType: "system", recipientId: user._id, name: user.name, email: user.email })),
      ...optedInLeads.map((lead) => ({ recordType: "contact", recipientId: lead._id, name: lead.name, email: lead.email })),
    ]);
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
