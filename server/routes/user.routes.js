const express = require('express');
const userController = require('../controllers/user.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

const router = express.Router();

// Admin only
router.get('/faculty', verifyToken, requireRole('admin'), userController.getFaculties);
router.put('/faculty/:id', verifyToken, requireRole('admin'), userController.updateFaculty);

module.exports = router;
