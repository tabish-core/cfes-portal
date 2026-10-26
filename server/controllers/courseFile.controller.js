/**
 * courseFile.controller.js — Controller for Google Drive OAuth, connection status,
 * and folder verification.
 *
 * Stage 1 Endpoints:
 *  - GET /api/course-files/google/auth       — Initiates OAuth consent flow (generates CSRF state token)
 *  - GET /api/course-files/google/callback   — OAuth redirect callback from Google (state verification & token exchange)
 *  - GET /api/course-files/google/status     — Checks if Google Drive is authorized
 *  - GET /api/course-files/google/verify     — Validates destination folder access and Editor permissions
 */
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const googleDriveConfig = require('../config/googleDrive');
const driveService = require('../services/drive.service');
const courseFileService = require('../services/courseFile.service');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Initiates the Google OAuth authorization flow.
 *
 * Generates an HMAC-signed CSRF state token that binds the request to the
 * authenticated user and a nonce. Redirects or returns the Google auth URL.
 *
 * @route   GET /api/course-files/google/auth
 * @access  Private (Authenticated users: Faculty / HoD / Dean)
 */
const initiateGoogleAuth = async (req, res, next) => {
  try {
    const oauth2Client = googleDriveConfig.getOAuth2Client();

    // Generate CSRF protection state token valid for 15 minutes
    const statePayload = {
      userId: req.user._id.toString(),
      userEmail: req.user.email,
      nonce: crypto.randomBytes(16).toString('hex'),
      action: 'google_drive_oauth',
    };

    const stateToken = jwt.sign(statePayload, process.env.JWT_SECRET, {
      expiresIn: '15m',
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Mandatory: requests a refresh token for long-term backend access
      prompt: 'consent',      // Mandatory: forces consent screen so Google returns a refresh_token every time
      scope: googleDriveConfig.SCOPES,
      state: stateToken,
    });

    // If browser navigates directly or client explicitly requests redirect
    if (req.query.redirect === 'true' || req.headers.accept?.includes('text/html')) {
      return res.redirect(authUrl);
    }

    return sendSuccess(
      res,
      {
        authUrl,
        destinationFolderId: googleDriveConfig.DESTINATION_FOLDER_ID,
        scopes: googleDriveConfig.SCOPES,
      },
      'Google authorization URL generated successfully. Navigate to authUrl to authorize your Google account.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the OAuth 2.0 callback from Google.
 *
 * Validates the state parameter against CSRF, exchanges the authorization code
 * for tokens, encrypts and stores the refresh token on the server, and presents
 * a secure confirmation view.
 *
 * @route   GET /api/course-files/google/callback
 * @access  Public (Callback URL registered with Google Cloud Console)
 */
const handleGoogleCallback = async (req, res, next) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    // Handle user denial or Google error
    if (oauthError) {
      return res.status(400).send(renderCallbackHtml({
        success: false,
        title: 'Authorization Cancelled',
        message: `Google reported an error: ${oauthError}. ${error_description || ''}`,
      }));
    }

    // 1. Validate required query parameters
    if (!code || !state) {
      return res.status(400).send(renderCallbackHtml({
        success: false,
        title: 'Missing Authorization Parameters',
        message: 'Invalid request: code and state parameters are required.',
      }));
    }

    // 2. Cryptographic CSRF state validation
    let decodedState;
    try {
      decodedState = jwt.verify(state, process.env.JWT_SECRET);
      if (decodedState.action !== 'google_drive_oauth') {
        throw new Error('Invalid state action');
      }
    } catch (err) {
      return res.status(400).send(renderCallbackHtml({
        success: false,
        title: 'Invalid or Expired State',
        message: 'The authorization session expired or the state parameter was invalid. Please initiate authorization again from the portal.',
      }));
    }

    // 3. Exchange authorization code for tokens
    const oauth2Client = googleDriveConfig.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // Check if we already have a stored token
      const existing = await driveService.getConnectionStatus();
      if (!existing.isConfigured) {
        return res.status(400).send(renderCallbackHtml({
          success: false,
          title: 'Missing Refresh Token',
          message:
            'Google did not return a refresh token. Please remove this app from your Google Account Authorized Apps (myaccount.google.com/permissions) and try again with prompt=consent.',
        }));
      }
    }

    // 4. Retrieve authorized user info from token
    oauth2Client.setCredentials(tokens);
    let authorizedEmail = '';
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
      authorizedEmail = tokenInfo.email || '';
    } catch (err) {
      console.warn('Could not retrieve token info email:', err.message);
    }

    // 5. Encrypt and persist the refresh token if provided
    if (tokens.refresh_token) {
      await googleDriveConfig.storeRefreshToken(tokens.refresh_token, {
        email: authorizedEmail,
        scopes: googleDriveConfig.SCOPES,
        expiryDate: tokens.expiry_date,
      });
    }

    // 6. Return secure HTML confirmation (never leaks tokens)
    return res.status(200).send(renderCallbackHtml({
      success: true,
      title: 'Google Drive Connected Successfully!',
      email: authorizedEmail,
      folderId: googleDriveConfig.DESTINATION_FOLDER_ID,
      message: 'Your Google account has been authorized. The backend can now access the configured destination folder.',
    }));
  } catch (err) {
    console.error('Error in Google OAuth callback:', err);
    return res.status(500).send(renderCallbackHtml({
      success: false,
      title: 'Authorization Failed',
      message: err.message || 'An unexpected error occurred during Google token exchange.',
    }));
  }
};

