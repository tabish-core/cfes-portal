/**
 * courseOffering.service.js — Business logic for course offering operations.
 *
 * A CourseOffering links a faculty member to a course in a specific semester/section.
 */
const mongoose        = require('mongoose');
const CourseOffering   = require('../models/CourseOffering.model');
const Course           = require('../models/Course.model');
const User             = require('../models/User.model');
const Semester         = require('../models/Semester.model');

/* ── helpers ───────────────────────────────────────────────────────────── */
const fail = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
};

/* ── Service functions ─────────────────────────────────────────────────── */

/**
 * Create a new CourseOffering (admin assigns faculty → course → semester).
 *
 * Validates:
 *  1. All three IDs are valid ObjectIds pointing to existing documents.
 *  2. The faculty user is active and has role 'faculty'.
 *  3. The offering doesn't already exist (compound unique index will catch,
 *     but we provide a friendlier error message here).
 *
 * @param {string} facultyId
 * @param {string} courseId
 * @param {string} semesterId
 * @param {string} [section='A']
 */
const createOffering = async (facultyId, courseId, semesterId, section = 'A') => {
  // ── Validate IDs ────────────────────────────────────────────────────────
  if (!mongoose.Types.ObjectId.isValid(facultyId))  fail('Invalid faculty ID',  400);
  if (!mongoose.Types.ObjectId.isValid(courseId))    fail('Invalid course ID',   400);
  if (!mongoose.Types.ObjectId.isValid(semesterId))  fail('Invalid semester ID', 400);

  // ── Confirm documents exist ─────────────────────────────────────────────
  const [faculty, course, semester] = await Promise.all([
    User.findOne({ _id: facultyId, role: 'faculty' }),
    Course.findById(courseId),
    Semester.findById(semesterId),
  ]);

  if (!faculty)          fail('Faculty user not found', 404);
  if (!faculty.isActive) fail('Cannot assign course to a deactivated faculty account', 403);
  if (!course)           fail('Course not found', 404);
  if (!semester)         fail('Semester not found', 404);

  // ── Check for duplicate ─────────────────────────────────────────────────
  const duplicate = await CourseOffering.findOne({
    course: courseId,
    semester: semesterId,
    section: (section || 'A').toUpperCase().trim(),
  });
  if (duplicate) {
    fail(
      `This course (section ${(section || 'A').toUpperCase()}) is already assigned in this semester.`,
      409
    );
  }

  // ── Create ──────────────────────────────────────────────────────────────
  const offering = await CourseOffering.create({
    faculty: facultyId,
    course: courseId,
    semester: semesterId,
    section: (section || 'A').toUpperCase().trim(),
  });

  return offering.populate([
    { path: 'faculty', select: 'name email department' },
    { path: 'course', select: 'courseCode courseName type creditHours' },
    { path: 'semester', select: 'name status' },
  ]);
};

/**
 * Remove (unassign) a course offering by its _id.
 */
const removeOffering = async (offeringId) => {
  if (!mongoose.Types.ObjectId.isValid(offeringId)) fail('Invalid offering ID', 400);

  const offering = await CourseOffering.findById(offeringId);
  if (!offering) fail('Course offering not found', 404);

  await offering.deleteOne();
  return offering;
};

/**
 * List all offerings for a given semester, populated with faculty + course info.
 */
const listOfferingsBySemester = async (semesterId) => {
  if (!mongoose.Types.ObjectId.isValid(semesterId)) fail('Invalid semester ID', 400);

  return CourseOffering.find({ semester: semesterId })
    .populate('faculty', 'name email department')
    .populate('course', 'courseCode courseName type creditHours')
    .populate('semester', 'name status')
    .sort({ 'course.courseCode': 1 });
};

/**
 * Return offerings for a specific faculty in a specific semester.
 * Used by the faculty dashboard (faculty selects semester manually).
 *
 * @param {string} facultyId
 * @param {string} semesterId
 */
const getMyOfferings = async (facultyId, semesterId) => {
  if (!mongoose.Types.ObjectId.isValid(semesterId)) fail('Invalid semester ID', 400);

  return CourseOffering.find({ faculty: facultyId, semester: semesterId })
    .populate('course', 'courseCode courseName type creditHours')
    .populate('semester', 'name status')
    .sort({ 'course.courseCode': 1 })
    .lean();
};

module.exports = {
  createOffering,
  removeOffering,
  listOfferingsBySemester,
  getMyOfferings,
};
