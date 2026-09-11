const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { createImageUpload, validateImageFileContent } = require("../middleware/uploadValidation");
const controller = require("../controllers/flashcardController");

const router = express.Router();
const upload = createImageUpload({ maxFiles: 1 });

router.get("/", controller.getPublicFlashcards);
router.get("/admin", validateToken, requireAdmin, controller.getAdminFlashcards);
router.get("/admin/categories", validateToken, requireAdmin, controller.getCategories);
router.post("/admin/categories", validateToken, requireAdmin, controller.createCategory);
router.put("/admin/categories/:categoryId", validateToken, requireAdmin, controller.updateCategory);
router.delete("/admin/categories/:categoryId", validateToken, requireAdmin, controller.deleteCategory);
router.post("/admin", validateToken, requireAdmin, upload.single("image"), validateImageFileContent, controller.createFlashcard);
router.put("/admin/:flashcardId", validateToken, requireAdmin, upload.single("image"), validateImageFileContent, controller.updateFlashcard);
router.delete("/admin/:flashcardId", validateToken, requireAdmin, controller.deleteFlashcard);

module.exports = router;
