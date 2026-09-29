const router = require("express").Router();
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const controller = require("../controllers/adminStudentFeedbackController");

router.get("/", validateToken, requireAdmin, controller.listAdminStudentFeedback);
router.get("/:id", validateToken, requireAdmin, controller.getAdminStudentFeedback);
router.patch("/:id/publication", validateToken, requireAdmin, controller.updateAdminStudentFeedbackPublication);

module.exports = router;
