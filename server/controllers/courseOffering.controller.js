/**
 * courseOffering.controller.js — HTTP handlers for course offering endpoints.
 */
const offeringService            = require('../services/courseOffering.service');
const { sendSuccess, sendError } = require('../utils/response');

/* ── POST /api/offerings ───────────────────────────────────────────────── */
/**
 * Admin creates a course offering (faculty → course → semester → section).
 *
 * Body: { facultyId, courseId, semesterId, section? }
 */
const createOffering = async (req, res, next) => {
  try {
    const { facultyId, courseId, semesterId, section } = req.body;

    if (!facultyId || !courseId || !semesterId) {
      return sendError(res, 'facultyId, courseId, and semesterId are all required', 400);
    }

    const offering = await offeringService.createOffering(
      facultyId,
      courseId,
      semesterId,
      section,
      req.user
    );

    return sendSuccess(res, { offering }, 'Course offering created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/offerings/:id ─────────────────────────────────────────── */
/**
 * Admin removes a course offering.
 */
const removeOffering = async (req, res, next) => {
  try {
    const offering = await offeringService.removeOffering(req.params.id, req.user);
    return sendSuccess(res, { offering }, 'Course offering removed');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/offerings?semester=<id> ──────────────────────────────────── */
/**
 * Admin lists all offerings for a given semester.
 */
const listBySemester = async (req, res, next) => {
  try {
    const { semester } = req.query;

    if (!semester) {
      return sendError(res, 'semester query parameter is required', 400);
    }

    const offerings = await offeringService.listOfferingsBySemester(semester, req.departmentFilter || {});
    return sendSuccess(res, { offerings }, 'Offerings fetched');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/offerings/my-courses?semester=<id> ───────────────────────── */
/**
 * Faculty views their course offerings for a selected semester.
 * Semester is chosen by the faculty (not auto-filtered to active-only).
 */
const getMyOfferings = async (req, res, next) => {
  try {
    const { semester } = req.query;

    if (!semester) {
      return sendError(res, 'semester query parameter is required', 400);
    }

    const offerings = await offeringService.getMyOfferings(req.user._id, semester);
    return sendSuccess(res, { offerings }, 'Your course offerings fetched');
  } catch (err) {
    next(err);
  }
};

module.exports = { createOffering, removeOffering, listBySemester, getMyOfferings };
