const express = require('express');
const userController = require('../controllers/user.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireDesignation, requireDepartmentScope } = require('../middlewares/designation.middleware');

const router = express.Router();

// Dean + HoD (scoped)
router.get('/faculty', verifyToken, requireDesignation('dean', 'hod'), requireDepartmentScope, userController.getFaculties);
router.put('/faculty/:id', verifyToken, requireDesignation('dean'), userController.updateFaculty);

module.exports = router;