/**
 * Returns current Google Drive connection status without exposing sensitive credentials.
 *
 * @route   GET /api/course-files/google/status
 * @access  Private (Authenticated users)
 */
const getGoogleAuthStatus = async (req, res, next) => {
  try {
    const status = await driveService.getConnectionStatus();
    return sendSuccess(res, status, 'Google Drive authorization status retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Verifies that the authenticated Drive client can read and write to the destination folder.
 *
 * @route   GET /api/course-files/google/verify
 * @access  Private (Authenticated users)
 */
const verifyGoogleDriveAccess = async (req, res, next) => {
  try {
    const result = await driveService.verifyFolderAccess();
    return sendSuccess(res, result, 'Destination folder access verified successfully.');
  } catch (err) {
    const status = err.statusCode || 500;
    return sendError(res, err.message, status, err.details || null);
  }
};

/**
 * Lists all course files for a CourseOffering.
 *
 * @route   GET /api/course-files/offering/:offeringId
 * @access  Private
 */
const listOfferingFiles = async (req, res, next) => {
  try {
    const { offeringId } = req.params;
    const documentType = req.query?.documentType;
    const files = await courseFileService.listOfferingFiles(offeringId, req.user, documentType);
    return sendSuccess(res, files, 'Course files retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Generates and synchronizes the Course Information Sheet (CIS) to Google Drive.
 *
 * @route   POST /api/course-files/sync/cis/:offeringId
 * @access  Private
 */
const syncCISDocument = async (req, res, next) => {
  try {
    const { offeringId } = req.params;
    const format = req.query.format || req.body?.format || 'pdf';
    const result = await courseFileService.generateAndSyncCIS({
      offeringId,
      fileFormat: format,
      user: req.user,
    });
    return sendSuccess(
      res,
      result,
      `Course Information Sheet (${result.fileFormat.toUpperCase()}) synchronized to Google Drive successfully.`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Generates and synchronizes the Course Control Report (CCR) to Google Drive.
 *
 * @route   POST /api/course-files/sync/ccr/:offeringId
 * @access  Private
 */
const syncCCRDocument = async (req, res, next) => {
  try {
    const { offeringId } = req.params;
    const format = req.query.format || req.body?.format || 'pdf';
    const result = await courseFileService.generateAndSyncCCR({
      offeringId,
      fileFormat: format,
      user: req.user,
    });
    return sendSuccess(
      res,
      result,
      `Course Control Report (${result.fileFormat.toUpperCase()}) synchronized to Google Drive successfully.`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Generates and synchronizes the Timetable with Consulting Hours to Google Drive.
 *
 * @route   POST /api/course-files/sync/timetable/:offeringId
 * @access  Private
 */
const syncTimetableDocument = async (req, res, next) => {
  try {
    const { offeringId } = req.params;
    const format = req.query.format || req.body?.format || 'pdf';
    const result = await courseFileService.generateAndSyncTimetable({
      offeringId,
      fileFormat: format,
      user: req.user,
    });
    return sendSuccess(
      res,
      result,
      `Timetable and Consulting Hours (${result.fileFormat.toUpperCase()}) synchronized to Google Drive successfully.`
    );
  } catch (err) {
    next(err);
  }
};


/**
 * Uploads an arbitrary course document buffer to Google Drive for an offering.
 * Supports multipart/form-data upload (via multer) or base64 JSON payload.
 *
 * @route   POST /api/course-files/upload/:offeringId
 * @access  Private
 */
const uploadOfferingDocument = async (req, res, next) => {
  try {
    const { offeringId } = req.params;
    const { documentType, instanceName, format } = req.body;

    if (!documentType) {
      return sendError(res, 'Document type is required.', 400);
    }

    // Special handling for LECTURES: supports multi-file uploads and preserves original filenames
    if (documentType === 'LECTURES') {
      const filesToUpload =
        req.files && req.files.length > 0 ? req.files : req.file ? [req.file] : [];
      if (filesToUpload.length === 0) {
        return sendError(res, 'At least one lecture file is required for upload.', 400);
      }

      const results = await courseFileService.uploadLectureFiles({
        offeringId,
        files: filesToUpload,
        user: req.user,
      });

      const message =
        results.length === 1
          ? 'Lecture file uploaded to Google Drive successfully.'
          : `${results.length} lecture files uploaded to Google Drive successfully.`;

      return sendSuccess(
        res,
        results.length === 1 ? results[0] : { files: results, count: results.length },
        message
      );
    }

    let buffer = null;
    let fileFormat = format;

    if (req.file) {
      buffer = req.file.buffer;
      if (!fileFormat) {
        const ext = req.file.originalname.split('.').pop()?.toLowerCase();
        fileFormat = ['pdf', 'docx', 'xlsx'].includes(ext) ? ext : 'other';
      }
    } else if (req.body.bufferBase64) {
      buffer = Buffer.from(req.body.bufferBase64, 'base64');
    }

    if (!buffer) {
      return sendError(
        res,
        'File content is required (either as multipart file upload or bufferBase64).',
        400
      );
    }

    const result = await courseFileService.syncOfferingDocument({
      offeringId,
      documentType,
      fileFormat: fileFormat || 'pdf',
      instanceName: instanceName || '',
      buffer,
      user: req.user,
    });

    return sendSuccess(res, result, 'Document synchronized to Google Drive successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes a CourseFile record and removes the file from Google Drive.
 *
 * @route   DELETE /api/course-files/:id
 * @access  Private
 */
const deleteCourseFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await courseFileService.deleteCourseFile(id, req.user);
    return sendSuccess(res, result, 'File deleted successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves CourseFile metadata and Google Drive link.
 * If ?redirect=true is passed, redirects browser directly to webViewLink.
 *
 * @route   GET /api/course-files/:id/view
 * @access  Private
 */
const viewCourseFile = async (req, res, next) => {
  try {
    const courseFile = await courseFileService.getCourseFileById(req.params.id, req.user);

    if (req.query.redirect === 'true' && courseFile.googleDriveWebViewLink) {
      return res.redirect(courseFile.googleDriveWebViewLink);
    }

    return sendSuccess(res, courseFile, 'Course file metadata retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Streams the file content directly from Google Drive API to the browser.
 * Validates offering authorization before streaming.
 *
 * @route   GET /api/course-files/:id/download
 * @access  Private
 */
const downloadCourseFile = async (req, res, next) => {
  try {
    const { stream, courseFile } = await courseFileService.downloadCourseFile(
      req.params.id,
      req.user
    );

    res.setHeader('Content-Type', courseFile.mimeType || 'application/octet-stream');
    const safeFilename = (courseFile.filename || 'course_file').replace(/["\r\n]/g, '');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"`
    );

    stream.on('error', (err) => {
      console.error('Error streaming file from Google Drive:', err);
      if (!res.headersSent) {
        return sendError(res, 'Failed to stream file from Google Drive.', 500);
      }
    });

    return stream.pipe(res);
  } catch (err) {
    next(err);
  }
};

/**
 * Helper to render a clean, branded HTML response for the OAuth callback.
 */
const renderCallbackHtml = ({ success, title, message, email, folderId }) => {
  const bgColor = success ? '#f0fdf4' : '#fef2f2';
  const borderColor = success ? '#bbf7d0' : '#fecaca';
  const textColor = success ? '#166534' : '#991b1b';
  const icon = success ? '✓' : '✗';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — CFES Faculty Portal</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
    }
    .card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 2.5rem;
      max-width: 520px;
      width: 100%;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: ${bgColor};
      border: 2px solid ${borderColor};
      color: ${textColor};
      font-size: 26px;
      font-weight: bold;
      margin-bottom: 1.25rem;
    }
    h1 {
      font-size: 1.35rem;
      margin-bottom: 0.75rem;
      color: #0f172a;
    }
    p {
      color: #475569;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }
    .details {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
      text-align: left;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .details div {
      margin-bottom: 0.5rem;
    }
    .details div:last-child {
      margin-bottom: 0;
    }
    .details strong {
      color: #334155;
    }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: white;
      text-decoration: none;
      padding: 0.65rem 1.25rem;
      border-radius: 6px;
      font-weight: 500;
      font-size: 0.9rem;
      transition: background 0.15s;
      cursor: pointer;
      border: none;
    }
    .btn:hover {
      background: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${
      success
        ? `<div class="details">
        ${email ? `<div><strong>Authorized Account:</strong> ${email}</div>` : ''}
        ${folderId ? `<div><strong>Destination Folder ID:</strong> <code>${folderId}</code></div>` : ''}
        <div><strong>Token Status:</strong> Securely encrypted & stored server-side</div>
      </div>
      <button onclick="verifyAccess()" class="btn">Verify Destination Folder Access</button>
      <script>
        function verifyAccess() {
          var token = localStorage.getItem('token') || localStorage.getItem('cfes_token') || sessionStorage.getItem('token');
          window.location.href = '/api/course-files/google/verify' + (token ? '?token=' + encodeURIComponent(token) : '');
        }
      </script>`
        : `<a href="/api/course-files/google/auth" class="btn">Try Authorizing Again</a>`
    }
  </div>
</body>
</html>`;
};

module.exports = {
  initiateGoogleAuth,
  handleGoogleCallback,
  getGoogleAuthStatus,
  verifyGoogleDriveAccess,
  listOfferingFiles,
  syncCISDocument,
  syncCCRDocument,
  syncTimetableDocument,
  uploadOfferingDocument,
  deleteCourseFile,
  viewCourseFile,
  downloadCourseFile,
};
