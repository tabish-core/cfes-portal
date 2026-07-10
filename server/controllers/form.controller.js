const CIS = require('../models/CIS.model');
const CCR = require('../models/CCR.model');
const CCC = require('../models/CCC.model');
const { sendSuccess, sendError } = require('../utils/response');
const { generateCISWord } = require('../services/documentService/generateCISWord');
const { generateCISPDF } = require('../services/documentService/generateCISPDF');
const { generateCCRWord } = require('../services/documentService/generateCCRWord');
const { generateCCRPDF } = require('../services/documentService/generateCCRPDF');
const { generateCCCPDF } = require('../services/documentService/generateCCCPDF');

/* ── Validation Helpers ─────────────────────────────────────────────────── */

/** Returns true if a string value is non-empty after trimming. */
const filled = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Validate CCR payload.
 * Returns an array of { field, message } objects. Empty array = valid.
 *
 * Required fields:
 *  - courseInfo.courseTitle
 *  - courseInfo.courseCode
 *  - courseInfo.facultyName
 */
const validateCCR = ({ courseInfo }) => {
  const errors = [];
  if (!courseInfo || typeof courseInfo !== 'object') {
    errors.push({ field: 'courseInfo', message: 'Course Information section is required.' });
    return errors;
  }
  if (!filled(courseInfo.facultyName))  errors.push({ field: 'courseInfo.facultyName', message: 'Faculty Name is required.' });
  if (!filled(courseInfo.courseTitle))   errors.push({ field: 'courseInfo.courseTitle', message: 'Course Title is required.' });
  if (!filled(courseInfo.courseCode))    errors.push({ field: 'courseInfo.courseCode', message: 'Course Code is required.' });
  return errors;
};

/**
 * Validate CIS payload.
 * Returns an array of { field, message } objects. Empty array = valid.
 *
 * Required fields:
 *  - courseSummary.courseCode
 *  - courseSummary.courseName
 *  - basicInfo.instructor
 *  - objectives  (non-empty string)
 */
const validateCIS = ({ courseSummary, basicInfo, objectives }) => {
  const errors = [];
  if (!courseSummary || typeof courseSummary !== 'object') {
    errors.push({ field: 'courseSummary', message: 'Course Summary section is required.' });
  } else {
    if (!filled(courseSummary.courseCode)) errors.push({ field: 'courseSummary.courseCode', message: 'Course Code is required.' });
    if (!filled(courseSummary.courseName)) errors.push({ field: 'courseSummary.courseName', message: 'Course Name is required.' });
  }
  if (!basicInfo || typeof basicInfo !== 'object') {
    errors.push({ field: 'basicInfo', message: 'Basic Information section is required.' });
  } else {
    if (!filled(basicInfo.instructor)) errors.push({ field: 'basicInfo.instructor', message: 'Instructor name is required.' });
  }
  if (!filled(objectives)) errors.push({ field: 'objectives', message: 'Course Objectives are required.' });
  return errors;
};

/**
 * @route   GET /api/forms/ccr/:courseId
 * @access  Private (Faculty mostly, though auth ensures valid JWT)
 *
 * Query params:
 *   semester — Semester ObjectId (optional for backward compat; recommended)
 */
const getCCRForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;
    const { semester: semesterId } = req.query;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const query = {
      course: courseId,
      faculty: facultyId,
      formType: 'CCR'
    };
    // Include semester in query if provided
    if (semesterId) query.semester = semesterId;

    const form = await CCR.findOne(query);

    // Valid constraint: Should return form data if it exists, or null if not.
    return sendSuccess(res, { form: form || null }, 'CCR form fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/forms/ccr
 * @access  Private (Faculty mostly)
 *
 * Body:
 *   courseId, semesterId (optional), courseInfo, weeklyData, alternateData
 */
const saveCCRForm = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const { courseId, semesterId, courseInfo, weeklyData, alternateData } = req.body;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    // Validate required fields
    const validationErrors = validateCCR({ courseInfo });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please fill in the required fields: ${validationErrors.map(e => e.message).join(' ')}`,
        data: { errors: validationErrors }
      });
    }

    const filter = { course: courseId, faculty: facultyId, formType: 'CCR' };
    if (semesterId) filter.semester = semesterId;

    const updateData = {
      course: courseId,
      faculty: facultyId,
      formType: 'CCR',
      courseInfo,
      weeklyData,
      alternateData,
      status: 'draft'
    };
    if (semesterId) updateData.semester = semesterId;

    const form = await CCR.findOneAndUpdate(
      filter,
      updateData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, { form }, 'CCR form saved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/forms/ccr/:courseId/export
 * @access  Private
 *
 * Query params:
 *   format   — 'docx' | 'pdf'
 *   semester — Semester ObjectId (optional)
 */
const exportCCRForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;
    const { format, semester: semesterId } = req.query;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const query = {
      course: courseId,
      faculty: facultyId,
      formType: 'CCR'
    };
    if (semesterId) query.semester = semesterId;

    const form = await CCR.findOne(query).lean();

    if (!form) {
      return sendError(res, 'CCR form not found. Please save it first.', 404);
    }

    if (format === 'docx' || format === 'pdf') {
      const exportData = {
        courseInfo: form.courseInfo,
        weeklyData: form.weeklyData,
        alternateData: form.alternateData
      };

      if (format === 'docx') {
        const buffer = await generateCCRWord(exportData);
        res.setHeader('Content-Disposition', `attachment; filename=CCR_${form.courseInfo?.courseCode || 'Course'}.docx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        return res.send(buffer);
      }

      if (format === 'pdf') {
        const buffer = await generateCCRPDF(exportData);
        res.setHeader('Content-Disposition', `attachment; filename=CCR_${form.courseInfo?.courseCode || 'Course'}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        return res.send(buffer);
      }
    }

    return sendError(res, 'Invalid format requested', 400);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/forms/cis/:courseId
 * @access  Private
 *
 * Query params:
 *   semester — Semester ObjectId (optional for backward compat; recommended)
 */
const getCISForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;
    const { semester: semesterId } = req.query;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const query = {
      course: courseId,
      faculty: facultyId,
      formType: 'CIS'
    };
    if (semesterId) query.semester = semesterId;

    const form = await CIS.findOne(query);

    return sendSuccess(res, { form: form || null }, 'CIS form fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/forms/cis
 * @access  Private
 *
 * Body:
 *   courseId, semesterId (optional), courseSummary, basicInfo, etc.
 */
const saveCISForm = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const {
      courseId,
      semesterId,
      courseSummary,
      basicInfo,
      objectives,
      contents,
      cloTable,
      textbooks,
      obaTable,
      weeklyPlan,
      gradingPolicy,
    } = req.body;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    // Validate required fields
    const validationErrors = validateCIS({ courseSummary, basicInfo, objectives });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please fill in the required fields: ${validationErrors.map(e => e.message).join(' ')}`,
        data: { errors: validationErrors }
      });
    }

    const filter = { course: courseId, faculty: facultyId, formType: 'CIS' };
    if (semesterId) filter.semester = semesterId;

    const updateData = {
      course: courseId,
      faculty: facultyId,
      formType: 'CIS',
      courseSummary,
      basicInfo,
      courseObjectives: objectives,
      courseContents: contents,
      cloTable,
      textbooks,
      obaTable,
      weeklyPlan,
      gradingPolicy,
      status: 'draft'
    };
    if (semesterId) updateData.semester = semesterId;

    const form = await CIS.findOneAndUpdate(
      filter,
      updateData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, { form }, 'CIS form saved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/forms/cis/:courseId/export
 * @access  Private
 *
 * Query params:
 *   format   — 'docx' | 'pdf'
 *   semester — Semester ObjectId (optional)
 */
const exportCISForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;
    const { format, semester: semesterId } = req.query;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const query = {
      course: courseId,
      faculty: facultyId,
      formType: 'CIS'
    };
    if (semesterId) query.semester = semesterId;

    const form = await CIS.findOne(query).lean();

    if (!form) {
      return sendError(res, 'CIS form not found. Please save it first.', 404);
    }

    if (format === 'docx' || format === 'pdf') {
      const exportData = {
        courseInfo: {
          ...form.courseSummary,
          ...form.basicInfo,
          courseObjectives: form.courseObjectives,
          courseContents: form.courseContents
        },
        alternateData: {
          cloTable: form.cloTable,
          textbooks: form.textbooks,
          obaTable: form.obaTable,
          gradingPolicy: form.gradingPolicy
        },
        weeklyData: form.weeklyPlan
      };

      if (format === 'docx') {
        const buffer = await generateCISWord(exportData);
        res.setHeader('Content-Disposition', `attachment; filename=CIS_${form.courseSummary?.courseCode || 'Course'}.docx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        return res.send(buffer);
      }

      if (format === 'pdf') {
        const buffer = await generateCISPDF(exportData);
        res.setHeader('Content-Disposition', `attachment; filename=CIS_${form.courseSummary?.courseCode || 'Course'}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        return res.send(buffer);
      }
    }

    return sendError(res, 'Invalid format requested', 400);
  } catch (err) {
    next(err);
  }
};

