const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const controller = require("../controllers/flashcardReviewController");

const router = express.Router();

router.use(validateToken);
router.post("/rate", controller.rate);
router.get("/due", controller.due);
router.get("/summary", controller.summary);

module.exports = router;
