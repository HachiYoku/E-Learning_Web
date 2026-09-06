const User = require('../models/userModel')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const sendEmail = require('../services/sendEmail')

const GENERIC_LOGIN_ERROR_MESSAGE = "Invalid email, password, or account status";
const GENERIC_PASSWORD_RESET_MESSAGE = "If that email exists, a password reset link has been sent";
const UNVERIFIED_ACCOUNT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const hashVerificationToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isStrongPassword = (password) => typeof password === "string"
  && password.length >= 12
  && /[a-z]/.test(password)
  && /[A-Z]/.test(password)
  && /\d/.test(password);

const getAppUrl = (appName) => {
  const isProduction = process.env.NODE_ENV === 'production'
  const appKey = appName.toUpperCase()
  const localUrl = process.env[`${appKey}_URL`]
  const productionUrl = process.env[`${appKey}_URL_PROD`]

  const selectedUrl = isProduction
    ? productionUrl || localUrl
    : localUrl || productionUrl

  if (!selectedUrl) {
    return appName === 'admin' ? 'http://localhost:5174' : 'http://localhost:5173'
  }

  return selectedUrl.replace(/\/$/, '')
}

const getBackendBaseUrl = (req) => {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL.replace(/\/$/, '')
  }

  return `${req.protocol}://${req.get('host')}`
}

