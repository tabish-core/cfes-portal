/**
 * assignment.controller.js — HTTP handlers for Assignment CRUD operations.
 *
 * Like quizzes, assignments are many-per-course.
 * This controller provides full CRUD following the same pattern
 * established in quiz.controller.js.
 *
 * Routes:
 *   GET    /api/assignments/course/:courseId       — List all assignments for a course
 *   GET    /api/assignments/:assignmentId          — Get a single assignment
 *   POST   /api/assignments                        — Create a new assignment
 *   PUT    /api/assignments/:assignmentId          — Update an existing assignment
 *   DELETE /api/assignments/:assignmentId          — Delete an assignment
 */
const Assignment = require('../models/Assignment.model');
const { sendSuccess, sendError } = require('../utils/response');
const { generateAssignmentWord } = require('../services/documentService/generateAssignmentWord');

/* ── Helpers ───────────────────────────────────────────────────────────── */

const filled = (v) => typeof v === 'string' && v.trim().length > 0;

const validateAssignment = ({ assignmentInfo }) => {
  const errors = [];
  if (!assignmentInfo || typeof assignmentInfo !== 'object') {
    errors.push({ field: 'assignmentInfo', message: 'Assignment Information section is required.' });
    return errors;
  }
  if (!filled(assignmentInfo.assignmentNumber)) errors.push({ field: 'assignmentNumber', message: 'Assignment Number is required.' });
  return errors;
};

/** Strip empty strings from a dynamic list before storing. */
const cleanList = (arr) => (arr || []).map(s => (typeof s === 'string' ? s : (s?.text || ''))).filter(s => s.trim().length > 0);

/* ── GET /api/assignments/course/:courseId ──────────────────────────── */
/**
 * List all assignments belonging to the logged-in faculty for a given course.
 */
const getAssignmentsForCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;

    const assignments = await Assignment.find({ course: courseId, faculty: facultyId })
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, { assignments }, 'Assignments fetched');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/assignments/:assignmentId ────────────────────────────── */
/**
 * Get a single assignment by its MongoDB _id.
 */
const getAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId).lean();

    if (!assignment) {
      return sendError(res, 'Assignment not found', 404);
    }

    return sendSuccess(res, { assignment }, 'Assignment fetched');
  } catch (err) {
    next(err);
  }
};

/* ── POST /api/assignments ─────────────────────────────────────────── */
/**
 * Create a new assignment for a course.
 */
const createAssignment = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const {
      courseId,
      assignmentInfo,
      courseInfo,
      cloMappings,
      assignmentTitle,
      objective,
      assignmentDescription,
      tasks,
      submissionGuidelines,
      evaluationCriteria,
      tipsForSuccess
    } = req.body;

    if (!courseId) {
      return sendError(res, 'courseId is required', 400);
    }

    // Validate
    const errors = validateAssignment({ assignmentInfo });
    if (errors.length > 0) {
      return sendError(res, 'Validation failed', 400);
    }

    const assignment = await Assignment.create({
      course: courseId,
      faculty: facultyId,
      assignmentInfo,
      courseInfo: courseInfo || {},
      cloMappings: cloMappings || [],
      assignmentTitle: assignmentTitle || '',
      objective: objective || '',
      assignmentDescription: assignmentDescription || '',
      tasks: cleanList(tasks),
      submissionGuidelines: cleanList(submissionGuidelines),
      evaluationCriteria: cleanList(evaluationCriteria),
      tipsForSuccess: cleanList(tipsForSuccess),
      status: 'draft'
    });

    return sendSuccess(res, { assignment }, 'Assignment created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/* ── PUT /api/assignments/:assignmentId ────────────────────────────── */
/**
 * Update an existing assignment.
 */
const updateAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const {
      assignmentInfo,
      courseInfo,
      cloMappings,
      assignmentTitle,
      objective,
      assignmentDescription,
      tasks,
      submissionGuidelines,
      evaluationCriteria,
      tipsForSuccess
    } = req.body;

    const updateData = {
      assignmentInfo,
      courseInfo: courseInfo || {},
      cloMappings: cloMappings || [],
      assignmentTitle: assignmentTitle || '',
      objective: objective || '',
      assignmentDescription: assignmentDescription || '',
      tasks: cleanList(tasks),
      submissionGuidelines: cleanList(submissionGuidelines),
      evaluationCriteria: cleanList(evaluationCriteria),
      tipsForSuccess: cleanList(tipsForSuccess),
    };

    const assignment = await Assignment.findByIdAndUpdate(assignmentId, updateData, { new: true });

    if (!assignment) {
      return sendError(res, 'Assignment not found', 404);
    }

    return sendSuccess(res, { assignment }, 'Assignment updated successfully');
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/assignments/:assignmentId ──────────────────────────── */
/**
 * Delete an assignment.
 */
const deleteAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findByIdAndDelete(assignmentId);

    if (!assignment) {
      return sendError(res, 'Assignment not found', 404);
    }

    return sendSuccess(res, null, 'Assignment deleted successfully');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/assignments/:assignmentId/export ─────────────────────── */
/**
 * Export assignment to DOCX.
 */
const exportAssignmentWord = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId).lean();

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const buffer = await generateAssignmentWord(assignment);

    const safeCourse = (assignment.courseInfo?.courseTitle || 'Course').replace(/[^a-z0-9]/gi, '_');
    const safeAssignNum = (assignment.assignmentInfo?.assignmentNumber || 'Assignment').replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeCourse}_${safeAssignNum}.docx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (err) {
    console.error('Assignment export failed:', err);
    res.status(500).json({ success: false, message: 'Failed to generate Assignment document' });
  }
};

module.exports = {
  getAssignmentsForCourse,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  exportAssignmentWord
};
