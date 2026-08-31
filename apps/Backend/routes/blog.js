const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { createImageUpload, validateImageFileContent } = require("../middleware/uploadValidation");
const {
  createBlog,
  getBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
} = require("../controllers/blogController");

const router = express.Router();
const upload = createImageUpload();

router.get("/", getBlogs);
router.get("/:id", getBlogById);
router.post("/", validateToken, requireAdmin, upload.single("image"), validateImageFileContent, createBlog);
router.put("/:id", validateToken, requireAdmin, upload.single("image"), validateImageFileContent, updateBlog);
router.delete("/:id", validateToken, requireAdmin, deleteBlog);

module.exports = router;