const getVerificationRedirectUrl = (status, message, email) => {
  const frontendUrl = getAppUrl('frontend')
  const redirectPath = status === 'error' ? '/verification-help' : '/login'
  const redirectUrl = new URL(redirectPath, frontendUrl)

  if (status) {
    redirectUrl.searchParams.set('verification', status)
  }

  if (message) {
    redirectUrl.searchParams.set('message', message)
  }

  if (email) {
    redirectUrl.searchParams.set('email', email)
  }

  return redirectUrl.toString()
}

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const buildAuthEmail = ({ name, actionUrl, type }) => {
  const isVerification = type === "verification";
  const safeName = escapeHtml(name || "there");
  const safeActionUrl = escapeHtml(actionUrl);
  const accentColor = isVerification ? "#E58C1A" : "#C97112";
  const label = isVerification ? "ACCOUNT VERIFICATION" : "PASSWORD SECURITY";
  const heading = isVerification ? "Welcome to Arun Thai" : "Reset your password";
  const intro = isVerification
    ? "Thanks for creating an account. Confirm your email address to start learning with us."
    : "We received a request to reset the password for your Arun Thai account.";
  const buttonLabel = isVerification ? "Verify email address" : "Reset password";
  const expiry = isVerification ? "This verification link expires in 1 hour." : "For your security, this reset link expires in 15 minutes.";
  const safetyNote = isVerification
    ? "If you did not create an account, you can safely ignore this email."
    : "If you did not request a password reset, you can safely ignore this email. Your password will not change.";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <title>${heading}</title>
      </head>
      <body style="margin: 0; padding: 0; background: #FFF9EA; font-family: Arial, Helvetica, sans-serif; color: #2D2E30;">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${isVerification ? "Confirm your email to activate your account." : "Use this secure link to choose a new password."}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #FFF9EA;">
          <tr>
            <td align="center" style="padding: 32px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; overflow: hidden; border-radius: 20px; background: #FFFFFF; box-shadow: 0 10px 30px rgba(45, 46, 48, 0.08);">
                <tr>
                  <td style="padding: 28px 32px; background: #2D2E30; color: #FFFFFF;">
                    <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 27px; font-style: italic; line-height: 1;">Arun Thai</div>
                    <div style="margin-top: 8px; color: #F8C56A; font-size: 11px; font-weight: bold; letter-spacing: 1.7px;">LEARN WITH CONFIDENCE</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 32px 12px;">
                    <div style="display: inline-block; border-radius: 999px; background: #FFF1D0; color: ${accentColor}; padding: 7px 10px; font-size: 11px; font-weight: bold; letter-spacing: 0.8px;">${label}</div>
                    <h1 style="margin: 20px 0 12px; font-size: 28px; line-height: 36px; letter-spacing: -0.4px;">${heading}</h1>
                    <p style="margin: 0; color: #765F55; font-size: 16px; line-height: 25px;">Hi ${safeName},</p>
                    <p style="margin: 14px 0 0; color: #765F55; font-size: 16px; line-height: 25px;">${intro}</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 24px 32px;">
                    <a href="${safeActionUrl}" style="display: inline-block; border-radius: 10px; background: #F8C56A; color: #2D2E30; padding: 14px 24px; font-size: 15px; font-weight: bold; text-decoration: none;">${buttonLabel}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 32px 32px;">
                    <div style="border-top: 1px solid #EEE7DC; padding-top: 20px; color: #9B867C; font-size: 13px; line-height: 20px;">
                      <strong style="color: #765F55;">${expiry}</strong><br>
                      ${safetyNote}
                    </div>
                  </td>
                </tr>
              </table>
              <p style="max-width: 600px; margin: 18px 0 0; color: #9B867C; font-size: 12px; line-height: 18px; text-align: center;">This is an automated notification from Arun Thai. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>`;
};

const register = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const displayName = name || username;
    const normalizedEmail = normalizeEmail(email);

    if (!displayName || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: "Use a password with at least 12 characters, including uppercase, lowercase, and a number." });
    }

    const existUser = await User.findOne({ email: normalizedEmail });
    if (existUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Create user
    await User.create({
      name: displayName,
      email: normalizedEmail,
      password: hashedPassword,
      verificationToken: hashVerificationToken(verificationToken),
      verificationTokenExpires: Date.now() + 1000 * 60 * 60, // 1 hour
      unverifiedExpiresAt: Date.now() + UNVERIFIED_ACCOUNT_RETENTION_MS,
      isVerified: false,
    });
    
    const verifyLink = `${getBackendBaseUrl(req)}/auth/verify-email?token=${verificationToken}`;

    try {
      await sendEmail(
        normalizedEmail,
        "Verify your email",
        buildAuthEmail({ name: displayName, actionUrl: verifyLink, type: "verification" }),
      );
    } catch (emailError) {
      console.warn("Verification email failed after registration:", emailError.message);

      return res.status(201).json({
        message: "Registration successful, but we could not send the verification email right now. Please try resending it from the login page.",
        emailSent: false,
      });
    }

    //  return success
    return res.status(201).json({
      message: "Registration successful. Please verify your email.",
      emailSent: true,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    // Check if token exists
    if (!token) {
      return res.redirect(
        getVerificationRedirectUrl("error", "Verification token is missing")
      );
    }

    // Accept a legacy raw token once so verification links issued before token hashing still work.
    const user = await User.findOne({ verificationToken: { $in: [hashVerificationToken(token), token] } });

    if (!user) {
      return res.redirect(
        getVerificationRedirectUrl("error", "Invalid verification token")
      );
    }

    if (user.verificationTokenExpires < Date.now()) {
      return res.redirect(
        getVerificationRedirectUrl("error", "Verification token expired", user.email)
      );
    }

    if (user.isVerified) {
      return res.redirect(
        getVerificationRedirectUrl("success", "Email already verified", user.email)
      );
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    user.unverifiedExpiresAt = undefined;
    await user.save();

    return res.redirect(
      getVerificationRedirectUrl("success", "Email verified successfully", user.email)
    );
  } catch (error) {
    return res.redirect(
      getVerificationRedirectUrl("error", error.message || "Email verification failed")
    );
  }
};

const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res
        .status(200)
        .json({ message: "If that email exists, a verification link was sent" });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Email is already verified" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = hashVerificationToken(verificationToken);
    user.verificationTokenExpires = Date.now() + 1000 * 60 * 60; // 1 hour
    await user.save();

    const verifyLink = `${getBackendBaseUrl(req)}/auth/verify-email?token=${verificationToken}`;

    await sendEmail(
      user.email,
      "Verify your email",
      buildAuthEmail({ name: user.name, actionUrl: verifyLink, type: "verification" }),
    );

    return res
      .status(200)
      .json({ message: "Verification email sent. Please check your inbox." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return res.status(401).json({ message: GENERIC_LOGIN_ERROR_MESSAGE });
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: GENERIC_LOGIN_ERROR_MESSAGE });
  }

  // Only disclose account status after password verification, so the login
  // endpoint does not reveal whether an email address is registered.
  if (!user.isActive) {
    return res.status(403).json({
      code: "ACCOUNT_DEACTIVATED",
      message: "This account has been deactivated.",
    });
  }

  if (!user.isVerified) {
    return res.status(403).json({
      code: "EMAIL_UNVERIFIED",
      message: "Please verify your email before signing in.",
    });
  }

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  res.json({ accessToken: token });
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(200).json({ message: GENERIC_PASSWORD_RESET_MESSAGE });
    }
    // Generate token
    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpire = Date.now() + 15 * 60 * 1000; // 15 mins
    // Save to DB
    user.resetToken = resetToken;
    user.resetTokenExpire = resetTokenExpire;
    await user.save();

    // Send email
    const resetLink = `${
      getAppUrl('frontend')
    }/reset-password/${resetToken}`;
    const html = buildAuthEmail({
      name: user.name,
      actionUrl: resetLink,
      type: "passwordReset",
    });

    await sendEmail(user.email, "Password Reset", html);

    res.json({ message: GENERIC_PASSWORD_RESET_MESSAGE });
  } catch (error) {
    console.error("Password reset email failed:", error.message);
    res.status(500).json({ message: "Unable to process the password reset request right now" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    // Validate that newPassword is provided
    if (!password) {
      return res.status(400).json({ message: "New password is required" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: "Use a password with at least 12 characters, including uppercase, lowercase, and a number." });
    }
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpire: { $gt: Date.now() },
    });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Token is invalid or has expired" });
    }
    // Hash the new password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Update user with new password and clear reset token fields
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpire = null;
    await user.save();
    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Password reset failed:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword
}
