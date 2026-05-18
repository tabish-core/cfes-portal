const CourseChecklist = require('../models/CourseChecklist.model');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @route   GET /api/checklist/:courseId
 * @access  Private (Faculty)
 *
 * Query params:
 *   semester — Semester ObjectId (optional for backward compat; recommended)
 */
const getChecklist = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;
    const { semester: semesterId } = req.query;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const query = {
      course: courseId,
      faculty: facultyId
    };
    if (semesterId) query.semester = semesterId;

    const checklist = await CourseChecklist.findOne(query);

    return sendSuccess(res, { checklist: checklist || null }, 'Checklist fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/checklist
 * @access  Private (Faculty)
 *
 * Body:
 *   courseId, semesterId (optional), courseTitle, courseCode, batch, checklistItems
 */
const saveChecklist = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const { courseId, semesterId, courseTitle, courseCode, batch, checklistItems } = req.body;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const filter = { course: courseId, faculty: facultyId };
    if (semesterId) filter.semester = semesterId;

    const updateData = {
      course: courseId,
      faculty: facultyId,
      courseTitle,
      courseCode,
      batch,
      checklistItems
    };
    if (semesterId) updateData.semester = semesterId;

    const checklist = await CourseChecklist.findOneAndUpdate(
      filter,
      updateData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, { checklist }, 'Checklist saved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getChecklist,
  saveChecklist
};
