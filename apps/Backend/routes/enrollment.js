const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const {
  getMyEnrollments,
  checkEnrollment,
} = require("../controllers/enrollmentController");

const router = express.Router();

router.get("/my", validateToken, getMyEnrollments);
router.get("/check/:courseId", validateToken, checkEnrollment);

module.exports = router;
