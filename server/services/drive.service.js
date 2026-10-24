/**
 * drive.service.js — Google Drive operations service.
 *
 * Implements:
 *  - Google Drive v3 client instantiation
 *  - Destination folder access verification with Shared Drive support (supportsAllDrives: true)
 *  - Permission audit (canAddChildren, canEdit, trash detection)
 *  - Connection and credential status inspection
 */
const { google } = require('googleapis');
const googleDriveConfig = require('../config/googleDrive');

/**
 * Instantiates an authenticated Google Drive API v3 client.
 *
 * @returns {Promise<import('googleapis').drive_v3.Drive>}
 */
const getDriveClient = async () => {
  const auth = await googleDriveConfig.getAuthenticatedClient();
  return google.drive({ version: 'v3', auth });
};

/**
 * Verifies that the backend can access and write to the configured Google Drive folder.
 * Supports standard folders, shared folders, and Google Workspace Shared Drives.
 *
 * @param {string} [folderId] - Optional override folder ID (defaults to GOOGLE_DRIVE_FOLDER_ID)
 * @returns {Promise<Object>} Verification details including folder name and write permissions
 */
const verifyFolderAccess = async (folderId = googleDriveConfig.DESTINATION_FOLDER_ID) => {
  if (!folderId) {
    const error = new Error('Destination folder ID is not configured (GOOGLE_DRIVE_FOLDER_ID).');
    error.statusCode = 400;
    throw error;
  }

  const drive = await module.exports.getDriveClient();

  try {
    const response = await drive.files.get({
      fileId: folderId,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, trashed, driveId, capabilities, shared, webViewLink',
    });

    const folder = response.data;

    if (folder.trashed) {
      const error = new Error(
        `Configured destination folder (${folder.name}) is currently in the Google Drive Trash.`
      );
      error.statusCode = 400;
      error.details = { folderId: folder.id, trashed: true };
      throw error;
    }

    if (folder.mimeType !== 'application/vnd.google-apps.folder') {
      const error = new Error(
        `Target ID (${folder.id}) is not a folder (mimeType is '${folder.mimeType}').`
      );
      error.statusCode = 400;
      throw error;
    }

    const canAddChildren = Boolean(folder.capabilities?.canAddChildren);
    const canEdit = Boolean(folder.capabilities?.canEdit);

    return {
      success: true,
      folderId: folder.id,
      folderName: folder.name,
      mimeType: folder.mimeType,
      isSharedDrive: Boolean(folder.driveId),
      driveId: folder.driveId || null,
      webViewLink: folder.webViewLink || null,
      canAddChildren,
      canEdit,
      hasWriteAccess: canAddChildren,
      message: canAddChildren
        ? 'Access confirmed: Account has Editor write permissions in the destination folder.'
        : 'Warning: Account can view the folder but lacks permission to add files (canAddChildren is false).',
    };
  } catch (err) {
    // Enhance Google API error messages with actionable explanations
    if (err.code === 404 || err.status === 404) {
      const error = new Error(
        `Destination folder '${folderId}' not found. Verify the folder ID and confirm that your Google account has been granted access as an Editor.`
      );
      error.statusCode = 404;
      error.originalError = err.message;
      throw error;
    }

    if (err.code === 403 || err.status === 403) {
      const error = new Error(
        `Permission denied when accessing destination folder '${folderId}'. Confirm that your Google account has permission to view and edit this folder.`
      );
      error.statusCode = 403;
      error.originalError = err.message;
      throw error;
    }

    if (err.message && err.message.includes('invalid_grant')) {
      const error = new Error(
        'Google Drive authorization has expired or been revoked. Please re-authorize via /api/course-files/google/auth.'
      );
      error.statusCode = 401;
      error.code = 'INVALID_GRANT';
      throw error;
    }

    throw err;
  }
};

/**
 * Returns high-level status of the Google Drive integration.
 *
 * @returns {Promise<Object>}
 */
const getConnectionStatus = async () => {
  const tokenInfo = await googleDriveConfig.getStoredRefreshToken();

  const clientConfig = googleDriveConfig.getClientConfigStatus
    ? googleDriveConfig.getClientConfigStatus()
    : { isConfigured: true, hasClientId: true, hasClientSecret: true };

  return {
    isConfigured: Boolean(tokenInfo && tokenInfo.refreshToken),
    source: tokenInfo ? tokenInfo.source : null,
    authorizedEmail: tokenInfo?.email || null,
    destinationFolderId: googleDriveConfig.DESTINATION_FOLDER_ID,
    oauthClientReady: clientConfig.isConfigured,
    clientConfig: {
      hasClientId: clientConfig.hasClientId,
      hasClientSecret: clientConfig.hasClientSecret,
    },
  };
};

module.exports = {
  getDriveClient,
  verifyFolderAccess,
  getConnectionStatus,
};
