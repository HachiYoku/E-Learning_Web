const Course = require("../models/courseModel");
const Enrollment = require("../models/enrollmentModel");
const Payment = require("../models/paymentModel");
const { uploadStream } = require("../services/uploadStream");

const createPayment = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ message: "Payment proof is required" });
    }

    const existingEnrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId,
    });
    if (existingEnrollment) {
      return res.status(400).json({ message: "You are already enrolled in this course" });
    }

    const existingPendingPayment = await Payment.findOne({
      userId: req.user.id,
      courseId,
      status: "pending",
    });
    if (existingPendingPayment) {
      return res.status(400).json({
        message: "You already have a pending payment for this course",
      });
    }

    const uploadedProof = await uploadStream(
      req.file.buffer,
      "english_kafe/payment_proofs"
    );

    const payment = await Payment.create({
      userId: req.user.id,
      courseId,
      paymentImage: uploadedProof.secure_url,
      paymentImagePublicId: uploadedProof.public_id,
      status: "pending",
    });

    return res.status(201).json(payment);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .populate("courseId", "title price thumbnail")
      .sort({ createdAt: -1 });

    return res.status(200).json(payments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("userId", "name email avatar")
      .populate("courseId", "title price")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json(payments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const approvePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({ message: "Only pending payments can be approved" });
    }

    payment.status = "approved";
    payment.reviewedBy = req.user.id;
    payment.reviewedAt = new Date();
    payment.rejectReason = undefined;
    await payment.save();

    const enrollment = await Enrollment.findOneAndUpdate(
      {
        userId: payment.userId,
        courseId: payment.courseId,
      },
      {
        userId: payment.userId,
        courseId: payment.courseId,
        paymentId: payment._id,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      message: "Payment approved and enrollment created successfully",
      payment,
      enrollment,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const rejectPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { rejectReason } = req.body;

    if (!rejectReason || !rejectReason.trim()) {
      return res.status(400).json({ message: "Reject reason is required" });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({ message: "Only pending payments can be rejected" });
    }

    payment.status = "rejected";
    payment.reviewedBy = req.user.id;
    payment.reviewedAt = new Date();
    payment.rejectReason = rejectReason.trim();
    await payment.save();

    return res.status(200).json({ message: "Payment rejected successfully", payment });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createPayment,
  getMyPayments,
  getAllPayments,
  approvePayment,
  rejectPayment,
};
