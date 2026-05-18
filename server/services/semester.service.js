/**
 * semester.service.js — Business logic for semester operations.
 */
const mongoose = require('mongoose');
const Semester = require('../models/Semester.model');

/* ── helpers ───────────────────────────────────────────────────────────── */
const fail = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
};

/* ── Service functions ─────────────────────────────────────────────────── */

/**
 * Create a new semester. Defaults to inactive.
 * @param {string} name — e.g. "Fall 2025"
 */
const createSemester = async (name) => {
  if (!name || typeof name !== 'string' || !name.trim()) {
    fail('Semester name is required');
  }

  const existing = await Semester.findOne({ name: name.trim() });
  if (existing) fail('A semester with this name already exists', 409);

  return Semester.create({ name: name.trim() });
};

/**
 * Return all semesters sorted by creation date (newest first).
 */
const listSemesters = async () => {
  return Semester.find().sort({ createdAt: -1 }).select('-__v');
};

/**
 * Return the currently active semester (if any).
 */
const getActiveSemester = async () => {
  return Semester.findOne({ status: 'active' }).select('-__v');
};

/**
 * Toggle a semester's status. When activating a semester, all other
 * semesters are automatically deactivated (only one active at a time).
 *
 * @param {string} id — Semester ObjectId
 */
const toggleSemesterStatus = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) fail('Invalid semester ID', 400);

  const semester = await Semester.findById(id);
  if (!semester) fail('Semester not found', 404);

  if (semester.status === 'active') {
    // Deactivate
    semester.status = 'inactive';
  } else {
    // Activate this one; deactivate all others
    await Semester.updateMany({ _id: { $ne: id } }, { status: 'inactive' });
    semester.status = 'active';
  }

  await semester.save();
  return semester;
};

module.exports = { createSemester, listSemesters, getActiveSemester, toggleSemesterStatus };
