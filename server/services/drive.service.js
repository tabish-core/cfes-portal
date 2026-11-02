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
 * Detects whether an error from Google Drive or Google OAuth indicates
 * an expired, revoked, or invalid refresh token ('invalid_grant').
 *
 * @param {any} err
 * @returns {boolean}
 */
const isInvalidGrantError = (err) => {
  if (!err) return false;
  if (err.isInvalidGrant || err.code === 'INVALID_GRANT') return true;
  const msg = (err.message || '').toLowerCase();
  const desc = (err.response?.data?.error_description || '').toLowerCase();
  const errCode = (err.response?.data?.error || '').toLowerCase();
  return (
    msg.includes('invalid_grant') ||
    desc.includes('invalid_grant') ||
    errCode === 'invalid_grant' ||
    msg.includes('token has been expired or revoked')
  );
};

/**
 * Normalizes Google Drive errors into clear, actionable application errors.
 * Specifically converts `invalid_grant` / revoked refresh tokens to HTTP 503
 * with code `INVALID_GRANT` indicating admin reconnect is required.
 *
 * @param {Error} err
 * @returns {Error}
 */
const normalizeDriveError = (err) => {
  if (!err) return err;
  if (isInvalidGrantError(err)) {
    const error = new Error(
      'Google Drive authorization has expired or been revoked (invalid_grant). An administrator must re-authorize Google Drive via /api/course-files/google/auth.'
    );
    error.statusCode = 503;
    error.code = 'INVALID_GRANT';
    error.isInvalidGrant = true;
    error.originalError = err.message;
    return error;
  }
  return err;
};

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
    if (isInvalidGrantError(err)) {
      throw normalizeDriveError(err);
    }

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

    throw normalizeDriveError(err);
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
      if (isInvalidGrantError(err)) {
        throw normalizeDriveError(err);
      }
      // If file was deleted in Drive (404), log warning and proceed to re-create
      if (err.code === 404 || err.status === 404) {
        console.warn(
          `File ${existingFileId} not found in Google Drive; creating a new file in ${folderId}`
        );
      } else {
        throw normalizeDriveError(err);
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

  let response;
  try {
    response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime',
    });
  } catch (err) {
    throw normalizeDriveError(err);
  }

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

  try {
    const response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    return response.data;
  } catch (err) {
    throw normalizeDriveError(err);
  }
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

  try {
    const response = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, trashed',
    });

    return response.data;
  } catch (err) {
    throw normalizeDriveError(err);
  }
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
    if (isInvalidGrantError(err)) {
      throw normalizeDriveError(err);
    }
    // If the file does not exist (404), treat as safely removed
    if (err.code === 404 || err.status === 404) {
      console.warn(`File '${fileId}' not found in Google Drive (already deleted).`);
      return true;
    }
    throw normalizeDriveError(err);
  }
};

// In-process single-flight map to serialize concurrent folder resolution/creation within the same Node.js process.
// NOTE: This provides concurrency protection within a single Node.js instance.
// In a horizontally scaled / multi-process deployment without an external distributed lock
// (e.g. Redis), cross-process races are handled via Drive re-checking, error recovery, and post-creation race cleanup.
const inFlightFolderResolutions = new Map();

/**
 * Evaluates candidate folders returned from Google Drive against requested appProperties.
 *
 * Matching Rules:
 * 1. Exact Match: Every key in requestedProps matches the folder's appProperties.
 * 2. Conflicting Folder: Folder has appProperties with at least one key from requestedProps
 *    that has a different value.
 * 3. Legacy / Missing Metadata Folder: Folder has no appProperties or none of the requested keys.
 *
 * Decision:
 * - If exact match found -> return matching folder ID.
 * - If no exact match, but conflicting folders exist -> throw explicit conflict error.
 *   (Never silently reuse or duplicate a conflicting folder).
 * - If no exact match and no conflicts, but a single legacy folder exists -> safely reuse it
 *   under the backwards compatibility rule for folders created prior to this implementation.
 * - If multiple ambiguous legacy folders exist -> throw ambiguous folder error.
 * - If no existing folders exist -> return null (proceed to creation).
 *
 * @param {Array<Object>} files - Candidate folders from Drive
 * @param {string} safeName - Sanitized folder name
 * @param {string} parentFolderId - Parent folder ID
 * @param {Object} [requestedProps] - Requested appProperties metadata
 * @returns {string|null} Matched folder ID or null
 */
