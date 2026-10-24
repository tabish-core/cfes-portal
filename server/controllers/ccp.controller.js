/**
 * ccp.controller.js — HTTP handlers for CCP / Class Project / PBL form (formType: 'ASSESS_PROJECT').
 *
 * Implements:
 *   - getCCPForm:  Fetch CCP data for a course with course/faculty authorization and semester resolution.
 *   - saveCCPForm: Create or update CCP data using atomic upsert, preserving existing fields and isolating data.
 */
const mongoose = require('mongoose');
const CCP = require('../models/CCP.model');
const Course = require('../models/Course.model');
const CourseOffering = require('../models/CourseOffering.model');
const Semester = require('../models/Semester.model');
const { sendSuccess, sendError } = require('../utils/response');
const { generateCCPWord } = require('../services/documentService/generateCCPWord');
const { generateCCPPDF } = require('../services/documentService/generateCCPPDF');

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

  // Dean has universal access
  if (user.designation === 'dean') {
    return { authorized: true, course };
  }

  // HoD is scoped to their department
  if (user.designation === 'hod') {
    if (!user.department || (course.department && course.department.toString() !== user.department.toString())) {
      return {
        authorized: false,
        status: 403,
        message: 'Forbidden. You are only allowed to access courses belonging to your department.',
      };
    }
    return { authorized: true, course };
  }

  // Faculty must be assigned to the course
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
 * Resolves the semester ObjectId for a course/faculty CCP document.
 *
 * Resolution order:
 *  1. Explicitly requested semesterId (if valid ObjectId)
 *  2. Semester of an existing CCP record for this course + faculty
 *  3. Active semester where an offering exists for this course + faculty
 *  4. System active semester (fallback)
 *  5. null (if no semester records exist)
 */
const resolveSemester = async (requestedSemesterId, courseId, facultyId) => {
  if (requestedSemesterId && mongoose.Types.ObjectId.isValid(requestedSemesterId)) {
    return new mongoose.Types.ObjectId(requestedSemesterId);
  }

  // Check if a record already exists to preserve its semester
  const existing = await CCP.findOne({
    course: courseId,
    faculty: facultyId,
    formType: 'ASSESS_PROJECT',
  }).select('semester');

  if (existing && existing.semester) {
    return existing.semester;
  }

  // Try to find the active semester
  const activeSemester = await Semester.findOne({ status: 'active' });
  if (activeSemester) {
    const offeringExists = await CourseOffering.exists({
      course: courseId,
      faculty: facultyId,
      semester: activeSemester._id,
    });
    if (offeringExists) {
      return activeSemester._id;
    }
    return activeSemester._id;
  }

  return null;
};

/**
 * @route   GET /api/forms/ccp/:courseId
 * @access  Private (Authenticated Faculty/HoD/Dean)
 *
 * Query params:
 *   semester — Semester ObjectId (optional)
 *   faculty  — Faculty ObjectId (optional, only Dean/HoD can view other faculty data)
 */
const getCCPForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { semester: requestedSemesterId, faculty: queryFacultyId } = req.query;

    // 1. Authorize course access
    const authCheck = await checkCourseAccess(req.user, courseId);
    if (!authCheck.authorized) {
      return sendError(res, authCheck.message, authCheck.status);
    }

    // 2. Faculty isolation: Faculty can only retrieve their own records
    let targetFacultyId = req.user._id;
    if (
      queryFacultyId &&
      (req.user.designation === 'dean' || req.user.designation === 'hod') &&
      mongoose.Types.ObjectId.isValid(queryFacultyId)
    ) {
      targetFacultyId = new mongoose.Types.ObjectId(queryFacultyId);
    }

    // 3. Build query
    const query = {
      course: courseId,
      faculty: targetFacultyId,
      formType: 'ASSESS_PROJECT',
    };

    if (requestedSemesterId && mongoose.Types.ObjectId.isValid(requestedSemesterId)) {
      query.semester = new mongoose.Types.ObjectId(requestedSemesterId);
    }

    let form = await CCP.findOne(query);

    // If no document found and no specific semester was requested, check with active semester
    if (!form && !requestedSemesterId) {
      const activeSem = await Semester.findOne({ status: 'active' });
      if (activeSem) {
        form = await CCP.findOne({
          course: courseId,
          faculty: targetFacultyId,
          formType: 'ASSESS_PROJECT',
          semester: activeSem._id,
        });
      }
    }

    return sendSuccess(res, { form: form || null }, 'CCP form fetched successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/forms/ccp
 * @route   PUT  /api/forms/ccp/:courseId
 * @access  Private (Authenticated Faculty/HoD/Dean)
 *
 * Body:
 *   courseId               — Course ObjectId (required)
 *   semesterId             — Semester ObjectId (optional)
 *   headerInfo             — { department, program, courseTitle, courseCode, announcedDate, dueDate, totalMarks }
 *   mappingTable           — { mappedClo, sdg, knowledgeProfile, complexProblemSolvingMapped }
 *   problemStatement       — string
 *   constraintsAssumptions — string
 *   computationalTools     — string
 *   expectedOutcomes       — string
 *   deliverables           — { heading, items: [{ label, required, completed }] }
 *   wpAttributes           — [{ code, title, description, isMapped, justification }]
 *   status                 — 'draft' | 'submitted'
 */
const saveCCPForm = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.body.courseId;
    const {
      semesterId,
      headerInfo,
      mappingTable,
      problemStatement,
      constraintsAssumptions,
      computationalTools,
      expectedOutcomes,
      deliverables,
      wpAttributes,
      status,
    } = req.body;

    // 1. Authorize course access
    const authCheck = await checkCourseAccess(req.user, courseId);
    if (!authCheck.authorized) {
      return sendError(res, authCheck.message, authCheck.status);
    }

    // 2. Faculty isolation: saving is strictly bound to the authenticated user's ID
    const facultyId = req.user._id;

    // 3. Resolve semester
    const resolvedSemesterId = await resolveSemester(semesterId, courseId, facultyId);

    // 4. Build unique upsert filter
    const filter = {
      course: courseId,
      faculty: facultyId,
      formType: 'ASSESS_PROJECT',
    };
    if (resolvedSemesterId) {
      filter.semester = resolvedSemesterId;
    }

    // 5. Build update data (using $set to prevent accidental field deletion on partial saves)
    const updateData = {
      course: courseId,
      faculty: facultyId,
      formType: 'ASSESS_PROJECT',
      status: status === 'submitted' ? 'submitted' : 'draft',
    };

    if (resolvedSemesterId) {
      updateData.semester = resolvedSemesterId;
    }

    if (headerInfo !== undefined && typeof headerInfo === 'object') {
      updateData.headerInfo = headerInfo;
    }
    if (mappingTable !== undefined && typeof mappingTable === 'object') {
      updateData.mappingTable = mappingTable;
    }
    if (problemStatement !== undefined) {
      updateData.problemStatement = typeof problemStatement === 'string' ? problemStatement : '';
    }
    if (constraintsAssumptions !== undefined) {
      updateData.constraintsAssumptions = typeof constraintsAssumptions === 'string' ? constraintsAssumptions : '';
    }
    if (computationalTools !== undefined) {
      updateData.computationalTools = typeof computationalTools === 'string' ? computationalTools : '';
    }
    if (expectedOutcomes !== undefined) {
      updateData.expectedOutcomes = typeof expectedOutcomes === 'string' ? expectedOutcomes : '';
    }
    if (deliverables !== undefined && typeof deliverables === 'object') {
      updateData.deliverables = deliverables;
    }
    if (wpAttributes !== undefined && Array.isArray(wpAttributes)) {
      updateData.wpAttributes = wpAttributes;
    }

    // 6. Execute atomic upsert
    const form = await CCP.findOneAndUpdate(
      filter,
      { $set: updateData },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    return sendSuccess(res, { form }, 'CCP form saved successfully.');
  } catch (err) {
    if (err.code === 11000) {
      return sendError(res, 'A CCP record already exists for this course, faculty, and semester.', 409);
    }
    next(err);
  }
};

