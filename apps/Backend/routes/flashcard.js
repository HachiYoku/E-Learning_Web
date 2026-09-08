const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { createImageUpload, validateImageFileContent } = require("../middleware/uploadValidation");
const controller = require("../controllers/flashcardController");

const router = express.Router();
const upload = createImageUpload({ maxFiles: 1 });

router.get("/", controller.getPublicFlashcards);
router.get("/admin", validateToken, requireAdmin, controller.getAdminFlashcards);
router.post("/admin", validateToken, requireAdmin, upload.single("image"), validateImageFileContent, controller.createFlashcard);
router.put("/admin/:flashcardId", validateToken, requireAdmin, upload.single("image"), validateImageFileContent, controller.updateFlashcard);
router.delete("/admin/:flashcardId", validateToken, requireAdmin, controller.deleteFlashcard);

module.exports = router;
