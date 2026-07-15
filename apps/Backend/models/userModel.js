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

  resetToken: String,
  resetTokenExpire: Date,

  avatar: String,
  avatarPublicId: String,

  isActive: {
    type: Boolean,
    default: true
    },
  
  resetToken: {
      type: String,
    },
    resetTokenExpire: {
      type: Date,
    },

  passwordChangedAt: Date

},
{ timestamps: true }
);

module.exports = mongoose.model("User", userSchema);