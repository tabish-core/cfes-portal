/**
 * course.routes.js — Route definitions for /api/courses
 *
 * Auth chain:
 *   verifyToken  → confirms valid JWT, attaches req.user
 *   requireRole  → enforces role-based access
 *
 * Endpoints:
 *   GET    /api/courses              — Admin + Faculty (read all courses)
 *   GET    /api/courses/my-courses   — Faculty only (own assigned courses)
 *   GET    /api/courses/:id          — Admin + Faculty (read one course)
 *   PATCH  /api/courses/:id/assign   — Admin only (assign faculty)
 *   PATCH  /api/courses/:id/unassign — Admin only (remove assignment)
 */
const express           = require('express');
const courseController  = require('../controllers/course.controller');
const { verifyToken }   = require('../middlewares/auth.middleware');
const { requireRole }   = require('../middlewares/role.middleware');

const router = express.Router();

/* ── Read (Admin + Faculty) ─────────────────────────────────────────────── */
router.get(
  '/',
  verifyToken,
  requireRole('admin', 'faculty'),
  courseController.getAllCourses
);

/* ── Faculty: own courses only ────────────────────────────────────────── */
// IMPORTANT: /my-courses must be registered BEFORE /:id so Express doesn't
// treat the literal string "my-courses" as a dynamic :id parameter.
router.get(
  '/my-courses',
  verifyToken,
  requireRole('faculty'),
  courseController.getMyCourses
);

/* ── Read one (Admin + Faculty) ────────────────────────────────────── */
router.get(
  '/:id',
  verifyToken,
  requireRole('admin', 'faculty'),
  courseController.getCourse
);

/* ── Assignment management (Admin only) ─────────────────────────────────── */
router.patch(
  '/:id/assign',
  verifyToken,
  requireRole('admin'),
  courseController.assignFaculty
);

router.patch(
  '/:id/unassign',
  verifyToken,
  requireRole('admin'),
  courseController.unassignFaculty
);

module.exports = router;
