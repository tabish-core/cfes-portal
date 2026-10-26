/**
 * courseFile.routes.js — Routes for Course File management and Google Drive integration.
 *
 * Stage 1 Endpoints:
 *  - GET /api/course-files/google/auth       — Initiate OAuth flow (Protected)
 *  - GET /api/course-files/google/callback   — Google redirect callback (State-protected)
 *  - GET /api/course-files/google/status     — Get Drive connection status (Protected)
 *  - GET /api/course-files/google/verify     — Verify destination folder access (Protected)
 *
 * Stage 2 Endpoints:
 *  - GET  /api/course-files/offering/:offeringId  — List all course files for an offering (Protected)
 *  - POST /api/course-files/sync/cis/:offeringId  — Generate and sync CIS to Google Drive (Protected)
 *  - POST /api/course-files/upload/:offeringId    — Upload document buffer/file to Google Drive (Protected)
 *  - GET  /api/course-files/:id/view              — View file metadata and Drive link (Protected)
 *  - GET  /api/course-files/:id/download          — Stream/download file from Drive (Protected)
 */
const express = require('express');
const multer = require('multer');
const router = express.Router();
const courseFileController = require('../controllers/courseFile.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// In-memory file storage for direct uploads (never stored to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
});

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

/* ── Stage 2: Course File Sync, Upload & Access Endpoints ──── */

// 5. List all synchronized files for an offering
router.get('/offering/:offeringId', flexibleAuth, courseFileController.listOfferingFiles);

// 6. Generate and synchronize CIS (Course Information Sheet) to Google Drive
router.post('/sync/cis/:offeringId', flexibleAuth, courseFileController.syncCISDocument);

// 7. Generate and synchronize CCR (Course Control Report) to Google Drive
router.post('/sync/ccr/:offeringId', flexibleAuth, courseFileController.syncCCRDocument);

// 8. Generate and synchronize Timetable with Consulting Hours to Google Drive
router.post('/sync/timetable/:offeringId', flexibleAuth, courseFileController.syncTimetableDocument);


// Middleware to handle both single and multiple file uploads seamlessly
const uploadFilesMiddleware = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const error = new Error('File size exceeds the 25 MB limit.');
        error.statusCode = 400;
        return next(error);
      }
      return next(err);
    }
    if (req.files && req.files.length > 0 && !req.file) {
      req.file = req.files.find((f) => f.fieldname === 'file') || req.files[0];
    }
    next();
  });
};

// 9. Direct document upload for an offering (single or multiple files, or base64)
router.post('/upload/:offeringId', flexibleAuth, uploadFilesMiddleware, courseFileController.uploadOfferingDocument);

// 10. View course file metadata / redirect to Google Drive web view
router.get('/:id/view', flexibleAuth, courseFileController.viewCourseFile);

// 11. Download / stream course file directly from Google Drive
router.get('/:id/download', flexibleAuth, courseFileController.downloadCourseFile);

// 12. Delete course file and remove from Google Drive
router.delete('/:id', flexibleAuth, courseFileController.deleteCourseFile);

module.exports = router;

