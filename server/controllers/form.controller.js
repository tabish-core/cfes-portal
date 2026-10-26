const CIS = require('../models/CIS.model');
const CCR = require('../models/CCR.model');
const CCC = require('../models/CCC.model');
const CourseReviewReport = require('../models/CRR.model');
const CourseOffering = require('../models/CourseOffering.model');
const { sendSuccess, sendError } = require('../utils/response');
const courseOfferingService = require('../services/courseOffering.service');
const getOfferingById = (id, user) => courseOfferingService.getOfferingById(id, user);
const { generateCISWord } = require('../services/documentService/generateCISWord');
const { generateCISPDF } = require('../services/documentService/generateCISPDF');
const { generateCCRWord } = require('../services/documentService/generateCCRWord');
const { generateCCRPDF } = require('../services/documentService/generateCCRPDF');
const { generateCCCPDF } = require('../services/documentService/generateCCCPDF');
const { generateCRRPDF } = require('../services/documentService/generateCRRPDF');
const courseFileService = require('../services/courseFile.service');

/* ── Offering & Form Scoping Helpers ────────────────────────────────────── */

/**
 * Finds form by offering or legacy query with auto-linking of legacy records.
 */
const findFormByOfferingOrQuery = async (Model, offering, legacyQuery, formType) => {
  if (offering) {
    // 1. Explicitly linked to this offering
    const offeringQuery = { courseOffering: offering._id };
    if (formType) offeringQuery.formType = formType;
    let form = await Model.findOne(offeringQuery);

    // 2. Unlinked legacy document with EXACT same semester and section
    if (!form) {
      const exactUnlinkedQuery = {
        courseOffering: null,
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: offering.semester._id || offering.semester,
        section: offering.section || 'A'
      };
      if (formType) exactUnlinkedQuery.formType = formType;
      form = await Model.findOne(exactUnlinkedQuery);
    }

    // 3. Unlinked legacy document with semester: null ONLY if EXACTLY 1 offering exists for this course + faculty
    if (!form) {
      const offeringCount = await CourseOffering.countDocuments({
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty
      });
      if (offeringCount === 1) {
        const singleLegacyQuery = {
          courseOffering: null,
          course: offering.course._id || offering.course,
          faculty: offering.faculty._id || offering.faculty,
          semester: null
        };
        if (formType) singleLegacyQuery.formType = formType;
        form = await Model.findOne(singleLegacyQuery);
      }
    }

    // Safely link unlinked legacy record
    if (form && !form.courseOffering) {
      form.courseOffering = offering._id;
      if (!form.section) form.section = offering.section || 'A';
      if (!form.semester) form.semester = offering.semester._id || offering.semester;
      await form.save();
    }

    return form;
  }

  const safeLegacyQuery = { ...legacyQuery, courseOffering: null };
  const count = await Model.countDocuments(safeLegacyQuery);
  if (count > 1) {
    return null;
  }
  return Model.findOne(safeLegacyQuery);
};

/**
 * Resolves an offering for legacy requests or handles ambiguity safely.
 */
const resolveOfferingOrRejectAmbiguity = async (user, courseId, semesterId, res, forSave = false, Model = null, formType = null) => {
  const offeringRes = await courseOfferingService.resolveOfferingForLegacyContext(user, courseId, semesterId);
  if (offeringRes.ambiguous) {
    if (forSave) {
      sendError(res, 'Multiple course offerings exist for this course. Please provide offeringId to specify the target offering and section.', 409);
      return { resolved: false, handled: true };
    }
    return { resolved: true, offering: null, ambiguous: true };
  }
  if (offeringRes.offering) {
    return { resolved: true, offering: offeringRes.offering, ambiguous: false };
  }
  if (forSave && Model) {
    const query = { course: courseId, faculty: user._id, courseOffering: null };
    if (semesterId) query.semester = semesterId;
    if (formType) query.formType = formType;
    const docCount = await Model.countDocuments(query);
    if (docCount > 1) {
      sendError(res, 'Multiple documents exist for this course across different sections. Please provide offeringId to specify the target offering and section.', 409);
      return { resolved: false, handled: true };
    }
  }
  return { resolved: true, offering: null, ambiguous: false };
};



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
 *   offeringId — CourseOffering ObjectId (recommended)
 *   semester   — Semester ObjectId (optional for backward compat; recommended)
 */
const getCCRForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { semester: semesterId, offeringId } = req.query;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, false);
      if (resolution.ambiguous) {
        return sendSuccess(res, { form: null }, 'Multiple offerings exist for this course. Please specify offeringId.');
      }
      if (resolution.offering) {
        offering = resolution.offering;
      }
    }

    const legacyQuery = {
      course: courseId,
      faculty: req.user._id,
      formType: 'CCR'
    };
    if (semesterId) legacyQuery.semester = semesterId;

    const form = await findFormByOfferingOrQuery(CCR, offering, legacyQuery, 'CCR');

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
 *   offeringId (optional), courseId, semesterId (optional), courseInfo, weeklyData, alternateData
 */
const saveCCRForm = async (req, res, next) => {
  try {
    const { courseId, semesterId, courseInfo, weeklyData, alternateData, offeringId } = req.body;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, true, CCR, 'CCR');
      if (!resolution.resolved) return;
      if (resolution.offering) {
        offering = resolution.offering;
      }
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

    let filter;
    let updateData;

    if (offering) {
      filter = {
        $or: [
          { courseOffering: offering._id },
          {
            course: offering.course._id,
            faculty: offering.faculty._id,
            semester: offering.semester._id,
            section: offering.section || 'A',
            formType: 'CCR'
          }
        ]
      };
      updateData = {
        courseOffering: offering._id,
        course: offering.course._id,
        faculty: offering.faculty._id,
        semester: offering.semester._id,
        section: offering.section || 'A',
        formType: 'CCR',
        courseInfo,
        weeklyData,
        alternateData,
        status: 'draft'
      };
    } else {
      const facultyId = req.user._id;
      filter = { course: courseId, faculty: facultyId, courseOffering: null, formType: 'CCR' };
      if (semesterId) filter.semester = semesterId;
      updateData = {
        courseOffering: null,
        course: courseId,
        faculty: facultyId,
        formType: 'CCR',
        courseInfo,
        weeklyData,
        alternateData,
        status: 'draft'
      };
      if (semesterId) updateData.semester = semesterId;
    }

    const form = await CCR.findOneAndUpdate(
      filter,
      { $set: updateData },
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
 *   format     — 'docx' | 'pdf'
 *   offeringId — CourseOffering ObjectId (optional)
 *   semester   — Semester ObjectId (optional)
 */
const exportCCRForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { format, semester: semesterId, offeringId } = req.query;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, false);
      if (resolution.ambiguous) {
        return sendError(
          res,
          'Multiple course offerings exist for this course. Please provide offeringId to specify which offering to export.',
          409
        );
      }
      if (resolution.offering) {
        offering = resolution.offering;
      }
    }

    const legacyQuery = {
      course: courseId,
      faculty: req.user._id,
      formType: 'CCR'
    };
    if (semesterId) legacyQuery.semester = semesterId;

    const form = await findFormByOfferingOrQuery(CCR, offering, legacyQuery, 'CCR');


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
 *   offeringId — CourseOffering ObjectId (recommended)
 *   semester   — Semester ObjectId (optional for backward compat; recommended)
 */
const getCISForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { semester: semesterId, offeringId } = req.query;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, false);
      if (resolution.ambiguous) {
        return sendSuccess(res, { form: null }, 'Multiple offerings exist for this course. Please specify offeringId.');
      }
      if (resolution.offering) {
        offering = resolution.offering;
      }
    }

    const legacyQuery = {
      course: courseId,
      faculty: req.user._id,
      formType: 'CIS'
    };
    if (semesterId) legacyQuery.semester = semesterId;

    const form = await findFormByOfferingOrQuery(CIS, offering, legacyQuery, 'CIS');

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
 *   offeringId (optional), courseId, semesterId (optional), courseSummary, basicInfo, etc.
 */
