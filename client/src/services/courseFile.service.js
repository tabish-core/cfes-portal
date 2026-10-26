/**
 * courseFile.service.js (client) — Course File and Google Drive API integration
 */
import api from '../api/axios';

/**
 * Fetch all synchronized course files for an offering.
 * @param {string} offeringId
 * @returns {Promise<Array>} Array of CourseFile documents
 */
export const getOfferingFiles = async (offeringId) => {
  if (!offeringId) return [];
  const { data } = await api.get(`/course-files/offering/${offeringId}`);
  return data.data || [];
};

/**
 * Synchronize Course Information Sheet (CIS) to Google Drive.
 * @param {string} offeringId
 * @param {string} [format='pdf'] - 'pdf' | 'docx'
 * @returns {Promise<Object>} { success, data, message }
 */
export const syncCISDocument = async (offeringId, format = 'pdf') => {
  const { data } = await api.post(`/course-files/sync/cis/${offeringId}?format=${format}`);
  return data;
};

/**
 * Synchronize Course Control Report (CCR) to Google Drive.
 * @param {string} offeringId
 * @param {string} [format='pdf'] - 'pdf' | 'docx'
 * @returns {Promise<Object>} { success, data, message }
 */
export const syncCCRDocument = async (offeringId, format = 'pdf') => {
  const { data } = await api.post(`/course-files/sync/ccr/${offeringId}?format=${format}`);
  return data;
};

/**
 * Upload an arbitrary document to Google Drive for an offering.
 * Supports File object or FormData payload.
 * @param {string} offeringId
 * @param {FormData|Object} payload
 * @returns {Promise<Object>} { success, data, message }
 */
export const uploadOfferingDocument = async (offeringId, payload) => {
  let body = payload;
  let headers = {};

  if (payload instanceof FormData) {
    body = payload;
    headers['Content-Type'] = 'multipart/form-data';
  } else if (payload && payload.file) {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.documentType) formData.append('documentType', payload.documentType);
    if (payload.instanceName) formData.append('instanceName', payload.instanceName);
    if (payload.format) formData.append('format', payload.format);
    body = formData;
    headers['Content-Type'] = 'multipart/form-data';
  }

  const { data } = await api.post(`/course-files/upload/${offeringId}`, body, { headers });
  return data;
};

/**
 * Get CourseFile metadata by ID.
 * @param {string} fileId
 * @returns {Promise<Object>} CourseFile document
 */
export const getCourseFileById = async (fileId) => {
  const { data } = await api.get(`/course-files/${fileId}/view`);
  return data.data;
};

/**
 * Download a course file from Google Drive directly through the backend stream.
 * @param {string} fileId
 * @param {string} [suggestedFilename]
 */
export const downloadCourseFile = async (fileId, suggestedFilename) => {
  const res = await api.get(`/course-files/${fileId}/download`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', suggestedFilename || 'course_file');
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Check Google Drive authorization status.
 * @returns {Promise<Object>} { isConfigured, oauthClientReady }
 */
export const getGoogleDriveStatus = async () => {
  const { data } = await api.get('/course-files/google/status');
  return data.data;
};

/**
 * Verify Google Drive destination folder access.
 * @returns {Promise<Object>} { folderId, folderName, canAddChildren, canEdit, hasWriteAccess }
 */
export const verifyGoogleDriveAccess = async () => {
  const { data } = await api.get('/course-files/google/verify');
  return data.data;
};
