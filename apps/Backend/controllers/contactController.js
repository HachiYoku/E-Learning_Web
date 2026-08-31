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

const buildSubscriptionConfirmation = (name) => `
  <div style="margin:0;padding:32px 16px;background:#fff9ea;font-family:Arial,sans-serif;color:#2d2e30;">
    <div style="max-width:600px;margin:0 auto;padding:36px;background:#fffdf8;border:1px solid #f3d9b0;border-radius:24px;">
      <p style="margin:0 0 12px;color:#c97112;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Arun Thai Academy</p>
      <h1 style="margin:0;font-size:28px;line-height:1.25;">You’re on the list, ${escapeHtml(name)}.</h1>
      <p style="margin:20px 0 0;font-size:16px;line-height:1.65;color:#765f55;">Thank you for keeping in touch. We’ll send you course news, practical Thai learning tips, and helpful updates from Arun Thai Academy.</p>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#765f55;">This is an automated message from our no-reply address, so there is no need to reply.</p>
      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#765f55;">Don’t want these updates? <a href="{{unsubscribeUrl}}" style="color:#c97112;">Unsubscribe</a>.</p>
    </div>
  </div>`;

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
          "You’re on the Arun Thai Academy list",
          buildSubscriptionConfirmation(lead.name).replace("{{unsubscribeUrl}}", unsubscribeUrl)
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
