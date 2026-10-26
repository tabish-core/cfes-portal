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

const { Readable } = require('node:stream');

/**
 * Uploads a document buffer to Google Drive.
 *
 * If `existingFileId` is provided, attempts in-place update of file content and metadata.
 * If the file is not found (404), falls back to creating a new file in destination folder.
 *
 * Security: Files are never made public.
 *
 * @param {Object} params
 * @param {Buffer} params.buffer - Document file buffer
 * @param {string} params.filename - Desired filename in Google Drive
 * @param {string} params.mimeType - Document MIME type (e.g. application/pdf)
 * @param {string} [params.folderId] - Destination folder ID (defaults to configured folder)
 * @param {string} [params.existingFileId] - Optional Drive file ID for canonical updates
 * @returns {Promise<Object>} Uploaded file metadata
 */
const uploadDocumentBuffer = async ({
  buffer,
  filename,
  mimeType,
  folderId = googleDriveConfig.DESTINATION_FOLDER_ID,
  existingFileId = null,
}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    const error = new Error('A valid file Buffer is required for document upload.');
    error.statusCode = 400;
    throw error;
  }
  if (!filename) {
    const error = new Error('Filename is required for document upload.');
    error.statusCode = 400;
    throw error;
  }
  if (!mimeType) {
    const error = new Error('MIME type is required for document upload.');
    error.statusCode = 400;
    throw error;
  }
  if (!folderId) {
    const error = new Error('Google Drive destination folder ID is not configured.');
    error.statusCode = 500;
    throw error;
  }

  const drive = await module.exports.getDriveClient();

  // 1. In-place update if existingFileId is supplied
  if (existingFileId) {
    try {
      const response = await drive.files.update({
        fileId: existingFileId,
        requestBody: {
          name: filename,
        },
        media: {
          mimeType,
          body: Readable.from(buffer),
        },
        supportsAllDrives: true,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, modifiedTime',
      });

      return {
        fileId: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        sizeBytes: Number(response.data.size) || buffer.length,
        webViewLink: response.data.webViewLink || null,
        webContentLink: response.data.webContentLink || null,
        isUpdated: true,
      };
    } catch (err) {
      // If file was deleted in Drive (404), log warning and proceed to re-create
      if (err.code === 404 || err.status === 404) {
        console.warn(
          `File ${existingFileId} not found in Google Drive; creating a new file in ${folderId}`
        );
      } else {
        throw err;
      }
    }
  }

  // 2. Fresh file creation
  const fileMetadata = {
    name: filename,
    parents: [folderId],
  };

  const media = {
    mimeType,
    body: Readable.from(buffer),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    supportsAllDrives: true,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime',
  });

  return {
    fileId: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    sizeBytes: Number(response.data.size) || buffer.length,
    webViewLink: response.data.webViewLink || null,
    webContentLink: response.data.webContentLink || null,
    isUpdated: false,
  };
};

/**
 * Streams a file's raw content directly from Google Drive API.
 *
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<import('stream').Readable>}
 */
const getFileStream = async (fileId) => {
  if (!fileId) {
    const error = new Error('File ID is required to retrieve file stream.');
    error.statusCode = 400;
    throw error;
  }

  const drive = await module.exports.getDriveClient();

  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );

  return response.data;
};

/**
 * Retrieves file metadata from Google Drive without downloading media.
 *
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<Object>}
 */
const getFileMetadata = async (fileId) => {
  if (!fileId) {
    const error = new Error('File ID is required to retrieve file metadata.');
    error.statusCode = 400;
    throw error;
  }

  const drive = await module.exports.getDriveClient();

  const response = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, trashed',
  });

  return response.data;
};

/**
 * Deletes a file from Google Drive.
 *
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<boolean>} True if deleted or already gone
 */
const deleteFile = async (fileId) => {
  if (!fileId) {
    const error = new Error('File ID is required to delete file.');
    error.statusCode = 400;
    throw error;
  }

  const drive = await module.exports.getDriveClient();

  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    return true;
  } catch (err) {
    // If the file does not exist (404), treat as safely removed
    if (err.code === 404 || err.status === 404) {
      console.warn(`File '${fileId}' not found in Google Drive (already deleted).`);
      return true;
    }
    throw err;
  }
};

/**
 * Finds or creates a subfolder in Google Drive under a specified parent folder.
 *
 * @param {string} folderName - Name of the folder
 * @param {string} [parentFolderId] - Parent folder ID (defaults to DESTINATION_FOLDER_ID)
 * @returns {Promise<string>} Folder ID
 */
const getOrCreateFolder = async (
  folderName,
  parentFolderId = googleDriveConfig.DESTINATION_FOLDER_ID
) => {
  if (!folderName) return parentFolderId;

  const drive = await module.exports.getDriveClient();
  const safeName = folderName.replace(/['\\]/g, '');
  const query = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and '${parentFolderId}' in parents and trashed=false`;

  try {
    const res = await drive.files.list({
      q: query,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id, name)',
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id;
    }

    const created = await drive.files.create({
      requestBody: {
        name: safeName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      supportsAllDrives: true,
      fields: 'id, name',
    });

    return created.data.id;
  } catch (err) {
    console.warn(`Error resolving or creating folder '${safeName}' in Google Drive: ${err.message}`);
    // Graceful fallback to parent destination folder
    return parentFolderId;
  }
};

module.exports = {
  getDriveClient,
  verifyFolderAccess,
  getConnectionStatus,
  uploadDocumentBuffer,
  getFileStream,
  getFileMetadata,
  deleteFile,
  getOrCreateFolder,
};

