const mongoose = require("mongoose");

const contactLeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    message: { type: String, trim: true, maxlength: 2000, default: "" },
    marketingOptIn: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContactLead", contactLeadSchema);
