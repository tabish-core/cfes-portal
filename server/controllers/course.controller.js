/**
 * course.controller.js — HTTP handlers for course-related endpoints.
 *
 * Input validation happens here (req.body shape).
 * Business logic + DB work is delegated to course.service.js.
 */
const courseService            = require('../services/course.service');
const { sendSuccess, sendError } = require('../utils/response');

/* ── GET /api/courses ──────────────────────────────────────────────────── */
/**
 * List all courses (Admin: all; Faculty: all — read-only).
 */
const getAllCourses = async (_req, res, next) => {
  try {
    const courses = await courseService.listCourses();
    return sendSuccess(res, { courses }, 'Courses fetched');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/courses/:id ──────────────────────────────────────────────── */
/**
 * Fetch a single course by its MongoDB _id.
 */
const getCourse = async (req, res, next) => {
  try {
    const course = await courseService.getCourseById(req.params.id);
    return sendSuccess(res, { course }, 'Course fetched');
  } catch (err) {
    next(err);
  }
};

/* ── PATCH /api/courses/:id/assign ────────────────────────────────────── */
/**
 * Admin assigns (or force-reassigns) a faculty to a course.
 *
 * Body:
 *   { facultyId: string, force?: boolean }
 *
 * - facultyId is required.
 * - force (optional) allows overwriting an existing assignment.
 */
const assignFaculty = async (req, res, next) => {
  try {
    const { id: courseId } = req.params;
    const { facultyId, force } = req.body;

    // ── Input validation ──────────────────────────────────────────────
    if (!facultyId || typeof facultyId !== 'string' || !facultyId.trim()) {
      return sendError(res, 'facultyId is required in the request body', 400);
    }

    const course = await courseService.assignFaculty(
      courseId,
      facultyId.trim(),
      { force: force === true }
    );

    return sendSuccess(res, { course }, 'Faculty assigned to course successfully');
  } catch (err) {
    next(err);
  }
};

/* ── PATCH /api/courses/:id/unassign ──────────────────────────────────── */
/**
 * Admin removes the faculty assignment from a course.
 */
const unassignFaculty = async (req, res, next) => {
  try {
    const course = await courseService.unassignFaculty(req.params.id);
    return sendSuccess(res, { course }, 'Faculty unassigned from course');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/courses/my-courses ───────────────────────────────────────── */
/**
 * Faculty views only their assigned courses.
 * Identity comes from req.user (set by verifyToken) — no query param needed.
 */
const getMyCourses = async (req, res, next) => {
  try {
    const courses = await courseService.getMyCourses(req.user._id);
    return sendSuccess(res, { courses }, 'Your assigned courses fetched');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllCourses, getCourse, assignFaculty, unassignFaculty, getMyCourses };
