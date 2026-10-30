const mongoose = require('mongoose');
const Assignment = require('../models/Assignment.model');
const CourseOffering = require('../models/CourseOffering.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const courseOfferingService = require('../services/courseOffering.service');
const courseFileService = require('../services/courseFile.service');
const { sendSuccess, sendError } = require('../utils/response');
const assignmentWordService = require('../services/documentService/generateAssignmentWord');


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

/**
 * Updates CourseChecklist item completion status for an offering.
 *
 * @param {Object|string} offering - The CourseOffering document or offeringId
 * @param {string} documentType - 'ASSESS_ASSIGN'
 * @param {boolean} isCompleted - Whether the item should be marked complete
 */
const updateAssessmentChecklist = async (offering, documentType, isCompleted) => {
  if (!offering) return;
  try {
    const offeringId = offering._id || offering;
    let checklist = await CourseChecklist.findOne({ courseOffering: offeringId });
    if (!checklist && offering.course && offering.faculty) {
      checklist = await CourseChecklist.findOne({
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: offering.semester?._id || offering.semester,
        section: offering.section || 'A',
      });
    }

    if (checklist) {
      if (!checklist.courseOffering) {
        checklist.courseOffering = offeringId;
        if (!checklist.section && offering.section) checklist.section = offering.section;
        if (!checklist.semester && offering.semester) {
          checklist.semester = offering.semester._id || offering.semester;
        }
      }
      if (Array.isArray(checklist.checklistItems)) {
        const item = checklist.checklistItems.find((i) => i.type === documentType);
        if (item && item.completed !== isCompleted) {
          item.completed = isCompleted;
          await checklist.save();
        }
      }
    }
  } catch (err) {
    console.warn(`Could not update checklist status for ${documentType}:`, err.message);
  }
};

/* ── GET /api/assignments/course/:courseId ──────────────────────────── */
/**
 * List all assignments for a course, scoped to CourseOffering if offeringId is provided.
 */
const getAssignmentsForCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { offeringId } = req.query;

    if (offeringId) {
      if (!mongoose.Types.ObjectId.isValid(offeringId)) {
        return sendError(res, 'Invalid offering ID', 400);
      }

      let offering;
      try {
        offering = await courseOfferingService.getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 403);
      }

      const offeringCourseId = (offering.course?._id || offering.course).toString();
      if (courseId && courseId !== 'undefined' && offeringCourseId !== courseId.toString()) {
        return sendError(res, 'Offering does not match the specified course', 400);
      }

      let assignments = await Assignment.find({ courseOffering: offering._id })
        .sort({ createdAt: -1 })
        .lean();

      // Safe fallback for unassociated legacy records ONLY when exactly 1 offering exists for this (course, faculty)
      if (assignments.length === 0) {
        const offeringFacultyId = offering.faculty?._id || offering.faculty;
        const offeringCount = await CourseOffering.countDocuments({
          course: offeringCourseId,
          faculty: offeringFacultyId,
        });

        if (offeringCount === 1) {
          assignments = await Assignment.find({
            course: offeringCourseId,
            faculty: offeringFacultyId,
            courseOffering: null,
          })
            .sort({ createdAt: -1 })
            .lean();
        }

      }

      return sendSuccess(res, { assignments }, 'Assignments fetched');
    }

    // Pure legacy call (no offeringId provided)
    const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
    if (!authCheck.authorized) {
      return sendError(res, authCheck.message, authCheck.status);
    }

    // Check if multiple offerings exist for this faculty + course
    const offeringCount = await CourseOffering.countDocuments({
      course: courseId,
      faculty: req.user._id,
    });

    if (offeringCount > 1) {
      // Ambiguous across multiple offerings: do not expose unassociated records across every offering
      return sendSuccess(res, { assignments: [] }, 'Multiple offerings exist for this course. Please specify offeringId.');
    }

    const assignments = await Assignment.find({
      course: courseId,
      faculty: req.user._id,
      courseOffering: null,
    })
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, { assignments }, 'Assignments fetched');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/assignments/offering/:offeringId ─────────────────────── */
/**
 * List all assignments scoped directly by offeringId.
 */
