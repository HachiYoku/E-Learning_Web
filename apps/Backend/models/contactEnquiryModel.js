const mongoose = require("mongoose");

const contactEnquirySchema = new mongoose.Schema(
  {
    contactLead: { type: mongoose.Schema.Types.ObjectId, ref: "ContactLead", required: true, index: true },
    message: { type: String, trim: true, maxlength: 2000, default: "" },
    submittedAt: { type: Date, default: Date.now, index: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

contactEnquirySchema.index({ contactLead: 1, submittedAt: -1 });
contactEnquirySchema.index({ contactLead: 1, isRead: 1 });

module.exports = mongoose.model("ContactEnquiry", contactEnquirySchema);
