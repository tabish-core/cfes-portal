/**
 * course.routes.js — Route definitions for /api/courses
 *
 * Auth chain:
 *   verifyToken  → confirms valid JWT, attaches req.user
 *   requireRole  → enforces role-based access
 *
 * Endpoints:
 *   GET    /api/courses              — Admin + Faculty (read all courses)
 *   GET    /api/courses/:id          — Admin + Faculty (read one course)
 *
 * NOTE: assign / unassign / my-courses routes have been moved to
 *       /api/offerings (courseOffering.routes.js) as part of the
 *       Semester + CourseOffering refactor.
 */
const express           = require('express');
const courseController  = require('../controllers/course.controller');
const { verifyToken }   = require('../middlewares/auth.middleware');
const { requireRole }   = require('../middlewares/role.middleware');

const router = express.Router();

/* ── Read all (Admin + Faculty) ────────────────────────────────────────── */
router.get(
  '/',
  verifyToken,
  requireRole('admin', 'faculty'),
  courseController.getAllCourses
);

/* ── Read one (Admin + Faculty) ────────────────────────────────────────── */
router.get(
  '/:id',
  verifyToken,
  requireRole('admin', 'faculty'),
  courseController.getCourse
);

module.exports = router;