const saveCISForm = async (req, res, next) => {
  try {
    const {
      courseId,
      semesterId,
      offeringId,
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

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, true, CIS, 'CIS');
      if (!resolution.resolved) return;
      if (resolution.offering) {
        offering = resolution.offering;
      }
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

    let filter;
    let updateData;

    if (offering) {
      filter = {
        $or: [
          { courseOffering: offering._id },
          {
            course: offering.course._id,
            faculty: offering.faculty._id,
            semester: offering.semester._id,
            section: offering.section || 'A',
            formType: 'CIS'
          }
        ]
      };
      updateData = {
        courseOffering: offering._id,
        course: offering.course._id,
        faculty: offering.faculty._id,
        semester: offering.semester._id,
        section: offering.section || 'A',
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
    } else {
      const facultyId = req.user._id;
      filter = { course: courseId, faculty: facultyId, courseOffering: null, formType: 'CIS' };
      if (semesterId) filter.semester = semesterId;
      updateData = {
        courseOffering: null,
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
    }

    const form = await CIS.findOneAndUpdate(
      filter,
      { $set: updateData },
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
 *   format     — 'docx' | 'pdf'
 *   offeringId — CourseOffering ObjectId (optional)
 *   semester   — Semester ObjectId (optional)
 */
const exportCISForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { format, semester: semesterId, offeringId } = req.query;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, false);
      if (resolution.ambiguous) {
        return sendError(
          res,
          'Multiple course offerings exist for this course. Please provide offeringId to specify which offering to export.',
          409
        );
      }
      if (resolution.offering) {
        offering = resolution.offering;
      }
    }

    const legacyQuery = {
      course: courseId,
      faculty: req.user._id,
      formType: 'CIS'
    };
    if (semesterId) legacyQuery.semester = semesterId;

    const form = await findFormByOfferingOrQuery(CIS, offering, legacyQuery, 'CIS');


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
        if (offering && req.query.syncToDrive === 'true') {
          try {
            await courseFileService.syncOfferingDocument({
              offeringId: offering._id,
              documentType: 'CIS',
              fileFormat: 'docx',
              buffer,
              user: req.user,
            });
          } catch (syncErr) {
            console.error('Failed to sync exported CIS (DOCX) to Google Drive:', syncErr.message);
          }
        }
        res.setHeader('Content-Disposition', `attachment; filename=CIS_${form.courseSummary?.courseCode || 'Course'}.docx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        return res.send(buffer);
      }

      if (format === 'pdf') {
        const buffer = await generateCISPDF(exportData);
        if (offering && req.query.syncToDrive === 'true') {
          try {
            await courseFileService.syncOfferingDocument({
              offeringId: offering._id,
              documentType: 'CIS',
              fileFormat: 'pdf',
              buffer,
              user: req.user,
            });
          } catch (syncErr) {
            console.error('Failed to sync exported CIS (PDF) to Google Drive:', syncErr.message);
          }
        }
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
 *   offeringId — CourseOffering ObjectId (recommended)
 *   semester   — Semester ObjectId (optional)
 */
const getCCCForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { semester: semesterId, offeringId } = req.query;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, false);
      if (resolution.ambiguous) {
        return sendSuccess(res, { form: null }, 'Multiple offerings exist for this course. Please specify offeringId.');
      }
      if (resolution.offering) {
        offering = resolution.offering;
      }
    }

    const legacyQuery = {
      course: courseId,
      faculty: req.user._id,
      formType: 'CCC'
    };
    if (semesterId) legacyQuery.semester = semesterId;

    const form = await findFormByOfferingOrQuery(CCC, offering, legacyQuery, 'CCC');

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
 *   offeringId (optional), courseId, semesterId (optional), courseInfo, certificateData
 */
const saveCCCForm = async (req, res, next) => {
  try {
    const { courseId, semesterId, courseInfo, certificateData, offeringId } = req.body;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, true, CCC, 'CCC');
      if (!resolution.resolved) return;
      if (resolution.offering) {
        offering = resolution.offering;
      }
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

    let filter;
    let updateData;

    if (offering) {
      filter = {
        $or: [
          { courseOffering: offering._id },
          {
            course: offering.course._id,
            faculty: offering.faculty._id,
            semester: offering.semester._id,
            section: offering.section || 'A',
            formType: 'CCC'
          }
        ]
      };
      updateData = {
        courseOffering: offering._id,
        course: offering.course._id,
        faculty: offering.faculty._id,
        semester: offering.semester._id,
        section: offering.section || 'A',
        formType: 'CCC',
        courseInfo,
        certificateData,
        status: 'draft'
      };
    } else {
      const facultyId = req.user._id;
      filter = { course: courseId, faculty: facultyId, courseOffering: null, formType: 'CCC' };
      if (semesterId) filter.semester = semesterId;
      updateData = {
        courseOffering: null,
        course: courseId,
        faculty: facultyId,
        formType: 'CCC',
        courseInfo,
        certificateData,
        status: 'draft'
      };
      if (semesterId) updateData.semester = semesterId;
    }

    const form = await CCC.findOneAndUpdate(
      filter,
      { $set: updateData },
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
 *   format     — 'pdf'
 *   offeringId — CourseOffering ObjectId (optional)
 *   semester   — Semester ObjectId (optional)
 */
const exportCCCForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { format, semester: semesterId, offeringId } = req.query;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, false);
      if (resolution.ambiguous) {
        return sendError(
          res,
          'Multiple course offerings exist for this course. Please provide offeringId to specify which offering to export.',
          409
        );
      }
      if (resolution.offering) {
        offering = resolution.offering;
      }
    }

    const legacyQuery = {
      course: courseId,
      faculty: req.user._id,
      formType: 'CCC'
    };
    if (semesterId) legacyQuery.semester = semesterId;

    const form = await findFormByOfferingOrQuery(CCC, offering, legacyQuery, 'CCC');



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

/* ══════════════════════════════════════════════════════════════════════════
 *  CRR  –  Course Review Report (Theory Courses)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Validate CRR payload.
 * Returns an array of { field, message } objects. Empty array = valid.
 */
const validateCRR = ({ courseInfo }) => {
  const errors = [];
  if (!courseInfo || typeof courseInfo !== 'object') {
    errors.push({ field: 'courseInfo', message: 'Course Details section is required.' });
    return errors;
  }
  if (!filled(courseInfo.teacherName))  errors.push({ field: 'courseInfo.teacherName', message: 'Teacher Name is required.' });
  if (!filled(courseInfo.courseTitle))   errors.push({ field: 'courseInfo.courseTitle', message: 'Course Title is required.' });
  if (!filled(courseInfo.courseCode))    errors.push({ field: 'courseInfo.courseCode', message: 'Course Code is required.' });
  return errors;
};

/**
 * @route   GET /api/forms/course-review/:courseId
 * @access  Private
 *
 * Query params:
 *   offeringId — CourseOffering ObjectId (recommended)
 *   semester   — Semester ObjectId (optional)
 */
const getCourseReviewForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { semester: semesterId, offeringId } = req.query;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, false);
      if (resolution.ambiguous) {
        return sendSuccess(res, { form: null }, 'Multiple offerings exist for this course. Please specify offeringId.');
      }
      if (resolution.offering) {
        offering = resolution.offering;
      }
    }

    const legacyQuery = {
      course: courseId,
      faculty: req.user._id,
      formType: 'CRR'
    };
    if (semesterId) legacyQuery.semester = semesterId;

    const form = await findFormByOfferingOrQuery(CourseReviewReport, offering, legacyQuery, 'CRR');

    return sendSuccess(res, { form: form || null }, 'Course Review Report fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/forms/course-review
 * @access  Private
 *
 * Body:
 *   offeringId (optional), courseId, semesterId (optional), courseInfo, assessmentSummary,
 *   gradeSummary, courseLearningOutcomes, courseEnhancement, signatureInfo
 */
const saveCourseReviewForm = async (req, res, next) => {
  try {
    const {
      courseId,
      semesterId,
      offeringId,
      courseInfo,
      assessmentSummary,
      gradeSummary,
      courseLearningOutcomes,
      courseEnhancement,
      signatureInfo
    } = req.body;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, true, CourseReviewReport, 'CRR');
      if (!resolution.resolved) return;
      if (resolution.offering) {
        offering = resolution.offering;
      }
    }

    // Validate required fields
    const validationErrors = validateCRR({ courseInfo });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please fill in the required fields: ${validationErrors.map(e => e.message).join(' ')}`,
        data: { errors: validationErrors }
      });
    }

    let filter;
    let updateData;

    if (offering) {
      filter = {
        $or: [
          { courseOffering: offering._id },
          {
            course: offering.course._id,
            faculty: offering.faculty._id,
            semester: offering.semester._id,
            section: offering.section || 'A',
            formType: 'CRR'
          }
        ]
      };
      updateData = {
        courseOffering: offering._id,
        course: offering.course._id,
        faculty: offering.faculty._id,
        semester: offering.semester._id,
        section: offering.section || 'A',
        formType: 'CRR',
        courseInfo,
        assessmentSummary,
        gradeSummary,
        courseLearningOutcomes,
        courseEnhancement,
        signatureInfo,
        status: 'draft'
      };
    } else {
      const facultyId = req.user._id;
      filter = { course: courseId, faculty: facultyId, courseOffering: null, formType: 'CRR' };
      if (semesterId) filter.semester = semesterId;
      updateData = {
        courseOffering: null,
        course: courseId,
        faculty: facultyId,
        formType: 'CRR',
        courseInfo,
        assessmentSummary,
        gradeSummary,
        courseLearningOutcomes,
        courseEnhancement,
        signatureInfo,
        status: 'draft'
      };
      if (semesterId) updateData.semester = semesterId;
    }

    const form = await CourseReviewReport.findOneAndUpdate(
      filter,
      { $set: updateData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, { form }, 'Course Review Report saved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/forms/course-review/:courseId/export
 * @access  Private
 *
 * Query params:
 *   format     — 'pdf'
 *   offeringId — CourseOffering ObjectId (optional)
 *   semester   — Semester ObjectId (optional)
 */
const exportCourseReviewForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { format, semester: semesterId, offeringId } = req.query;

    let offering = null;
    if (offeringId) {
      try {
        offering = await getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }
      const resolution = await resolveOfferingOrRejectAmbiguity(req.user, courseId, semesterId, res, false);
      if (resolution.ambiguous) {
        return sendError(
          res,
          'Multiple course offerings exist for this course. Please provide offeringId to specify which offering to export.',
          409
        );
      }
      if (resolution.offering) {
        offering = resolution.offering;
      }
    }

    const legacyQuery = {
      course: courseId,
      faculty: req.user._id,
      formType: 'CRR'
    };
    if (semesterId) legacyQuery.semester = semesterId;

    const form = await findFormByOfferingOrQuery(CourseReviewReport, offering, legacyQuery, 'CRR');



    if (!form) {
      return sendError(res, 'Course Review Report not found. Please save it first.', 404);
    }

    if (format === 'pdf') {
      const exportData = {
        courseInfo: form.courseInfo,
        assessmentSummary: form.assessmentSummary,
        gradeSummary: form.gradeSummary,
        courseLearningOutcomes: form.courseLearningOutcomes,
        courseEnhancement: form.courseEnhancement,
        signatureInfo: form.signatureInfo,
      };

      const buffer = await generateCRRPDF(exportData);
      res.setHeader('Content-Disposition', `attachment; filename=CRR_${form.courseInfo?.courseCode || 'Course'}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(buffer);
    }

    return sendError(res, 'Invalid format requested. Only PDF is supported for Course Review Report.', 400);
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
  exportCCCForm,
  getCourseReviewForm,
  saveCourseReviewForm,
  exportCourseReviewForm
};
