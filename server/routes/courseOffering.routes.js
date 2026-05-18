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
const { requireRole }       = require('../middlewares/role.middleware');

const router = express.Router();

/* ── Create offering (Admin only) ──────────────────────────────────────── */
router.post(
  '/',
  verifyToken,
  requireRole('admin'),
  offeringController.createOffering
);

/* ── Faculty: own courses by semester ──────────────────────────────────── */
// IMPORTANT: /my-courses must be registered BEFORE /:id
router.get(
  '/my-courses',
  verifyToken,
  requireRole('faculty'),
  offeringController.getMyOfferings
);

/* ── List by semester (Admin) ──────────────────────────────────────────── */
router.get(
  '/',
  verifyToken,
  requireRole('admin'),
  offeringController.listBySemester
);

/* ── Remove offering (Admin only) ──────────────────────────────────────── */
router.delete(
  '/:id',
  verifyToken,
  requireRole('admin'),
  offeringController.removeOffering
);

module.exports = router;
