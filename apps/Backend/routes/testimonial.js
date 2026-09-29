const router = require("express").Router();
const { getTestimonials } = require("../controllers/testimonialController");

router.get("/", getTestimonials);

module.exports = router;