/**
 * @route   GET /api/forms/ccp/:courseId/export
 * @access  Private (Authenticated Faculty/HoD/Dean)
 *
 * Query params:
 *   format   — 'docx' | 'pdf'
 *   semester — Semester ObjectId (optional)
 *   faculty  — Faculty ObjectId (optional, Dean/HoD only)
 */
const exportCCPForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { format, semester: requestedSemesterId, faculty: queryFacultyId } = req.query;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    if (!format || !['docx', 'pdf'].includes(format.toLowerCase())) {
      return sendError(res, "Invalid export format. Must be 'docx' or 'pdf'.", 400);
    }

    // 1. Authorize course access
    const authCheck = await checkCourseAccess(req.user, courseId);
    if (!authCheck.authorized) {
      return sendError(res, authCheck.message, authCheck.status);
    }

    // 2. Faculty isolation
    let targetFacultyId = req.user._id;
    if (
      queryFacultyId &&
      (req.user.designation === 'dean' || req.user.designation === 'hod') &&
      mongoose.Types.ObjectId.isValid(queryFacultyId)
    ) {
      targetFacultyId = new mongoose.Types.ObjectId(queryFacultyId);
    }

    // 3. Query CCP document
    const query = {
      course: courseId,
      faculty: targetFacultyId,
      formType: 'ASSESS_PROJECT',
    };

    if (requestedSemesterId && mongoose.Types.ObjectId.isValid(requestedSemesterId)) {
      query.semester = new mongoose.Types.ObjectId(requestedSemesterId);
    }

    let form = await CCP.findOne(query).lean();

    // Fallback to active semester if no document found and no specific semester was requested
    if (!form && !requestedSemesterId) {
      const activeSem = await Semester.findOne({ status: 'active' });
      if (activeSem) {
        form = await CCP.findOne({
          course: courseId,
          faculty: targetFacultyId,
          formType: 'ASSESS_PROJECT',
          semester: activeSem._id,
        }).lean();
      }
    }

    if (!form) {
      return sendError(res, 'CCP form not found. Please save it first.', 404);
    }

    const exportData = {
      headerInfo: form.headerInfo || {},
      mappingTable: form.mappingTable || {},
      problemStatement: form.problemStatement || '',
      constraintsAssumptions: form.constraintsAssumptions || '',
      computationalTools: form.computationalTools || '',
      expectedOutcomes: form.expectedOutcomes || '',
      deliverables: form.deliverables || {},
      wpAttributes: form.wpAttributes || [],
    };

    const courseCode = form.headerInfo?.courseCode || authCheck.course?.courseCode || 'Course';
    const sanitizedCode = courseCode.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format.toLowerCase() === 'docx') {
      const buffer = await generateCCPWord(exportData);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="CCP_Class_Project_${sanitizedCode}.docx"`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      return res.send(buffer);
    }

    if (format.toLowerCase() === 'pdf') {
      const buffer = await generateCCPPDF(exportData);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="CCP_Class_Project_${sanitizedCode}.pdf"`
      );
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(buffer);
    }
  } catch (err) {
    console.error('Error in exportCCPForm:', err);
    next(err);
  }
};

module.exports = {
  getCCPForm,
  saveCCPForm,
  exportCCPForm,
  checkCourseAccess,
  resolveSemester,
};
