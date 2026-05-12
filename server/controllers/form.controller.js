const CIS = require('../models/CIS.model');
const CCR = require('../models/CCR.model');
const { sendSuccess, sendError } = require('../utils/response');
const { generateCISWord } = require('../services/documentService/generateCISWord');
const { generateCISPDF } = require('../services/documentService/generateCISPDF');
const { generateCCRWord } = require('../services/documentService/generateCCRWord');
const { generateCCRPDF } = require('../services/documentService/generateCCRPDF');

/**
 * @route   GET /api/forms/ccr/:courseId
 * @access  Private (Faculty mostly, though auth ensures valid JWT)
 */
const getCCRForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const form = await CCR.findOne({
      course: courseId,
      faculty: facultyId,
      formType: 'CCR'
    });

    // Valid constraint: Should return form data if it exists, or null if not.
    return sendSuccess(res, { form: form || null }, 'CCR form fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/forms/ccr
 * @access  Private (Faculty mostly)
 */
const saveCCRForm = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const { courseId, courseInfo, weeklyData, alternateData } = req.body;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const form = await CCR.findOneAndUpdate(
      { course: courseId, faculty: facultyId, formType: 'CCR' },
      {
        course: courseId,
        faculty: facultyId,
        formType: 'CCR',
        courseInfo,
        weeklyData,
        alternateData,
        status: 'draft'
      },
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
 */
const exportCCRForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;
    const { format } = req.query; // e.g. ?format=docx

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const form = await CCR.findOne({
      course: courseId,
      faculty: facultyId,
      formType: 'CCR'
    }).lean();

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
 */
const getCISForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const form = await CIS.findOne({
      course: courseId,
      faculty: facultyId,
      formType: 'CIS'
    });

    return sendSuccess(res, { form: form || null }, 'CIS form fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/forms/cis
 * @access  Private
 */
const saveCISForm = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const {
      courseId,
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

    const form = await CIS.findOneAndUpdate(
      { course: courseId, faculty: facultyId, formType: 'CIS' },
      {
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
      },
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
 */
const exportCISForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;
    const { format } = req.query; // e.g. ?format=docx

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const form = await CIS.findOne({
      course: courseId,
      faculty: facultyId,
      formType: 'CIS'
    }).lean();

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

module.exports = {
  getCCRForm,
  saveCCRForm,
  exportCCRForm,
  getCISForm,
  saveCISForm,
  exportCISForm
};
