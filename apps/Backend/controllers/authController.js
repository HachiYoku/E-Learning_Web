const User = require('../models/userModel')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const sendEmail = require('../services/sendEmail')

const GENERIC_LOGIN_ERROR_MESSAGE = "Invalid email, password, or account status";
const GENERIC_PASSWORD_RESET_MESSAGE = "If that email exists, a password reset link has been sent";

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

const register = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const displayName = name || username;

    if (!displayName || !email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const existUser = await User.findOne({ email });
    if (existUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Create user
    await User.create({
      name: displayName,
      email,
      password: hashedPassword,
      verificationToken,
      verificationTokenExpires: Date.now() + 1000 * 60 * 60, // 1 hour
      isVerified: false,
    });
    
    const verifyLink = `${getBackendBaseUrl(req)}/auth/verify-email?token=${verificationToken}`;

    try {
      await sendEmail(
        email,
        "Verify your email",
        `
          <h3>Welcome!</h3>
          <p>Click the link below to verify your email:</p>
          <a href="${verifyLink}">Verify Email</a>
        `,
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

    const user = await User.findOne({
      verificationToken: token,
    });

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

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(200)
        .json({ message: "If that email exists, a verification link was sent" });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Email is already verified" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = Date.now() + 1000 * 60 * 60; // 1 hour
    await user.save();

    const verifyLink = `${getBackendBaseUrl(req)}/auth/verify-email?token=${verificationToken}`;

    await sendEmail(
      user.email,
      "Verify your email",
      `
        <h3>Verify your email</h3>
        <p>Click the link below to verify your email:</p>
        <a href="${verifyLink}">Verify Email</a>
      `,
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

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({ message: GENERIC_LOGIN_ERROR_MESSAGE });
  }

  if (!user.isActive) {
    return res.status(401).json({ message: GENERIC_LOGIN_ERROR_MESSAGE });
  }

  if (!user.isVerified) {
    return res.status(401).json({
      message: GENERIC_LOGIN_ERROR_MESSAGE,
    });
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: GENERIC_LOGIN_ERROR_MESSAGE });
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
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await User.findOne({ email });
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
    const html = `
      <h3>Password Reset Request</h3>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>This link will expire in 15 minutes.</p>
    `;

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
