const CourseChecklist = require('../models/CourseChecklist.model');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @route   GET /api/checklist/:courseId
 * @access  Private (Faculty)
 */
const getChecklist = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const checklist = await CourseChecklist.findOne({
      course: courseId,
      faculty: facultyId
    });

    return sendSuccess(res, { checklist: checklist || null }, 'Checklist fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/checklist
 * @access  Private (Faculty)
 */
const saveChecklist = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const { courseId, courseTitle, courseCode, batch, checklistItems } = req.body;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const checklist = await CourseChecklist.findOneAndUpdate(
      { course: courseId, faculty: facultyId },
      {
        course: courseId,
        faculty: facultyId,
        courseTitle,
        courseCode,
        batch,
        checklistItems
      },
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
