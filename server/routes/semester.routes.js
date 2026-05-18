/**
 * semester.routes.js — Route definitions for /api/semesters
 *
 * Endpoints:
 *   POST   /api/semesters              — Admin only (create semester)
 *   GET    /api/semesters              — Admin + Faculty (list all)
 *   GET    /api/semesters/active       — Admin + Faculty (active semester)
 *   PATCH  /api/semesters/:id/toggle   — Admin only (toggle active/inactive)
 */
const express              = require('express');
const semesterController   = require('../controllers/semester.controller');
const { verifyToken }      = require('../middlewares/auth.middleware');
const { requireRole }      = require('../middlewares/role.middleware');

const router = express.Router();

/* ── Create (Admin only) ───────────────────────────────────────────────── */
router.post(
  '/',
  verifyToken,
  requireRole('admin'),
  semesterController.createSemester
);

/* ── List all (Admin + Faculty) ────────────────────────────────────────── */
router.get(
  '/',
  verifyToken,
  requireRole('admin', 'faculty'),
  semesterController.listSemesters
);

/* ── Active semester (Admin + Faculty) ─────────────────────────────────── */
// Must be registered BEFORE /:id
router.get(
  '/active',
  verifyToken,
  requireRole('admin', 'faculty'),
  semesterController.getActiveSemester
);

/* ── Toggle status (Admin only) ────────────────────────────────────────── */
router.patch(
  '/:id/toggle',
  verifyToken,
  requireRole('admin'),
  semesterController.toggleStatus
);

module.exports = router;
