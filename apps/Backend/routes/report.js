const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { getReportSummary, exportReportCsv } = require("../controllers/reportController");

const router = express.Router();

router.get("/summary", validateToken, requireAdmin, getReportSummary);
router.get("/export", validateToken, requireAdmin, exportReportCsv);

module.exports = router;