const matchFolderByIdentity = (files, safeName, parentFolderId, requestedProps) => {
  if (!files || files.length === 0) return null;

  if (!requestedProps || Object.keys(requestedProps).length === 0) {
    // No metadata specified: return first existing folder
    return files[0].id;
  }

  const propKeys = Object.keys(requestedProps);
  const matches = [];
  const conflicts = [];
  const legacy = [];

  for (const f of files) {
    if (!f.appProperties || Object.keys(f.appProperties).length === 0) {
      legacy.push(f);
      continue;
    }

    const hasConflict = propKeys.some(
      (k) => f.appProperties[k] !== undefined && f.appProperties[k] !== requestedProps[k]
    );

    if (hasConflict) {
      conflicts.push(f);
      continue;
    }

    const isMatch = propKeys.every((k) => f.appProperties[k] === requestedProps[k]);
    if (isMatch) {
      matches.push(f);
    } else {
      // Has some appProperties, but not conflicting with requested keys and missing some requested keys
      legacy.push(f);
    }
  }

  // 1. Exact match takes precedence
  if (matches.length > 0) {
    return matches[0].id;
  }

  // 2. Conflicting metadata: never silently reuse or duplicate
  if (conflicts.length > 0) {
    const conflictKeys = propKeys.filter((k) =>
      conflicts.some(
        (c) =>
          c.appProperties &&
          c.appProperties[k] !== undefined &&
          c.appProperties[k] !== requestedProps[k]
      )
    );
    const error = new Error(
      `Google Drive folder identity conflict: Folder '${safeName}' under parent '${parentFolderId}' already exists but has conflicting metadata (${conflictKeys.join(', ')}). Cannot safely reuse or create duplicate folder.`
    );
    error.statusCode = 409;
    error.code = 'FOLDER_METADATA_CONFLICT';
    throw error;
  }

  // 3. Legacy compatibility rule: exactly one folder exists without conflicting metadata
  if (legacy.length === 1) {
    return legacy[0].id;
  }

  // 4. Ambiguous legacy folders: multiple folders exist without metadata
  if (legacy.length > 1) {
    const error = new Error(
      `Google Drive folder ambiguity: Multiple legacy folders named '${safeName}' exist under parent '${parentFolderId}' without matching metadata. Cannot safely select folder.`
    );
    error.statusCode = 409;
    error.code = 'FOLDER_AMBIGUOUS_LEGACY';
    throw error;
  }

  return null;
};

/**
 * Internal execution of folder search and creation.
 */
