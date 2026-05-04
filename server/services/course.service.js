/**
 * course.service.js — Business logic for course operations.
 *
 * Keeps controllers thin; all DB interaction lives here.
 */
const mongoose = require('mongoose');
const Course   = require('../models/Course.model');
const User     = require('../models/User.model');

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
 * Return all courses, optionally populated with faculty name + email.
 */
const listCourses = async () => {
  return Course.find()
    .populate('assignedFaculty', 'name email department')
    .select('-__v')
    .sort({ courseCode: 1 });
};

/**
 * Return a single course by its MongoDB _id.
 */
const getCourseById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) fail('Invalid course ID', 400);

  const course = await Course.findById(id)
    .populate('assignedFaculty', 'name email department')
    .select('-__v');

  if (!course) fail('Course not found', 404);
  return course;
};

/**
 * Assign a faculty member to a course.
 *
 * Rules enforced:
 *  1. courseId must be a valid ObjectId pointing to an existing course.
 *  2. facultyId must point to an active User with role === 'faculty'.
 *  3. If the course already has a faculty assigned, the request is rejected
 *     unless `force: true` is passed in options (admin override).
 *
 * @param {string}  courseId
 * @param {string}  facultyId
 * @param {object}  [opts]
 * @param {boolean} [opts.force=false] — override the "already assigned" guard
 * @returns {Promise<Course>} updated course document
 */
const assignFaculty = async (courseId, facultyId, { force = false } = {}) => {
  // ── 1. Validate IDs ──────────────────────────────────────────────────
  if (!mongoose.Types.ObjectId.isValid(courseId))  fail('Invalid course ID',  400);
  if (!mongoose.Types.ObjectId.isValid(facultyId)) fail('Invalid faculty ID', 400);

  // ── 2. Confirm course exists ─────────────────────────────────────────
  const course = await Course.findById(courseId);
  if (!course) fail('Course not found', 404);

  // ── 3. Guard: already assigned? ──────────────────────────────────────
  if (course.assignedFaculty && !force) {
    fail(
      'This course already has a faculty assigned. ' +
      'Pass force: true to override.',
      409
    );
  }

  // ── 4. Confirm faculty user exists and is active ─────────────────────
  const faculty = await User.findOne({ _id: facultyId, role: 'faculty' });
  if (!faculty)          fail('Faculty user not found', 404);
  if (!faculty.isActive) fail('Cannot assign course to a deactivated faculty account', 403);

  // ── 5. Persist ───────────────────────────────────────────────────────
  course.assignedFaculty = facultyId;
  await course.save();

  // Return populated document
  return course.populate('assignedFaculty', 'name email department');
};

/**
 * Remove (unassign) the faculty from a course.
 */
const unassignFaculty = async (courseId) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) fail('Invalid course ID', 400);

  const course = await Course.findById(courseId);
  if (!course) fail('Course not found', 404);

  if (!course.assignedFaculty) fail('Course has no faculty assigned', 400);

  course.assignedFaculty = null;
  await course.save();

  return course;
};

/**
 * Return only the courses assigned to a specific faculty member.
 *
 * Optimised:
 *  - Filter on assignedFaculty (indexed field) — no full-collection scan.
 *  - select() pulls only the fields the dashboard needs.
 *  - No populate() needed — we already have the faculty from req.user.
 *
 * @param {string} facultyId — req.user._id from verifyToken
 * @returns {Promise<Course[]>}
 */
const getMyCourses = async (facultyId) => {
  return Course.find({ assignedFaculty: facultyId, isActive: true })
    .select('courseCode courseName type')
    .sort({ courseCode: 1 })
    .lean(); // plain JS objects — faster, no Mongoose overhead
};

module.exports = { listCourses, getCourseById, assignFaculty, unassignFaculty, getMyCourses };
