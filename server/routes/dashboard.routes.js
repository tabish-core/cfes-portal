const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireDesignation } = require('../middlewares/designation.middleware');

// Routes mapping
router.get(
  '/dean',
  verifyToken,
  requireDesignation('dean'),
  dashboardController.getDeanDashboardStats
);

router.get(
  '/hod',
  verifyToken,
  requireDesignation('hod'),
  dashboardController.getHodDashboardStats
);

module.exports = router;