const executeGetOrCreateFolder = async (safeName, parentFolderId, options = {}) => {
  const drive = await module.exports.getDriveClient();
  const query = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and '${parentFolderId}' in parents and trashed=false`;

  // 1. Initial lookup
  let res;
  try {
    res = await drive.files.list({
      q: query,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id, name, appProperties, createdTime)',
    });
  } catch (listErr) {
    throw normalizeDriveError(listErr);
  }

  const existingFiles = res.data?.files || [];
  const matchedId = matchFolderByIdentity(existingFiles, safeName, parentFolderId, options.appProperties);
  if (matchedId) {
    return matchedId;
  }

  // 2. Folder does not exist, prepare create request
  const requestBody = {
    name: safeName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId],
  };
  if (options && options.appProperties) {
    requestBody.appProperties = options.appProperties;
  }

  let created;
  try {
    created = await drive.files.create({
      requestBody,
      supportsAllDrives: true,
      fields: 'id, name, appProperties, createdTime',
    });
  } catch (createErr) {
    // If token is invalid or revoked, fail closed immediately without attempting re-checks
    if (isInvalidGrantError(createErr)) {
      throw normalizeDriveError(createErr);
    }

    // Re-check Google Drive after a creation error or conflict:
    // If another request or process created the folder in the meantime, reuse it
    const recheckRes = await drive.files.list({
      q: query,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id, name, appProperties, createdTime)',
    }).catch(() => null);

    if (recheckRes && recheckRes.data?.files && recheckRes.data.files.length > 0) {
      const recoveredId = matchFolderByIdentity(
        recheckRes.data.files,
        safeName,
        parentFolderId,
        options.appProperties
      );
      if (recoveredId) return recoveredId;
    }
    throw normalizeDriveError(createErr);
  }

  const newFolderId = created.data.id;

  // 3. Post-creation race detection:
  // Recheck Google Drive to see if another concurrent request or process also created a folder
  try {
    const postCheckRes = await drive.files.list({
      q: query,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id, name, appProperties, createdTime)',
    });

    const postFiles = postCheckRes.data?.files || [];
    if (postFiles.length > 1) {
      // Race detected: multiple same-name folders exist under this parent
      const matchingFolders = postFiles.filter((f) => {
        if (!options.appProperties) return true;
        return (
          f.appProperties &&
          Object.keys(options.appProperties).every(
            (k) => f.appProperties[k] === options.appProperties[k]
          )
        );
      });

      if (matchingFolders.length > 1) {
        // Sort by createdTime ascending to determine the canonical first folder
        matchingFolders.sort((a, b) => {
          const timeA = new Date(a.createdTime || 0).getTime();
          const timeB = new Date(b.createdTime || 0).getTime();
          return timeA - timeB;
        });

        const canonicalFolder = matchingFolders[0];
        // If the folder we just created is not the canonical first folder, trash the redundant duplicate
        if (canonicalFolder.id !== newFolderId) {
          console.warn(
            `Concurrent creation race detected for folder '${safeName}'. Trashing redundant folder ${newFolderId} and reusing canonical folder ${canonicalFolder.id}.`
          );
          try {
            await drive.files.update({
              fileId: newFolderId,
              requestBody: { trashed: true },
              supportsAllDrives: true,
            });
          } catch (trashErr) {
            console.error(
              `WARNING: Failed to trash redundant duplicate folder ${newFolderId} created during concurrent race for '${safeName}': ${trashErr.message}. Canonical folder ${canonicalFolder.id} was preserved.`
            );
          }
          return canonicalFolder.id;
        }
      }
    }
  } catch (postCheckErr) {
    // Non-blocking warning: proceed with created folder
    console.warn(`Post-creation race check warning for '${safeName}':`, postCheckErr.message);
  }

  return newFolderId;
};

/**
 * Finds or creates a subfolder in Google Drive under a specified parent folder.
 *
 * Implements:
 * - Parent folder isolation
 * - Exact metadata identity matching
 * - Safe legacy folder compatibility
 * - Conflicting metadata error handling (409)
 * - In-process single-flight concurrency serialization
 * - Cross-process race detection and recovery (trashing redundant duplicate)
 * - Fail-closed error propagation (no silent fallback to parentFolderId)
 *
 * @param {string} folderName - Name of the folder
 * @param {string} [parentFolderId] - Parent folder ID (defaults to DESTINATION_FOLDER_ID)
 * @param {Object} [options] - Additional options ({ appProperties, throwOnError })
 * @returns {Promise<string>} Folder ID
 */
const getOrCreateFolder = async (
  folderName,
  parentFolderId = googleDriveConfig.DESTINATION_FOLDER_ID,
  options = {}
) => {
  if (!folderName) return parentFolderId;

  const safeName = folderName.replace(/['\\]/g, '');
  const lockKey = `${parentFolderId}:${safeName}`;

  // In-process concurrency protection:
  // If an operation for this exact folder is already in-flight in this Node instance,
  // wait for it to complete, then recheck Drive so we reuse the created folder.
  if (inFlightFolderResolutions.has(lockKey)) {
    try {
      await inFlightFolderResolutions.get(lockKey);
    } catch (_) {
      // In-flight operation might have failed or raced; proceed to our own check
    }
  }

  let resolveLock;
  const lockPromise = new Promise((resolve) => {
    resolveLock = resolve;
  });

  if (!inFlightFolderResolutions.has(lockKey)) {
    inFlightFolderResolutions.set(lockKey, lockPromise);
  }

  try {
    return await executeGetOrCreateFolder(safeName, parentFolderId, options);
  } catch (err) {
    // If it is an invalid_grant error, ALWAYS rethrow immediately!
    // Never silently fall back to parentFolderId on invalid_grant, even if throwOnError is false.
    if (isInvalidGrantError(err)) {
      throw normalizeDriveError(err);
    }
    if (options && options.throwOnError) {
      throw err;
    }
    // If it is an explicit folder conflict or ambiguity error, always rethrow
    if (
      err.statusCode === 409 ||
      err.code === 'FOLDER_METADATA_CONFLICT' ||
      err.code === 'FOLDER_AMBIGUOUS_LEGACY'
    ) {
      throw err;
    }
    // Backward-compatibility: only fall back if throwOnError was explicitly set to false
    if (options && options.throwOnError === false) {
      console.warn(`Error resolving or creating folder '${safeName}' in Google Drive: ${err.message}`);
      return parentFolderId;
    }
    // By default, unexpected Drive errors must propagate to the caller to prevent silent root fallbacks
    throw err;
  } finally {
    if (resolveLock) resolveLock();
    inFlightFolderResolutions.delete(lockKey);
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
  matchFolderByIdentity,
  inFlightFolderResolutions,
  isInvalidGrantError,
  normalizeDriveError,
};

