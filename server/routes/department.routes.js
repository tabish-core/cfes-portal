const express = require('express');
const departmentController = require('../controllers/department.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireDesignation } = require('../middlewares/designation.middleware');

const router = express.Router();

router.get('/', verifyToken, requireDesignation('dean'), departmentController.getAllDepartments);
router.put('/:id/hod', verifyToken, requireDesignation('dean'), departmentController.assignHod);

module.exports = router;
