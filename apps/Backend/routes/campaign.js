const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { createImageUpload, validateImageFileContent } = require("../middleware/uploadValidation");
const { createCampaign, listCampaigns, sendCampaign, deleteDraftCampaign, updateDraftCampaign } = require("../controllers/campaignController");

const router = express.Router();
const upload = createImageUpload();
router.get("/", validateToken, requireAdmin, listCampaigns);
router.post("/", validateToken, requireAdmin, upload.single("image"), validateImageFileContent, createCampaign);
router.put("/:id", validateToken, requireAdmin, upload.single("image"), validateImageFileContent, updateDraftCampaign);
router.post("/:id/send", validateToken, requireAdmin, sendCampaign);
router.delete("/:id", validateToken, requireAdmin, deleteDraftCampaign);

module.exports = router;
