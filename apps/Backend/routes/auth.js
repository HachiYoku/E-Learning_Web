const express = require('express');
const router = express.Router();
const rateLimit = require("express-rate-limit");
const validateToken = require('../middleware/authMiddleware');

const { register, verifyEmail, resendVerification, login, getCurrentUser, forgotPassword, resetPassword } = require('../controllers/authController')
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
})


router.post('/register', authLimiter, register)

router.get('/verify-email', verifyEmail)

router.post('/resend-verification', authLimiter, resendVerification)

router.post('/login', authLimiter, login)

router.get('/me', validateToken, getCurrentUser)

router.post('/forgot-password', authLimiter, forgotPassword)

router.post('/reset-password/:token', authLimiter, resetPassword)



module.exports = router
