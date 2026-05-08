const CCR = require('../models/CCR.model');
const CIS = require('../models/CIS.model');
const { sendSuccess, sendError } = require('../utils/response');

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

module.exports = {
  getCCRForm,
  saveCCRForm,
  getCISForm,
  saveCISForm
};
