const User = require("../models/userModel");
const Course = require("../models/courseModel");
const Enrollment = require("../models/enrollmentModel");
const Payment = require("../models/paymentModel");
const mongoose = require("mongoose");
const { uploadStream } = require("../services/uploadStream");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const getAdminUsersWithEnrollments = async () => {
  const users = await User.find({ role: "user" }).select("-password").sort({ createdAt: -1 });
  const enrollments = await Enrollment.find({ userId: { $in: users.map((user) => user._id) } })
    .populate("courseId", "title");

  const userCourseMap = new Map();

  for (const enrollment of enrollments) {
    if (!enrollment.courseId?._id) {
      continue;
    }

    const userId = String(enrollment.userId);
    const currentCourses = userCourseMap.get(userId) || [];
    currentCourses.push({
      id: enrollment.courseId?._id,
      title: enrollment.courseId?.title || "Unknown course",
    });
    userCourseMap.set(userId, currentCourses);
  }

  return users.map((user) => ({
    ...user.toObject(),
    purchasedCourses: userCourseMap.get(String(user._id)) || [],
  }));
};

const getProfile = async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: "User is not authorized" });
  }

  if (req.user.role === "admin") {
    const users = await getAdminUsersWithEnrollments();
    return res.status(200).json(users);
  }

  const user = await User.findById(req.user.id).select("-password");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json(user);
};


const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name } = req.body;
    if (name) user.name = name;

    if (req.file && req.file.buffer) {
      const result = await uploadStream(req.file.buffer, "english_kafe/avatars");
      user.avatar = result.secure_url;
      user.avatarPublicId = result.public_id;
    }

    await user.save();
    const updated = await User.findById(req.user.id).select("-password");
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deletAccount = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await Enrollment.deleteMany({ userId: req.params.id });
    await Payment.deleteMany({ userId: req.params.id });

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isActive = Boolean(isActive);
    await user.save();

    return res.status(200).json({ message: "User status updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateUserCourseAccess = async (req, res) => {
  try {
    const { courseIds } = req.body;

    if (!Array.isArray(courseIds)) {
      return res.status(400).json({ message: "courseIds must be an array" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const uniqueCourseIds = [
      ...new Set(
        courseIds
          .map((courseId) => String(courseId))
          .filter((courseId) => courseId && courseId !== "null" && courseId !== "undefined" && isValidObjectId(courseId))
      ),
    ];

    const validCourses = await Course.find({ _id: { $in: uniqueCourseIds } }).select("_id");
    const validCourseIds = validCourses.map((course) => String(course._id));

    const existingEnrollments = await Enrollment.find({ userId: user._id });
    const existingByCourseId = new Map(
      existingEnrollments
        .filter((enrollment) => enrollment.courseId && isValidObjectId(enrollment.courseId))
        .map((enrollment) => [String(enrollment.courseId), enrollment])
    );

    for (const courseId of validCourseIds) {
      if (!existingByCourseId.has(courseId)) {
        await Enrollment.create({
          userId: user._id,
          courseId,
        });
      }
    }

    for (const enrollment of existingEnrollments) {
      if (!enrollment.courseId || !isValidObjectId(enrollment.courseId) || !validCourseIds.includes(String(enrollment.courseId))) {
        await enrollment.deleteOne();
      }
    }

    const users = await getAdminUsersWithEnrollments();
    const updatedUser = users.find((item) => String(item._id) === String(user._id));

    return res.status(200).json({
      message: "User course access updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  deletAccount,
  updateUserStatus,
  updateUserCourseAccess,
}
