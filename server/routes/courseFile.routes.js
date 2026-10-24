/**
 * courseFile.routes.js — Routes for Course File management and Google Drive integration.
 *
 * Stage 1 Endpoints:
 *  - GET /api/course-files/google/auth       — Initiate OAuth flow (Protected)
 *  - GET /api/course-files/google/callback   — Google redirect callback (State-protected)
 *  - GET /api/course-files/google/status     — Get Drive connection status (Protected)
 *  - GET /api/course-files/google/verify     — Verify destination folder access (Protected)
 */
const express = require('express');
const router = express.Router();
const courseFileController = require('../controllers/courseFile.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

/**
 * Flexible authentication middleware:
 * Accepts Bearer token via Authorization header OR ?token=<jwt> query parameter.
 * Enables direct browser clicks from the portal dashboard or callback confirmation page.
 */
const flexibleAuth = (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return verifyToken(req, res, next);
};

/* ── Google Drive OAuth & Verification Endpoints ───────────── */

// 1. Initiate Google authorization
router.get('/google/auth', flexibleAuth, courseFileController.initiateGoogleAuth);

// 2. Google OAuth callback (public redirect URL configured in Google Cloud Console)
router.get('/google/callback', courseFileController.handleGoogleCallback);

// 3. Inspect connection status
router.get('/google/status', flexibleAuth, courseFileController.getGoogleAuthStatus);

// 4. Test & verify destination folder access
router.get('/google/verify', flexibleAuth, courseFileController.verifyGoogleDriveAccess);

module.exports = router;
