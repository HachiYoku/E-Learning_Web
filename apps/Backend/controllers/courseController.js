const Course = require("../models/courseModel");
const Lesson = require("../models/lessonModel");
const Enrollment = require("../models/enrollmentModel");
const Payment = require("../models/paymentModel");
const User = require("../models/userModel");
const Notification = require("../models/notificationModel");
const bcrypt = require("bcryptjs");
const { uploadStream } = require("../services/uploadStream");
const { writeAuditLog } = require("../services/auditLogger");
const { createNotification } = require("./notificationController");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseFeatures = (input) => {
  if (input === undefined) {
    return undefined;
  }

  if (Array.isArray(input)) {
    return input.map((feature) => String(feature).trim()).filter(Boolean);
  }

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.map((feature) => String(feature).trim()).filter(Boolean);
      }
    } catch (error) {
      return input
        .split(",")
        .map((feature) => feature.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const withCourseMeta = async (course) => {
  if (!course) {
    return course;
  }

  const [lessonCount, enrollmentCount] = await Promise.all([
    Lesson.countDocuments({ course: course._id }),
    Enrollment.countDocuments({ courseId: course._id }),
  ]);

  return {
    ...course.toObject(),
    lessonCount,
    enrollmentCount,
  };
};

const withCourseMetaList = async (courses) => {
  return Promise.all(courses.map((course) => withCourseMeta(course)));
};

const getUploadedFile = (req, fieldName) => {
  if (!req.files || !req.files[fieldName]) {
    return null;
  }

  return req.files[fieldName][0] || null;
};

const parsePrices = (value) => {
  if (value === undefined) return undefined;
  let parsed = value;
  if (typeof value === "string") { try { parsed = JSON.parse(value); } catch (_error) { throw Object.assign(new Error("Currency prices must be valid JSON."), { status: 400 }); } }
  if (!parsed || typeof parsed !== "object") throw Object.assign(new Error("Currency prices must be an object."), { status: 400 });
  const result = {};
  for (const currency of ["THB", "MMK"]) {
    if (!parsed[currency]) continue;
    const price = Number(parsed[currency].price); const originalPrice = Number(parsed[currency].originalPrice);
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(originalPrice) || originalPrice < price) throw Object.assign(new Error(`Enter a valid ${currency} original price and price.`), { status: 400 });
    result[currency] = { price, originalPrice };
  }
  return result;
};

const createCourse = async (req, res) => {
  try {
    const { title, description, price, originalPrice, rating, thumbnail, paymentQr, isPublished } = req.body;
    const prices = parsePrices(req.body.prices);
    const features = parseFeatures(req.body.features);

    const sellingPrice = price === undefined || price === "" ? undefined : Number(price);
    const basePrice = originalPrice === undefined || originalPrice === "" ? sellingPrice : Number(originalPrice);
    if (!title || (sellingPrice !== undefined && (!Number.isFinite(sellingPrice) || sellingPrice < 0 || !Number.isFinite(basePrice) || basePrice < sellingPrice)) || (isPublished === "true" || isPublished === true ? !Object.keys(prices || {}).length : false)) {
      return res.status(400).json({ message: "Enter a valid original price and a discounted price that is not higher than it." });
    }

    let thumbnailUrl = thumbnail;
    let thumbnailPublicId;
    let paymentQrUrl = paymentQr;
    let paymentQrPublicId;

    const thumbnailFile = getUploadedFile(req, "thumbnail");
    const paymentQrFile = getUploadedFile(req, "paymentQr");

    if (thumbnailFile?.buffer) {
      const result = await uploadStream(
        thumbnailFile.buffer,
        "english_kafe/course_thumbnails"
      );
      thumbnailUrl = result.secure_url;
      thumbnailPublicId = result.public_id;
    }

    if (paymentQrFile?.buffer) {
      const result = await uploadStream(
        paymentQrFile.buffer,
        "english_kafe/course_payment_qr_codes"
      );
      paymentQrUrl = result.secure_url;
      paymentQrPublicId = result.public_id;
    }

    const course = await Course.create({
      title,
      description,
      price: sellingPrice,
      originalPrice: basePrice,
      prices,
      features: features || [],
      rating: rating || 0,
      thumbnail: thumbnailUrl,
      thumbnailPublicId,
      paymentQr: paymentQrUrl,
      paymentQrPublicId,
      isPublished,
      createdBy: req.user.id,
    });

    return res.status(201).json(course);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
};

const getCourses = async (req, res) => {
  try {
    const query = req.user?.role === "admin" ? {} : { isPublished: true };
    const courses = await Course.find(query).populate("createdBy", "name email");

    return res.status(200).json(await withCourseMetaList(courses));
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
};

const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (!course.isPublished && req.user?.role !== "admin") {
      return res.status(403).json({ message: "You cannot access this course" });
    }

    return res.status(200).json(await withCourseMeta(course));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { title, description, price, originalPrice, rating, thumbnail, paymentQr, isPublished } = req.body;
    const suppliedPrices = parsePrices(req.body.prices);
    const features = parseFeatures(req.body.features);
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const nextPrice = price === undefined ? course.price : (price === "" ? undefined : Number(price));
    const nextOriginalPrice = originalPrice === undefined ? course.originalPrice : (originalPrice === "" ? nextPrice : Number(originalPrice));
    if ((nextPrice !== undefined && (!Number.isFinite(nextPrice) || nextPrice < 0 || !Number.isFinite(nextOriginalPrice) || nextOriginalPrice < nextPrice)) || ((isPublished === "true" || isPublished === true || (isPublished === undefined && course.isPublished)) && suppliedPrices && !Object.keys(suppliedPrices).length)) {
      return res.status(400).json({ message: "Enter a valid original price and a discounted price that is not higher than it." });
    }

    if (title !== undefined) course.title = title;
    if (description !== undefined) course.description = description;
    if (features !== undefined) course.features = features;
    const pricingChanged = (price !== undefined && Number(course.price) !== nextPrice)
      || (originalPrice !== undefined && Number(course.originalPrice ?? course.price) !== nextOriginalPrice)
      || (suppliedPrices !== undefined && JSON.stringify(course.prices?.toObject?.() || course.prices || {}) !== JSON.stringify(suppliedPrices));
    if (price !== undefined) course.price = nextPrice;
    if (originalPrice !== undefined) course.originalPrice = nextOriginalPrice;
    if (suppliedPrices !== undefined) course.prices = suppliedPrices;
    if (pricingChanged) course.mutationVersion = Number(course.mutationVersion || 0) + 1;
    if (rating !== undefined) course.rating = rating;
    if (thumbnail !== undefined) course.thumbnail = thumbnail;
    if (paymentQr !== undefined) course.paymentQr = paymentQr;
    if (isPublished !== undefined) course.isPublished = isPublished;

    const thumbnailFile = getUploadedFile(req, "thumbnail");
    const paymentQrFile = getUploadedFile(req, "paymentQr");

    if (thumbnailFile?.buffer) {
      const result = await uploadStream(
        thumbnailFile.buffer,
        "english_kafe/course_thumbnails"
      );
      course.thumbnail = result.secure_url;
      course.thumbnailPublicId = result.public_id;
    }

    if (paymentQrFile?.buffer) {
      const result = await uploadStream(
        paymentQrFile.buffer,
        "english_kafe/course_payment_qr_codes"
      );
      course.paymentQr = result.secure_url;
      course.paymentQrPublicId = result.public_id;
    }

    await course.save();

    return res.status(200).json(course);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const { adminPassword } = req.body || {};
    if (typeof adminPassword !== "string" || !adminPassword.trim()) {
      return res.status(400).json({ message: "Admin password is required to delete a course" });
    }

    const adminUser = await User.findById(req.user?.id).select("+password");
    if (!adminUser || !bcrypt.compareSync(adminPassword, adminUser.password)) {
      return res.status(403).json({ message: "Invalid admin password" });
    }

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const affectedEnrollments = await Enrollment.find({ courseId: course._id }).select("userId").lean();
    const affectedStudentIds = [...new Set(affectedEnrollments.map((enrollment) => String(enrollment.userId)))];

    // New notifications carry courseId. The text fallback removes legacy
    // notifications created before that field existed, preventing stale
    // course links and contradictory enrollment messages.
    await Notification.deleteMany({
      $or: [
        { courseId: course._id },
        {
          type: { $in: ["course", "enrollment", "payment"] },
          message: { $regex: escapeRegex(course.title), $options: "i" },
        },
      ],
    });
    await Enrollment.deleteMany({ courseId: course._id });
    await Lesson.deleteMany({ course: course._id });
    await Payment.updateMany(
      { courseId: course._id },
      {
        $set: {
          courseDeletedAt: new Date(),
          courseSnapshot: {
            title: course.title,
            description: course.description || "",
            thumbnail: course.thumbnail || "",
            price: Number(course.price || 0),
          },
        },
      }
    );
    await course.deleteOne();

    await Promise.all(affectedStudentIds.map((userId) =>
      createNotification({
        userId,
        type: "course",
        title: "Course no longer available",
        message: `${course.title} has been removed from the course catalogue and is no longer available in your library.`,
        link: "/app/courses",
      }).catch((notificationError) => {
        console.warn("Failed to create course-removal notification:", notificationError.message);
      })
    ));
    await writeAuditLog({
      actorId: req.user.id,
      action: "course.deleted",
      targetType: "course",
      targetId: course._id,
      metadata: { title: course.title },
    });

    return res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
};