const getAssignmentsForOffering = async (req, res, next) => {
  try {
    const { offeringId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(offeringId)) {
      return sendError(res, 'Invalid offering ID', 400);
    }

    let offering;
    try {
      offering = await courseOfferingService.getOfferingById(offeringId, req.user);
    } catch (err) {
      return sendError(res, err.message, err.statusCode || 403);
    }

    const offeringCourseId = (offering.course?._id || offering.course).toString();
    req.params.courseId = offeringCourseId;
    req.query.offeringId = offeringId;
    return getAssignmentsForCourse(req, res, next);
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/assignments/:assignmentId ────────────────────────────── */
/**
 * Get a single assignment by its MongoDB _id with offering authorization.
 */
const getAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId).lean();

    if (!assignment) {
      return sendError(res, 'Assignment not found', 404);
    }

    if (assignment.courseOffering) {
      try {
        await courseOfferingService.getOfferingById(assignment.courseOffering, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 403);
      }
    } else {
      // Legacy unlinked record: check ownership or faculty access
      if (req.user.designation === 'faculty' && assignment.faculty.toString() !== req.user._id.toString()) {
        return sendError(res, 'You are not authorized to view this assignment', 403);
      }
    }

    return sendSuccess(res, { assignment }, 'Assignment fetched');
  } catch (err) {
    next(err);
  }
};

/* ── POST /api/assignments ─────────────────────────────────────────── */
/**
 * Create a new assignment with CourseOffering association and checklist completion.
 */
