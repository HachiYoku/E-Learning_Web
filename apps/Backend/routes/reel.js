const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const controller = require("../controllers/reelController");

const router = express.Router();

router.get("/", controller.getPublicReels);
router.get("/admin", validateToken, requireAdmin, controller.getAdminReels);
router.post("/admin", validateToken, requireAdmin, controller.createReel);
router.put("/admin/:id", validateToken, requireAdmin, controller.updateReel);
router.delete("/admin/:id", validateToken, requireAdmin, controller.deleteReel);

module.exports = router;
