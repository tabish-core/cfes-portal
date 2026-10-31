/**
 * courseFile.service.js (client) — Course File and Google Drive API integration
 */
import api from '../api/axios';

/**
 * Fetch all synchronized course files for an offering, optionally filtered by documentType.
 * @param {string} offeringId
 * @param {string} [documentType] - e.g. 'LECTURES'
 * @returns {Promise<Array>} Array of CourseFile documents
 */
export const getOfferingFiles = async (offeringId, documentType = null) => {
  if (!offeringId) return [];
  const url = documentType
    ? `/course-files/offering/${offeringId}?documentType=${documentType}`
    : `/course-files/offering/${offeringId}`;
  const { data } = await api.get(url);
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
 * Synchronize Timetable with Consulting Hours to Google Drive.
 * @param {string} offeringId
 * @param {string} [format='pdf'] - 'pdf' | 'docx'
 * @returns {Promise<Object>} { success, data, message }
 */
export const syncTimetableDocument = async (offeringId, format = 'pdf') => {
  const { data } = await api.post(`/course-files/sync/timetable/${offeringId}?format=${format}`);
  return data;
};

/**
 * Synchronize CCP / Class Project document to Google Drive.
 * @param {string} offeringId
 * @returns {Promise<Object>} { success, data, message }
 */
export const syncProjectDocument = async (offeringId) => {
  const { data } = await api.post(`/course-files/sync/project/${offeringId}`);
  return data;
};

/**
 * Synchronize Course Completion Certificate (CCC) document to Google Drive.
 * @param {string} offeringId
 * @returns {Promise<Object>} { success, data, message }
 */
export const syncCCCDocument = async (offeringId) => {
  const { data } = await api.post(`/course-files/sync/ccc/${offeringId}`);
  return data;
};

/**
 * Synchronize Course Review Report (CRR) document to Google Drive.
 * @param {string} offeringId
 * @returns {Promise<Object>} { success, data, message }
 */
export const syncCRRDocument = async (offeringId) => {
  const { data } = await api.post(`/course-files/sync/crr/${offeringId}`);
  return data;
};

/**
 * Synchronize Quiz document to Google Drive.
 * @param {string} offeringId
 * @param {string} quizId
 * @returns {Promise<Object>} { success, data, message }
 */
export const syncQuizDocument = async (offeringId, quizId) => {
  const { data } = await api.post(`/course-files/sync/quiz/${offeringId}/${quizId}`);
  return data;
};

/**
 * Synchronize Assignment document to Google Drive.
 * @param {string} offeringId
 * @param {string} assignmentId
 * @returns {Promise<Object>} { success, data, message }
 */
export const syncAssignmentDocument = async (offeringId, assignmentId) => {
  const { data } = await api.post(`/course-files/sync/assignment/${offeringId}/${assignmentId}`);
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
  } else if (payload && payload.files && Array.isArray(payload.files)) {
    const formData = new FormData();
    payload.files.forEach((f) => formData.append('files', f));
    if (payload.documentType) formData.append('documentType', payload.documentType);
    body = formData;
    headers['Content-Type'] = 'multipart/form-data';
  }

  const { data } = await api.post(`/course-files/upload/${offeringId}`, body, { headers });
  return data;
};

/**
 * Upload one or more lecture files for a CourseOffering.
 * @param {string} offeringId
 * @param {Array<File>|File} files
 * @returns {Promise<Object>} { success, data, message }
 */
export const uploadLectureFiles = async (offeringId, files) => {
  const formData = new FormData();
  formData.append('documentType', 'LECTURES');
  const fileList = Array.isArray(files) ? files : [files];
  fileList.forEach((f) => formData.append('files', f));
  const { data } = await api.post(`/course-files/upload/${offeringId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

/**
 * Upload or replace an exam document (Midterm or Final) for an offering.
 * Supports PDF (.pdf), Microsoft Word (.doc, .docx) up to 25 MB.
 * @param {string} offeringId
 * @param {string} documentType - One of the 8 exam document types
 * @param {File} file - File object
 * @returns {Promise<Object>} { success, data, message }
 */
export const uploadExamDocument = async (offeringId, documentType, file) => {
  const formData = new FormData();
  formData.append('documentType', documentType);
  formData.append('file', file);
  const { data } = await api.post(`/course-files/upload/exam/${offeringId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

/**
 * Delete a CourseFile from Google Drive and remove its metadata.
 * @param {string} fileId
 * @returns {Promise<Object>} { success, data, message }
 */
export const deleteCourseFile = async (fileId) => {
  const { data } = await api.delete(`/course-files/${fileId}`);
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