const createAssignment = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const {
      courseId,
      offeringId,
      assignmentInfo,
      courseInfo,
      cloMappings,
      assignmentTitle,
      objective,
      assignmentDescription,
      tasks,
      submissionGuidelines,
      evaluationCriteria,
      tipsForSuccess,
    } = req.body;

    if (!courseId && !offeringId) {
      return sendError(res, 'courseId or offeringId is required', 400);
    }

    // Validate
    const errors = validateAssignment({ assignmentInfo });
    if (errors.length > 0) {
      return sendError(res, 'Validation failed', 400);
    }

    if (offeringId) {
      if (!mongoose.Types.ObjectId.isValid(offeringId)) {
        return sendError(res, 'Invalid offering ID', 400);
      }

      let offering;
      try {
        offering = await courseOfferingService.getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 403);
      }

      const offeringCourseId = (offering.course?._id || offering.course).toString();
      if (courseId && courseId !== 'undefined' && offeringCourseId !== courseId.toString()) {
        return sendError(res, 'Offering does not match the specified course', 400);
      }

      const assignment = await Assignment.create({
        courseOffering: offering._id,
        course: offeringCourseId,
        faculty: offering.faculty?._id || offering.faculty,
        semester: offering.semester?._id || offering.semester || null,
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
        status: 'draft',
      });

      // Update CourseChecklist completion
      await updateAssessmentChecklist(offering, 'ASSESS_ASSIGN', true);

      return sendSuccess(res, { assignment }, 'Assignment created successfully', 201);
    }

    // Legacy creation without offeringId
    const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
    if (!authCheck.authorized) {
      return sendError(res, authCheck.message, authCheck.status);
    }

    const offeringRes = await courseOfferingService.resolveOfferingForLegacyContext(req.user, courseId);
    if (offeringRes.ambiguous) {
      return sendError(
        res,
        'Multiple course offerings exist for this course. Please provide offeringId to specify the target offering.',
        409
      );
    }

    const targetOffering = offeringRes.offering;
    const assignment = await Assignment.create({
      courseOffering: targetOffering ? targetOffering._id : null,
      course: courseId,
      faculty: facultyId,
      semester: targetOffering ? (targetOffering.semester?._id || targetOffering.semester) : null,
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
      status: 'draft',
    });

    if (targetOffering) {
      await updateAssessmentChecklist(targetOffering, 'ASSESS_ASSIGN', true);
    }

    return sendSuccess(res, { assignment }, 'Assignment created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/* ── PUT /api/assignments/:assignmentId ────────────────────────────── */
/**
 * Update an existing assignment with offering authorization check.
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
      tipsForSuccess,
      offeringId,
    } = req.body;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return sendError(res, 'Assignment not found', 404);
    }

    // Authorize against existing offering or ownership
    if (assignment.courseOffering) {
      try {
        await courseOfferingService.getOfferingById(assignment.courseOffering, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 403);
      }
    } else {
      if (req.user.designation === 'faculty' && assignment.faculty.toString() !== req.user._id.toString()) {
        return sendError(res, 'You are not authorized to update this assignment', 403);
      }

      // If client supplied offeringId to safely link legacy record, verify and associate
      if (offeringId) {
        if (!mongoose.Types.ObjectId.isValid(offeringId)) {
          return sendError(res, 'Invalid offering ID', 400);
        }
        let offering;
        try {
          offering = await courseOfferingService.getOfferingById(offeringId, req.user);
        } catch (err) {
          return sendError(res, err.message, err.statusCode || 403);
        }

        const offeringCourseId = (offering.course?._id || offering.course).toString();
        if (offeringCourseId !== assignment.course.toString()) {
          return sendError(res, 'Offering does not match the course of this assignment', 400);
        }

        assignment.courseOffering = offering._id;
        assignment.semester = offering.semester?._id || offering.semester || null;
        await updateAssessmentChecklist(offering, 'ASSESS_ASSIGN', true);
      }
    }

    if (assignmentInfo) assignment.assignmentInfo = assignmentInfo;
    if (courseInfo) assignment.courseInfo = courseInfo;
    if (cloMappings) assignment.cloMappings = cloMappings;
    if (assignmentTitle !== undefined) assignment.assignmentTitle = assignmentTitle;
    if (objective !== undefined) assignment.objective = objective;
    if (assignmentDescription !== undefined) assignment.assignmentDescription = assignmentDescription;
    if (tasks) assignment.tasks = cleanList(tasks);
    if (submissionGuidelines) assignment.submissionGuidelines = cleanList(submissionGuidelines);
    if (evaluationCriteria) assignment.evaluationCriteria = cleanList(evaluationCriteria);
    if (tipsForSuccess) assignment.tipsForSuccess = cleanList(tipsForSuccess);

    await assignment.save();

    return sendSuccess(res, { assignment }, 'Assignment updated successfully');
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/assignments/:assignmentId ──────────────────────────── */
/**
 * Delete an assignment and recalculate checklist completion for the offering.
 */
const deleteAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return sendError(res, 'Assignment not found', 404);
    }

    let offering = null;
    if (assignment.courseOffering) {
      try {
        offering = await courseOfferingService.getOfferingById(assignment.courseOffering, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 403);
      }
    } else {
      if (req.user.designation === 'faculty' && assignment.faculty.toString() !== req.user._id.toString()) {
        return sendError(res, 'You are not authorized to delete this assignment', 403);
      }
    }

    const offeringRef = assignment.courseOffering;

    // Safely delete associated Drive file and CourseFile record if offering is present
    if (offeringRef) {
      try {
        await courseFileService.deleteAssessmentFile({
          offeringId: offeringRef,
          documentType: 'ASSESS_ASSIGN',
          assessmentId: assignment._id,
          user: req.user,
        });
      } catch (driveErr) {
        return sendError(
          res,
          `Failed to delete associated Google Drive file: ${driveErr.message}. Assignment was not deleted. Please retry.`,
          driveErr.statusCode || 502
        );
      }
    }

    await assignment.deleteOne();

    // Recalculate checklist completion for the offering
    if (offeringRef) {
      const remainingCount = await Assignment.countDocuments({ courseOffering: offeringRef });
      await updateAssessmentChecklist(offering || { _id: offeringRef }, 'ASSESS_ASSIGN', remainingCount > 0);
    }

    return sendSuccess(res, null, 'Assignment deleted successfully');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/assignments/:assignmentId/export ─────────────────────── */
/**
 * Export assignment to DOCX with offering authorization check.
 */
const exportAssignmentWord = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId).lean();

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Verify authorization before generating or returning the document
    if (assignment.courseOffering) {
      try {
        await courseOfferingService.getOfferingById(assignment.courseOffering, req.user);
      } catch (err) {
        return res.status(err.statusCode || 403).json({ success: false, message: err.message });
      }
    } else {
      if (req.user.designation === 'faculty' && assignment.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to export this assignment' });
      }
    }

    const buffer = await assignmentWordService.generateAssignmentWord(assignment);

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
  getAssignmentsForOffering,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  exportAssignmentWord,
};

