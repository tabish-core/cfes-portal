/**
 * semester.controller.js — HTTP handlers for semester-related endpoints.
 */
const semesterService          = require('../services/semester.service');
const { sendSuccess, sendError } = require('../utils/response');

/* ── POST /api/semesters ───────────────────────────────────────────────── */
const createSemester = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return sendError(res, 'Semester name is required in the request body', 400);
    }

    const semester = await semesterService.createSemester(name.trim());
    return sendSuccess(res, { semester }, 'Semester created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/semesters ────────────────────────────────────────────────── */
const listSemesters = async (_req, res, next) => {
  try {
    const semesters = await semesterService.listSemesters();
    return sendSuccess(res, { semesters }, 'Semesters fetched');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/semesters/active ─────────────────────────────────────────── */
const getActiveSemester = async (_req, res, next) => {
  try {
    const semester = await semesterService.getActiveSemester();
    return sendSuccess(res, { semester: semester || null }, 'Active semester fetched');
  } catch (err) {
    next(err);
  }
};

/* ── PATCH /api/semesters/:id/toggle ───────────────────────────────────── */
const toggleStatus = async (req, res, next) => {
  try {
    const semester = await semesterService.toggleSemesterStatus(req.params.id);
    return sendSuccess(res, { semester }, `Semester ${semester.status === 'active' ? 'activated' : 'deactivated'}`);
  } catch (err) {
    next(err);
  }
};

module.exports = { createSemester, listSemesters, getActiveSemester, toggleStatus };
