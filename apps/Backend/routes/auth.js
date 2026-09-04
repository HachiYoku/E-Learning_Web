const express = require('express');
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const validateToken = require('../middleware/authMiddleware');

const { register, verifyEmail, resendVerification, login, getCurrentUser, forgotPassword, resetPassword } = require('../controllers/authController');
const rateLimitMessage = (message) => (req, res) => res.status(429).json({ message });
const emailAndIpKey = (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || "").trim().toLowerCase()}`;

const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitMessage("Too many sign-in attempts. Please wait 15 minutes before trying again."),
});

const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: emailAndIpKey,
  handler: rateLimitMessage("Too many sign-in attempts for these details. Please wait 15 minutes before trying again."),
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitMessage("Too many registration attempts. Please try again in an hour."),
});

const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailAndIpKey,
  handler: rateLimitMessage("Too many password reset requests. Please try again in an hour."),
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitMessage("Too many password reset attempts. Please wait 15 minutes before trying again."),
});

const verificationEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailAndIpKey,
  handler: rateLimitMessage("Too many verification email requests. Please try again in an hour."),
});

router.post('/register', registrationLimiter, register);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', verificationEmailLimiter, resendVerification);
router.post('/login', loginIpLimiter, loginAccountLimiter, login);
router.get('/me', validateToken, getCurrentUser);
router.post('/forgot-password', passwordResetRequestLimiter, forgotPassword);
router.post('/reset-password/:token', passwordResetLimiter, resetPassword);

module.exports = router;
