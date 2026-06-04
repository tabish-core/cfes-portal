/**
 * course.controller.js — HTTP handlers for course-related endpoints.
 *
 * NOTE: assignFaculty / unassignFaculty / getMyCourses have been removed.
 *       Faculty assignment is now handled via /api/offerings (CourseOffering).
 */
const courseService            = require('../services/course.service');
const { sendSuccess, sendError } = require('../utils/response');

/* ── GET /api/courses ──────────────────────────────────────────────────── */
/**
 * List all courses (catalog view).
 */
const getAllCourses = async (req, res, next) => {
  try {
    const courses = await courseService.listCourses(req.departmentFilter || {});
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

module.exports = { getAllCourses, getCourse };
