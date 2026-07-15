const Enrollment = require("../models/enrollmentModel");

const requireEnrollment = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "User is not authorized" });
    }

    if (req.user.role === "admin") {
      return next();
    }

    const enrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: req.params.courseId,
    });

    if (!enrollment) {
      return res.status(403).json({
        message: "You are not enrolled in this course",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = requireEnrollment;
