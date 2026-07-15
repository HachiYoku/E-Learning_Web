const express = require('express');
const router = express.Router();
const validateToken = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/adminMiddleware');
const { createImageUpload } = require("../middleware/uploadValidation");
const { getProfile, updateProfile, deletAccount, updateUserStatus, updateUserCourseAccess } = require('../controllers/userController');
const upload = createImageUpload();


router.get('/', validateToken, getProfile)

router.put('/', validateToken, upload.single('avatar'), updateProfile)

router.put('/:id/status', validateToken, requireAdmin, updateUserStatus)

router.put('/:id/course-access', validateToken, requireAdmin, updateUserCourseAccess)

router.delete('/:id', validateToken, requireAdmin, deletAccount)


module.exports = router
