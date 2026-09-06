const ContactLead = require("../models/contactLeadModel");
const sendEmail = require("../services/sendEmail");
const jwt = require("jsonwebtoken");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#039;");

const buildSubscriptionConfirmation = (name, unsubscribeUrl) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="x-apple-disable-message-reformatting">
      <title>You're on the Arun Thai list</title>
    </head>
    <body style="margin: 0; padding: 0; background: #FFF9EA; font-family: Arial, Helvetica, sans-serif; color: #2D2E30;">
      <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">Thai learning tips, course news, and helpful updates are on their way.</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #FFF9EA;">
        <tr><td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; overflow: hidden; border-radius: 20px; background: #FFFFFF; box-shadow: 0 10px 30px rgba(45, 46, 48, 0.08);">
            <tr><td style="padding: 28px 32px; background: #2D2E30; color: #FFFFFF;"><div style="font-family: Georgia, 'Times New Roman', serif; font-size: 27px; font-style: italic; line-height: 1;">Arun Thai</div><div style="margin-top: 8px; color: #F8C56A; font-size: 11px; font-weight: bold; letter-spacing: 1.7px;">LEARN WITH CONFIDENCE</div></td></tr>
            <tr><td style="padding: 32px 32px 14px;"><div style="display: inline-block; border-radius: 999px; background: #E9F4EA; color: #4D7C57; padding: 7px 10px; font-size: 11px; font-weight: bold; letter-spacing: 0.8px;">UPDATES CONFIRMED</div><h1 style="margin: 20px 0 12px; font-size: 28px; line-height: 36px; letter-spacing: -0.4px;">You’re on the list.</h1><p style="margin: 0; color: #765F55; font-size: 16px; line-height: 25px;">Hi ${escapeHtml(name)},</p><p style="margin: 14px 0 0; color: #765F55; font-size: 16px; line-height: 25px;">Thank you for keeping in touch. We’ll send you practical Thai learning tips, course news, and helpful updates to support your progress.</p></td></tr>
            <tr><td style="padding: 10px 32px 32px;"><div style="border-top: 1px solid #EEE7DC; padding-top: 20px; color: #9B867C; font-size: 13px; line-height: 20px;">You can opt out of these updates at any time. <a href="${escapeHtml(unsubscribeUrl)}" style="color: #C97112; font-weight: bold; text-decoration: underline;">Unsubscribe</a>.</div></td></tr>
          </table>
          <p style="max-width: 600px; margin: 18px 0 0; color: #9B867C; font-size: 12px; line-height: 18px; text-align: center;">This is an automated notification from Arun Thai. Please do not reply directly to this email.</p>
        </td></tr>
      </table>
    </body>
  </html>`;

const createContactLead = async (req, res) => {
  try {
    const { name, email, message = "", marketingOptIn = true, website = "" } = req.body || {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedName = typeof name === "string" ? name.trim() : "";

    if (!normalizedName || !normalizedEmail) {
      return res.status(400).json({ message: "Name and email are required." });
    }

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    // Honeypot field: legitimate visitors never fill this in, while simple bots often do.
    if (typeof website === "string" && website.trim()) {
      return res.status(201).json({ message: "Thank you. We will keep you updated." });
    }

    const existingLead = await ContactLead.findOne({ email: normalizedEmail }).select("marketingOptIn");
    const wasAlreadySubscribed = Boolean(existingLead?.marketingOptIn);
    const lead = await ContactLead.findOneAndUpdate(
      { email: normalizedEmail },
      {
        name: normalizedName,
        message: typeof message === "string" ? message.trim() : "",
        marketingOptIn: Boolean(marketingOptIn),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    let confirmationSent = false;
    if (lead.marketingOptIn) {
      try {
        const unsubscribeToken = jwt.sign(
          { email: normalizedEmail, purpose: "contact-unsubscribe" },
          process.env.JWT_SECRET,
          { expiresIn: "1y" }
        );
        const baseUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
        const unsubscribeUrl = `${baseUrl}/contacts/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
        await sendEmail(
          normalizedEmail,
          "You're on the Arun Thai list",
          buildSubscriptionConfirmation(lead.name, unsubscribeUrl)
        );
        confirmationSent = true;
      } catch (emailError) {
        console.error("Unable to send contact subscription confirmation:", emailError.message);
      }
    }

    return res.status(201).json({
      message: confirmationSent
        ? wasAlreadySubscribed
          ? "You are already subscribed. We sent another confirmation to your email."
          : "Thank you. Please check your email for a confirmation."
        : "Thank you. We will keep you updated.",
      lead: { id: lead._id, name: lead.name, email: lead.email },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ message: "Thank you. We will keep you updated." });
    }

    return res.status(500).json({ message: "Unable to save your details. Please try again." });
  }
};

const unsubscribeContactLead = async (req, res) => {
  try {
    const token = typeof req.query?.token === "string" ? req.query.token : "";
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose !== "contact-unsubscribe" || !emailPattern.test(payload.email || "")) {
      return res.status(400).send("This unsubscribe link is invalid.");
    }

    await ContactLead.findOneAndUpdate({ email: payload.email.toLowerCase() }, { marketingOptIn: false });
    return res.status(200).type("html").send("<main style=\"font-family:Arial,sans-serif;padding:48px;color:#2d2e30\"><h1>You have been unsubscribed.</h1><p>You will no longer receive Arun Thai Academy marketing updates.</p></main>");
  } catch (_error) {
    return res.status(400).type("html").send("<main style=\"font-family:Arial,sans-serif;padding:48px;color:#2d2e30\"><h1>This unsubscribe link is invalid or has expired.</h1></main>");
  }
};

const listContactLeads = async (_req, res) => {
  try {
    const leads = await ContactLead.find({}).sort({ createdAt: -1 });
    return res.status(200).json(leads);
  } catch (_error) {
    return res.status(500).json({ message: "Unable to load contact leads." });
  }
};

module.exports = { createContactLead, unsubscribeContactLead, listContactLeads };
