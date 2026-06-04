/**
 * course.service.js — Business logic for course operations.
 *
 * Keeps controllers thin; all DB interaction lives here.
 *
 * NOTE: assignFaculty / unassignFaculty / getMyCourses have been removed.
 *       Faculty assignment is now handled via CourseOffering + Semester.
 *       The Course.assignedFaculty field is kept temporarily for backward
 *       compatibility but is no longer used by new logic.
 */
const mongoose = require('mongoose');
const Course   = require('../models/Course.model');

/* ── helpers ───────────────────────────────────────────────────────────── */

/**
 * Throw a structured error that the centralised error handler understands.
 * @param {string} message
 * @param {number} statusCode
 */
const fail = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
};

/* ── Service functions ─────────────────────────────────────────────────── */

/**
 * Return all courses (catalog view — no faculty population).
 */
const listCourses = async (departmentFilter = {}) => {
  return Course.find(departmentFilter)
    .select('-__v')
    .sort({ courseCode: 1 });
};

/**
 * Return a single course by its MongoDB _id.
 */
const getCourseById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) fail('Invalid course ID', 400);

  const course = await Course.findById(id)
    .select('-__v');

  if (!course) fail('Course not found', 404);
  return course;
};

module.exports = { listCourses, getCourseById };
