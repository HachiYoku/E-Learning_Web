const Course = require("../models/courseModel");
const Lesson = require("../models/lessonModel");
const Enrollment = require("../models/enrollmentModel");
const { uploadStream } = require("../services/uploadStream");

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

const createCourse = async (req, res) => {
  try {
    const { title, description, price, rating, thumbnail, paymentQr, isPublished } = req.body;
    const features = parseFeatures(req.body.features);

    if (!title || price === undefined) {
      return res.status(400).json({ message: "Title and price are required" });
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
      price,
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
    return res.status(500).json({ message: error.message });
  }
};

const getCourses = async (req, res) => {
  try {
    const query = req.user?.role === "admin" ? {} : { isPublished: true };
    const courses = await Course.find(query).populate("createdBy", "name email");

    return res.status(200).json(await withCourseMetaList(courses));
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
    const { title, description, price, rating, thumbnail, paymentQr, isPublished } = req.body;
    const features = parseFeatures(req.body.features);
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (title !== undefined) course.title = title;
    if (description !== undefined) course.description = description;
    if (features !== undefined) course.features = features;
    if (price !== undefined) course.price = price;
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
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    await Lesson.deleteMany({ course: course._id });
    await course.deleteOne();

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
