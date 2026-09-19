const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  verificationToken: String,
  verificationTokenExpires: Date,
  unverifiedExpiresAt: {
    type: Date,
    expires: 0,
  },

  resetToken: String,
  resetTokenExpire: Date,

  avatar: String,
  avatarPublicId: String,

  isActive: {
    type: Boolean,
    default: true
    },
  
  passwordChangedAt: Date,

  // Incrementing this value invalidates every access and refresh token issued
  // before the change (for example on password reset or deactivation).
  sessionVersion: {
    type: Number,
    default: 0,
  }

},
{ timestamps: true }
);

// A role change must revoke access tokens minted with the previous privilege.
// Session records carry this value and become unusable after the increment.
userSchema.pre("save", function bumpSessionVersionForRoleChange() {
  if (!this.isNew && this.isModified("role") && !this.isModified("sessionVersion")) {
    this.sessionVersion = (this.sessionVersion || 0) + 1;
  }
});

module.exports = mongoose.model("User", userSchema);
