/**
 * courseOffering.routes.js — Route definitions for /api/offerings
 *
 * Endpoints:
 *   POST   /api/offerings              — Admin only (create offering)
 *   GET    /api/offerings/my-courses   — Faculty only (own offerings by semester)
 *   GET    /api/offerings              — Admin only (list by semester)
 *   DELETE /api/offerings/:id          — Admin only (remove offering)
 */
const express               = require('express');
const offeringController    = require('../controllers/courseOffering.controller');
const { verifyToken }       = require('../middlewares/auth.middleware');
const { requireDesignation, requireDepartmentScope }       = require('../middlewares/designation.middleware');

const router = express.Router();

/* ── Create offering (Admin only) ──────────────────────────────────────── */
router.post(
  '/',
  verifyToken,
  requireDesignation('dean', 'hod'),
  offeringController.createOffering
);

/* ── Faculty: own courses by semester ──────────────────────────────────── */
// IMPORTANT: /my-courses must be registered BEFORE /:id
router.get(
  '/my-courses',
  verifyToken,
  requireDesignation('faculty', 'hod'),
  offeringController.getMyOfferings
);

/* ── List by semester (Admin) ──────────────────────────────────────────── */
router.get(
  '/',
  verifyToken,
  requireDesignation('dean', 'hod'),
  requireDepartmentScope,
  offeringController.listBySemester
);

/* ── Remove offering (Admin only) ──────────────────────────────────────── */
router.delete(
  '/:id',
  verifyToken,
  requireDesignation('dean', 'hod'),
  offeringController.removeOffering
);

module.exports = router;
