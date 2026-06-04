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
const { requireDesignation, requireDepartmentScope }   = require('../middlewares/designation.middleware');

const router = express.Router();

/* ── Read all (Admin + Faculty) ────────────────────────────────────────── */
router.get(
  '/',
  verifyToken,
  requireDesignation('dean', 'hod', 'faculty'),
  requireDepartmentScope,
  courseController.getAllCourses
);

/* ── Read one (Admin + Faculty) ────────────────────────────────────────── */
router.get(
  '/:id',
  verifyToken,
  requireDesignation('dean', 'hod', 'faculty'),
  courseController.getCourse
);

module.exports = router;
