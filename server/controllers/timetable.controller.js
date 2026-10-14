/**
 * timetable.controller.js — HTTP request handlers for Timetable with Consulting Hours.
 *
 * Endpoints:
 *  - GET  /api/forms/timetable             – Fetch draft for authenticated faculty & active/specified semester
 *  - GET  /api/forms/timetable/:courseId   – Same draft lookup (keeps course-context routes compatible)
 *  - POST /api/forms/timetable             – Save/upsert draft for authenticated faculty
 *  - PUT  /api/forms/timetable             – Save/upsert draft for authenticated faculty
 *  - GET  /api/forms/timetable/export      – Export timetable as PDF or Word (query: format=pdf|docx)
 *  - GET  /api/forms/timetable/:courseId/export – Same export handler
 */
const timetableService = require('../services/timetable.service');
const { generateTimetablePDF } = require('../services/documentService/generateTimetablePDF');
const { generateTimetableWord } = require('../services/documentService/generateTimetableWord');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @route   GET /api/forms/timetable
 * @route   GET /api/forms/timetable/:courseId
 * @access  Private (Authenticated Faculty)
 */
const getTimetable = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const { semester: semesterId } = req.query;

    const timetable = await timetableService.getTimetableDraft({
      facultyId,
      semesterId
    });

    return sendSuccess(
      res,
      { timetable: timetable || null },
      'Timetable draft fetched successfully'
    );
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * @route   POST /api/forms/timetable
 * @route   PUT  /api/forms/timetable
 * @access  Private (Authenticated Faculty)
 */
const saveTimetable = async (req, res, next) => {
  try {
    // Ownership is strictly derived from authenticated token, never from body
    const facultyId = req.user._id;
    const { semesterId } = req.body;

    const timetable = await timetableService.saveTimetableDraft({
      facultyId,
      semesterId,
      timetableData: req.body
    });

    return sendSuccess(
      res,
      { timetable },
      'Timetable saved successfully'
    );
  } catch (err) {
    if (err.errors && err.errors.length > 0) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message,
        data: { errors: err.errors }
      });
    }
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * @route   GET /api/forms/timetable/export
 * @route   GET /api/forms/timetable/:courseId/export
 * @access  Private (Authenticated Faculty)
 *
 * Query params:
 *   format   — 'pdf' | 'docx'
 *   semester — Semester ObjectId (optional, defaults to active)
 */
const exportTimetable = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const { format, semester: semesterId } = req.query;

    if (!format || !['pdf', 'docx'].includes(format.toLowerCase())) {
      return sendError(res, "Invalid format requested. Supported formats are 'pdf' and 'docx'.", 400);
    }

    const timetable = await timetableService.getTimetableForExport({
      facultyId,
      semesterId
    });

    const filePrefix = `Timetable_${timetable.facultyInfo?.facultyName?.replace(/\s+/g, '_') || 'Faculty'}`;

    if (format.toLowerCase() === 'pdf') {
      const buffer = await generateTimetablePDF(timetable);
      res.setHeader('Content-Disposition', `attachment; filename=${filePrefix}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(buffer);
    }

    if (format.toLowerCase() === 'docx') {
      const buffer = await generateTimetableWord(timetable);
      res.setHeader('Content-Disposition', `attachment; filename=${filePrefix}.docx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      return res.send(buffer);
    }
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

module.exports = {
  getTimetable,
  saveTimetable,
  exportTimetable
};
