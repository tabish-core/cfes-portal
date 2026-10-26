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
const Department       = require('../models/Department.model');

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
const createOffering = async (facultyId, courseId, semesterId, section = 'A', user) => {
  // ── Validate IDs ────────────────────────────────────────────────────────
  if (!mongoose.Types.ObjectId.isValid(facultyId))  fail('Invalid faculty ID',  400);
  if (!mongoose.Types.ObjectId.isValid(courseId))    fail('Invalid course ID',   400);
  if (!mongoose.Types.ObjectId.isValid(semesterId))  fail('Invalid semester ID', 400);

  // ── Confirm documents exist ─────────────────────────────────────────────
  const [faculty, course, semester] = await Promise.all([
    User.findById(facultyId),
    Course.findById(courseId),
    Semester.findById(semesterId),
  ]);

  if (!faculty)          fail('Faculty user not found', 404);
  if (!faculty.isActive) fail('Cannot assign course to a deactivated faculty account', 403);
  if (!course)           fail('Course not found', 404);
  if (!semester)         fail('Semester not found', 404);

  // If HoD, restrict to their department
  if (user && user.designation === 'hod') {
    const courseDept = course.department?._id || course.department;
    if (!user.department || !courseDept || courseDept.toString() !== user.department.toString()) {
      fail('You are only allowed to assign courses belonging to your department.', 403);
    }
  }

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
const removeOffering = async (offeringId, user) => {
  if (!mongoose.Types.ObjectId.isValid(offeringId)) fail('Invalid offering ID', 400);

  const offering = await CourseOffering.findById(offeringId).populate('course');
  if (!offering) fail('Course offering not found', 404);

  if (user && user.designation === 'hod') {
    const courseDept = offering.course?.department?._id || offering.course?.department;
    if (!user.department || !courseDept || courseDept.toString() !== user.department.toString()) {
      fail('You are only allowed to remove offerings belonging to your department.', 403);
    }
  }

  await offering.deleteOne();
  return offering;
};

/**
 * List all offerings for a given semester, populated with faculty + course info.
 */
const listOfferingsBySemester = async (semesterId, departmentFilter = {}) => {
  if (!mongoose.Types.ObjectId.isValid(semesterId)) fail('Invalid semester ID', 400);

  let courseFilter = {};
  if (departmentFilter.department) {
    const courses = await Course.find({ department: departmentFilter.department }, '_id');
    const courseIds = courses.map(c => c._id);
    courseFilter = { course: { $in: courseIds } };
  } else if (departmentFilter._id === null) {
    // If blocked
    return [];
  }

  return CourseOffering.find({ semester: semesterId, ...courseFilter })
    .populate('faculty', 'name email department')
    .populate('course', 'courseCode courseName type creditHours department')
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

/**
 * Compute dashboard statistics for a faculty member in a given semester.
 *
 * Returns:
 *  totalCourses     – Number of course offerings assigned to the faculty
 *  totalForms       – Total form slots available (courses × implemented form types)
 *  draftForms       – Forms saved but not yet submitted
 *  submittedForms   – Forms that have been submitted
 *  pendingForms     – Form slots with no document created yet
 *
 * Currently implemented form types: CIS, CCR  (2 per course).
 * Expand FORM_TYPES_COUNT when new form models are added.
 */
const getMyDashboardStats = async (facultyId, semesterId) => {
  if (!mongoose.Types.ObjectId.isValid(semesterId)) fail('Invalid semester ID', 400);

  const CIS = require('../models/CIS.model');
  const CCR = require('../models/CCR.model');

  const FORM_TYPES_COUNT = 2; // CIS + CCR

  // Count course offerings
  const totalCourses = await CourseOffering.countDocuments({
    faculty: facultyId,
    semester: semesterId,
  });

  const totalForms = totalCourses * FORM_TYPES_COUNT;

  // Count CIS forms by status
  const [cisDraft, cisSubmitted] = await Promise.all([
    CIS.countDocuments({ faculty: facultyId, semester: semesterId, status: 'draft' }),
    CIS.countDocuments({ faculty: facultyId, semester: semesterId, status: 'submitted' }),
  ]);

  // Count CCR forms by status
  const [ccrDraft, ccrSubmitted] = await Promise.all([
    CCR.countDocuments({ faculty: facultyId, semester: semesterId, status: 'draft' }),
    CCR.countDocuments({ faculty: facultyId, semester: semesterId, status: 'submitted' }),
  ]);

  const draftForms     = cisDraft + ccrDraft;
  const submittedForms = cisSubmitted + ccrSubmitted;
  const pendingForms   = Math.max(0, totalForms - draftForms - submittedForms);

  return { totalCourses, totalForms, draftForms, submittedForms, pendingForms };
};

/**
 * Retrieve a single CourseOffering by ID and verify user authorization.
 *
 * Rules:
 *  - Faculty can only access their own offering.
 *  - HoD can only access offerings within their department.
 *  - Dean has global access.
 */
const getOfferingById = async (offeringId, user) => {
  if (!mongoose.Types.ObjectId.isValid(offeringId)) fail('Invalid offering ID', 400);

  const offering = await CourseOffering.findById(offeringId)
    .populate({
      path: 'course',
      select: 'courseCode courseName type creditHours isLab department',
      populate: { path: 'department', select: 'name code' }
    })
    .populate('faculty', 'name email department designation')
    .populate('semester', 'name status');

  if (!offering) fail('Course offering not found', 404);

  // Authorization enforcement
  if (user) {
    if (user.designation === 'dean') {
      // Dean has universal access across all departments and offerings
      return offering;
    }

    const offeringFacultyId = offering.faculty?._id
      ? offering.faculty._id.toString()
      : offering.faculty?.toString();
    const isAssignedFaculty = Boolean(offeringFacultyId && offeringFacultyId === user._id.toString());

    // If the authenticated user (faculty or HoD) is assigned to teach this offering,
    // grant instructor access unconditionally.
    if (isAssignedFaculty) {
      return offering;
    }

    // If not the assigned instructor, check designation permissions (HoD departmental access)
    if (user.designation === 'hod') {
      const courseDept = offering.course?.department?._id || offering.course?.department;
      if (!user.department || !courseDept || courseDept.toString() !== user.department.toString()) {
        fail('You are only authorized to access course offerings belonging to your department.', 403);
      }
    } else {
      fail('You are not authorized to access this course offering.', 403);
    }
  }

  return offering;
};

/**
 * Verifies if the requesting user is authorized to access the given course.
 *
 * Authorization rules:
 *   - Dean: universal access across all departments.
 *   - HoD: allowed if the course belongs to the HoD's assigned department.
 *   - Faculty: allowed if assigned via CourseOffering or Course.assignedFaculty.
 *
 * @param {Object} user - Authenticated user from req.user
 * @param {string} courseId - Course MongoDB ObjectId string
 * @returns {Promise<{ authorized: boolean, status?: number, message?: string, course?: Object }>}
 */
const checkCourseAccess = async (user, courseId) => {
  if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
    return { authorized: false, status: 400, message: 'Invalid or missing Course ID.' };
  }

  const course = await Course.findById(courseId);
  if (!course) {
    return { authorized: false, status: 404, message: 'Course not found.' };
  }

  if (user.designation === 'dean') {
    return { authorized: true, course };
  }

  if (user.designation === 'hod') {
    const courseDept = course.department?._id || course.department;
    if (!user.department || !courseDept || courseDept.toString() !== user.department.toString()) {
      return {
        authorized: false,
        status: 403,
        message: 'Forbidden. As HoD, you are only allowed to access courses belonging to your department.',
      };
    }
    return { authorized: true, course };
  }

  const isAssigned =
    (await CourseOffering.exists({ course: courseId, faculty: user._id })) ||
    (course.assignedFaculty && course.assignedFaculty.toString() === user._id.toString());

  if (!isAssigned) {
    return {
      authorized: false,
      status: 403,
      message: 'Forbidden. You are not assigned to this course.',
    };
  }

  return { authorized: true, course };
};

/**
 * Resolves course offerings for a legacy context (where offeringId was not supplied).
 *
 * Rules:
 *  - If multiple offerings match (e.g. Section A and Section B, or multiple semesters),
 *    the target cannot be established reliably -> { ambiguous: true, count, offerings }
 *  - If exactly 1 offering matches -> { ambiguous: false, count: 1, offering: offerings[0] }
 *  - If 0 offerings match -> { ambiguous: false, count: 0, offering: null }
 *
 * @param {Object} user - Authenticated user (req.user)
 * @param {string} courseId - Course ObjectId
 * @param {string} [semesterId] - Optional semester ObjectId
 * @param {string} [facultyId=null] - Optional override faculty ObjectId (for Dean/HOD)
 */
const resolveOfferingForLegacyContext = async (user, courseId, semesterId, facultyId = null) => {
  const targetFacultyId = facultyId || user._id;
  const query = {
    course: courseId,
    faculty: targetFacultyId,
  };
  if (semesterId && mongoose.Types.ObjectId.isValid(semesterId)) {
    query.semester = semesterId;
  }

  const offerings = await CourseOffering.find(query)
    .populate({
      path: 'course',
      select: 'courseCode courseName type creditHours isLab department',
      populate: { path: 'department', select: 'name code' }
    })
    .populate('faculty', 'name email department designation')
    .populate('semester', 'name status');

  if (offerings.length > 1) {
    return { ambiguous: true, count: offerings.length, offerings };
  }

  if (offerings.length === 1) {
    return { ambiguous: false, count: 1, offering: offerings[0] };
  }

  return { ambiguous: false, count: 0, offering: null };
};

module.exports = {
  createOffering,
  removeOffering,
  listOfferingsBySemester,
  getMyOfferings,
  getMyDashboardStats,
  getOfferingById,
  checkCourseAccess,
  resolveOfferingForLegacyContext,
};


