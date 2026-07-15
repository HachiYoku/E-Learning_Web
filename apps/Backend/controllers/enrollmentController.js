const Enrollment = require("../models/enrollmentModel");

const getMyEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ userId: req.user.id })
      .populate("courseId", "title description price thumbnail isPublished")
      .populate("paymentId", "status paymentImage")
      .sort({ createdAt: -1 });

    return res.status(200).json(enrollments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const checkEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: req.params.courseId,
    });

    return res.status(200).json({ enrolled: Boolean(enrollment) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMyEnrollments,
  checkEnrollment,
};
