/**
 * timetable.service.js — Business logic for faculty timetable drafts and operations.
 *
 * Enforces:
 *  - Faculty-specific per academic semester ownership.
 *  - Derivation of faculty identity from req.user._id (never from client-supplied IDs).
 *  - Strict validation of time slots, activities, spans, and separate consulting hours.
 *  - Upsert semantics to avoid duplicate timetable documents.
 */
const mongoose = require('mongoose');
const { Timetable } = require('../models/Timetable.model');
const Semester = require('../models/Semester.model');
const { validateTimetable } = require('./timetable.validator');

const fail = (message, statusCode = 400, errors = null) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (errors) err.errors = errors;
  throw err;
};

/**
 * Resolve target semester ID.
 * If semesterId is provided, validates and verifies it exists.
 * Otherwise, falls back to the currently active semester.
 *
 * @param {string|mongoose.Types.ObjectId} [semesterId]
 * @returns {Promise<mongoose.Types.ObjectId>}
 */
const resolveSemesterId = async (semesterId) => {
  if (semesterId) {
    if (!mongoose.Types.ObjectId.isValid(semesterId)) {
      fail('Invalid semester ID provided', 400);
    }
    const exists = await Semester.findById(semesterId);
    if (!exists) {
      fail('Specified semester was not found', 404);
    }
    return exists._id;
  }

  // Fallback to active semester
  const activeSemester = await Semester.findOne({ status: 'active' });
  if (!activeSemester) {
    fail('No active semester found. Please specify an academic semester.', 400);
  }
  return activeSemester._id;
};

/**
 * Fetch a faculty timetable draft for the given semester.
 *
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.facultyId
 * @param {string|mongoose.Types.ObjectId} [params.semesterId]
 * @returns {Promise<object|null>}
 */
const getTimetableDraft = async ({ facultyId, semesterId }) => {
  if (!facultyId) fail('Faculty ID is required', 400);

  const resolvedSemesterId = await resolveSemesterId(semesterId);

  const timetable = await Timetable.findOne({
    faculty: facultyId,
    semester: resolvedSemesterId
  })
    .populate('semester', 'name status')
    .lean();

  return timetable;
};

/**
 * Save (create or update) a faculty timetable draft.
 *
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.facultyId
 * @param {string|mongoose.Types.ObjectId} [params.semesterId]
 * @param {object} params.timetableData
 * @returns {Promise<object>}
 */
const saveTimetableDraft = async ({ facultyId, semesterId, timetableData = {} }) => {
  if (!facultyId) fail('Faculty ID is required', 400);

  const resolvedSemesterId = await resolveSemesterId(semesterId || timetableData.semesterId);

  // Validate timetable structure, slot order, non-overlaps, and consulting hours
  const validation = validateTimetable(timetableData);
  if (!validation.isValid) {
    fail(
      `Timetable validation failed: ${validation.errors.map((e) => e.message).join(' ')}`,
      400,
      validation.errors
    );
  }

  const filter = {
    faculty: facultyId,
    semester: resolvedSemesterId
  };

  const update = {
    faculty: facultyId,
    semester: resolvedSemesterId,
    facultyInfo: timetableData.facultyInfo || {},
    timeSlots: timetableData.timeSlots || [],
    days: timetableData.days || [],
    activities: timetableData.activities || [],
    consultingHours: timetableData.consultingHours || [],
    status: timetableData.status || 'draft'
  };

  const savedTimetable = await Timetable.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    runValidators: true
  }).populate('semester', 'name status');

  return savedTimetable;
};

/**
 * Retrieve timetable for document export.
 *
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.facultyId
 * @param {string|mongoose.Types.ObjectId} [params.semesterId]
 * @returns {Promise<object>}
 */
const getTimetableForExport = async ({ facultyId, semesterId }) => {
  if (!facultyId) fail('Faculty ID is required', 400);

  const resolvedSemesterId = await resolveSemesterId(semesterId);

  const timetable = await Timetable.findOne({
    faculty: facultyId,
    semester: resolvedSemesterId
  })
    .populate('semester', 'name status')
    .lean();

  if (!timetable) {
    fail('Timetable not found for the specified faculty and semester. Please save a draft first.', 404);
  }

  return timetable;
};

module.exports = {
  resolveSemesterId,
  getTimetableDraft,
  saveTimetableDraft,
  getTimetableForExport
};