/* ══════════════════════════════════════════════════════════════════════════
 *  CCC  –  Course Completion Certificate
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Validate CCC payload.
 * Returns an array of { field, message } objects. Empty array = valid.
 */
const validateCCC = ({ certificateData }) => {
  const errors = [];
  if (!certificateData || typeof certificateData !== 'object') {
    errors.push({ field: 'certificateData', message: 'Certificate data section is required.' });
    return errors;
  }
  if (!filled(certificateData.sessionsHeld))          errors.push({ field: 'sessionsHeld', message: 'Sessions Held is required.' });
  if (!filled(certificateData.totalRequiredSessions))  errors.push({ field: 'totalRequiredSessions', message: 'Total Required Sessions is required.' });
  if (!filled(certificateData.date))                   errors.push({ field: 'date', message: 'Date is required.' });
  return errors;
};

/**
 * @route   GET /api/forms/ccc/:courseId
 * @access  Private
 *
 * Query params:
 *   semester — Semester ObjectId (optional)
 */
const getCCCForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;
    const { semester: semesterId } = req.query;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const query = {
      course: courseId,
      faculty: facultyId,
      formType: 'CCC'
    };
    if (semesterId) query.semester = semesterId;

    const form = await CCC.findOne(query);

    return sendSuccess(res, { form: form || null }, 'CCC form fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/forms/ccc
 * @access  Private
 *
 * Body:
 *   courseId, semesterId (optional), courseInfo, certificateData
 */
const saveCCCForm = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const { courseId, semesterId, courseInfo, certificateData } = req.body;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    // Validate required fields
    const validationErrors = validateCCC({ certificateData });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please fill in the required fields: ${validationErrors.map(e => e.message).join(' ')}`,
        data: { errors: validationErrors }
      });
    }

    const filter = { course: courseId, faculty: facultyId, formType: 'CCC' };
    if (semesterId) filter.semester = semesterId;

    const updateData = {
      course: courseId,
      faculty: facultyId,
      formType: 'CCC',
      courseInfo,
      certificateData,
      status: 'draft'
    };
    if (semesterId) updateData.semester = semesterId;

    const form = await CCC.findOneAndUpdate(
      filter,
      updateData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, { form }, 'CCC form saved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/forms/ccc/:courseId/export
 * @access  Private
 *
 * Query params:
 *   format   — 'pdf'
 *   semester — Semester ObjectId (optional)
 */
const exportCCCForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;
    const { format, semester: semesterId } = req.query;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const query = {
      course: courseId,
      faculty: facultyId,
      formType: 'CCC'
    };
    if (semesterId) query.semester = semesterId;

    const form = await CCC.findOne(query).lean();

    if (!form) {
      return sendError(res, 'CCC form not found. Please save it first.', 404);
    }

    if (format === 'pdf') {
      const exportData = {
        courseInfo: form.courseInfo,
        certificateData: form.certificateData
      };

      const buffer = await generateCCCPDF(exportData);
      res.setHeader('Content-Disposition', `attachment; filename=CCC_${form.courseInfo?.courseCode || 'Course'}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(buffer);
    }

    return sendError(res, 'Invalid format requested. Only PDF is supported for CCC.', 400);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCCRForm,
  saveCCRForm,
  exportCCRForm,
  getCISForm,
  saveCISForm,
  exportCISForm,
  getCCCForm,
  saveCCCForm,
  exportCCCForm
};
