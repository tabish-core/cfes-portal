/**
 * courseFile.service.js — Business logic for course document synchronization,
 * Google Drive upload orchestration, and CourseFile persistence.
 *
 * Responsibilities:
 *  - Enforces CourseOffering authorization (faculty assigned, HoD department, Dean global)
 *  - Orchestrates in-memory document generation (CIS, etc.) and uploads buffer to Google Drive
 *  - Handles canonical document replacement (in-place Drive update + version increment)
 *  - Handles multi-instance document uploads (separate instances, e.g. Quiz 1, Quiz 2)
 *  - Automatically updates the CourseChecklist item status to completed
 *  - Manages secure file streaming and download
 */
const mongoose = require('mongoose');
const CourseFile = require('../models/CourseFile.model');
const CIS = require('../models/CIS.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const courseOfferingService = require('./courseOffering.service');
const driveService = require('./drive.service');
const googleDriveConfig = require('../config/googleDrive');
const cisWordService = require('./documentService/generateCISWord');
const cisPdfService = require('./documentService/generateCISPDF');

/**
 * Maps common file extensions to standard MIME types.
 */
const MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  other: 'application/octet-stream',
};

/**
 * Synchronizes an arbitrary document buffer to Google Drive and persists its CourseFile metadata.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {string} params.documentType - Document type code (e.g. 'CIS', 'CCR')
 * @param {string} params.fileFormat - 'pdf' | 'docx' | 'xlsx'
 * @param {string} [params.instanceName=''] - Multi-instance identifier (e.g. 'Quiz 1')
 * @param {Buffer} params.buffer - Generated or uploaded document buffer
 * @param {Object} params.user - Authenticated user making the request
 * @returns {Promise<Object>} Persisted CourseFile document
 */
const syncOfferingDocument = async ({
  offeringId,
  documentType,
  fileFormat,
  instanceName = '',
  buffer,
  user,
}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    const error = new Error('A valid file Buffer is required for synchronization.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Validate authorization against CourseOffering
  const offering = await courseOfferingService.getOfferingById(offeringId, user);
  const normalizedFormat = (fileFormat || 'pdf').toLowerCase();

  // Pre-flight validate format & type before touching Google Drive API
  if (!CourseFile.FILE_FORMATS.includes(normalizedFormat)) {
    const error = new Error(
      `Invalid file format: '${fileFormat}'. Supported formats: ${CourseFile.FILE_FORMATS.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (!CourseFile.DOCUMENT_TYPES.includes(documentType)) {
    const error = new Error(
      `Invalid document type: '${documentType}'. Supported types: ${CourseFile.DOCUMENT_TYPES.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  const mimeType = MIME_TYPES[normalizedFormat] || 'application/octet-stream';
  const courseCode = offering.course?.courseCode || 'COURSE';
  const section = offering.section || 'A';
  const cleanInstance = (instanceName || '').trim();

  // 2. Generate standard filename
  const filename = cleanInstance
    ? `${documentType}_${courseCode}_Sec${section}_${cleanInstance.replace(/\s+/g, '_')}.${normalizedFormat}`
    : `${documentType}_${courseCode}_Sec${section}.${normalizedFormat}`;

  // 3. Check for existing canonical / multi-instance record
  const query = {
    courseOffering: offering._id,
    documentType,
    fileFormat: normalizedFormat,
    instanceName: cleanInstance,
  };

  const existingRecord = await CourseFile.findOne(query);

  // 4. Upload buffer to Google Drive (in-place update if existing, or fresh creation)
  const uploadResult = await driveService.uploadDocumentBuffer({
    buffer,
    filename,
    mimeType,
    folderId: googleDriveConfig.DESTINATION_FOLDER_ID,
    existingFileId: existingRecord ? existingRecord.googleDriveFileId : null,
  });

  // 5. Persist CourseFile metadata in MongoDB with concurrency reconciliation
  let courseFile;
  if (existingRecord) {
    existingRecord.googleDriveFileId = uploadResult.fileId;
    existingRecord.googleDriveFolderId = googleDriveConfig.DESTINATION_FOLDER_ID;
    existingRecord.googleDriveWebViewLink = uploadResult.webViewLink;
    existingRecord.googleDriveWebContentLink = uploadResult.webContentLink;
    existingRecord.filename = uploadResult.name;
    existingRecord.mimeType = uploadResult.mimeType;
    existingRecord.sizeBytes = uploadResult.sizeBytes;
    existingRecord.version += 1;
    existingRecord.uploadedBy = user._id;
    existingRecord.status = 'synced';
    try {
      courseFile = await existingRecord.save();
    } catch (saveErr) {
      saveErr.driveFileId = uploadResult.fileId;
      saveErr.driveFileName = uploadResult.name;
      console.error(
        `CRITICAL: File updated in Google Drive (${uploadResult.fileId}) but CourseFile database update failed: ${saveErr.message}`
      );
      throw saveErr;
    }
  } else {
    try {
      courseFile = await CourseFile.create({
        courseOffering: offering._id,
        course: offering.course._id,
        faculty: offering.faculty._id,
        semester: offering.semester._id,
        section: offering.section || 'A',
        documentType,
        fileFormat: normalizedFormat,
        filename: uploadResult.name,
        googleDriveFileId: uploadResult.fileId,
        googleDriveFolderId: googleDriveConfig.DESTINATION_FOLDER_ID,
        googleDriveWebViewLink: uploadResult.webViewLink,
        googleDriveWebContentLink: uploadResult.webContentLink,
        mimeType: uploadResult.mimeType,
        sizeBytes: uploadResult.sizeBytes,
        version: 1,
        isCanonical: !cleanInstance,
        instanceName: cleanInstance,
        status: 'synced',
        uploadedBy: user._id,
      });
    } catch (createErr) {
      // Concurrency race: another request created the record between findOne and create
      if (createErr.code === 11000) {
        console.warn(
          `Concurrent insert detected for offering ${offering._id} (${documentType}). Reconciling with existing record.`
        );
        const concurrentRecord = await CourseFile.findOne(query);
        if (concurrentRecord) {
          concurrentRecord.googleDriveFileId = uploadResult.fileId;
          concurrentRecord.googleDriveFolderId = googleDriveConfig.DESTINATION_FOLDER_ID;
          concurrentRecord.googleDriveWebViewLink = uploadResult.webViewLink;
          concurrentRecord.googleDriveWebContentLink = uploadResult.webContentLink;
          concurrentRecord.filename = uploadResult.name;
          concurrentRecord.mimeType = uploadResult.mimeType;
          concurrentRecord.sizeBytes = uploadResult.sizeBytes;
          concurrentRecord.version = (concurrentRecord.version || 1) + 1;
          concurrentRecord.uploadedBy = user._id;
          concurrentRecord.status = 'synced';
          courseFile = await concurrentRecord.save();
        } else {
          throw createErr;
        }
      } else {
        createErr.driveFileId = uploadResult.fileId;
        createErr.driveFileName = uploadResult.name;
        console.error(
          `CRITICAL: File uploaded to Google Drive (${uploadResult.fileId}) but CourseFile database creation failed: ${createErr.message}`
        );
        throw createErr;
      }
    }
  }

  // 6. Update CourseChecklist completion status only after successful persistence
  try {
    let checklist = await CourseChecklist.findOne({ courseOffering: offering._id });
    if (!checklist) {
      checklist = await CourseChecklist.findOne({
        course: offering.course._id,
        faculty: offering.faculty._id,
        semester: offering.semester._id,
        section: offering.section || 'A',
      });
    }

    if (checklist && Array.isArray(checklist.checklistItems)) {
      const item = checklist.checklistItems.find((i) => i.type === documentType);
      if (item && !item.completed) {
        item.completed = true;
        await checklist.save();
      }
    }
  } catch (err) {
    console.warn(`Could not update checklist status for ${documentType}:`, err.message);
  }

  return courseFile;
};

/**
 * Generates the Course Information Sheet (CIS) from saved form data and uploads it to Google Drive.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {string} [params.fileFormat='pdf'] - 'pdf' | 'docx'
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<Object>} Persisted CourseFile document
 */
const generateAndSyncCIS = async ({ offeringId, fileFormat = 'pdf', user }) => {
  // 1. Verify offering access
  const offering = await courseOfferingService.getOfferingById(offeringId, user);

  // 2. Locate saved CIS document
  let form = await CIS.findOne({ courseOffering: offering._id });
  if (!form) {
    // Fallback: search by course, faculty, semester
    form = await CIS.findOne({
      course: offering.course._id,
      faculty: offering.faculty._id,
      semester: offering.semester._id,
      formType: 'CIS',
    });
  }

  if (!form) {
    const error = new Error(
      'Course Information Sheet (CIS) form has not been saved for this course offering. Please fill and save the CIS form first.'
    );
    error.statusCode = 404;
    throw error;
  }

  // 3. Build export data structure expected by CIS generators
  const exportData = {
    courseInfo: {
      ...(form.courseSummary?.toObject ? form.courseSummary.toObject() : form.courseSummary || {}),
      ...(form.basicInfo?.toObject ? form.basicInfo.toObject() : form.basicInfo || {}),
      courseObjectives: form.courseObjectives,
      courseContents: form.courseContents,
    },
    alternateData: {
      cloTable: form.cloTable,
      textbooks: form.textbooks,
      obaTable: form.obaTable,
      gradingPolicy: form.gradingPolicy,
    },
    weeklyData: form.weeklyPlan,
  };

  // 4. Generate document buffer
  const normalizedFormat = fileFormat.toLowerCase() === 'docx' ? 'docx' : 'pdf';
  let buffer;

  if (normalizedFormat === 'docx') {
    buffer = await cisWordService.generateCISWord(exportData);
  } else {
    buffer = await cisPdfService.generateCISPDF(exportData);
  }

  // 5. Delegate to generic offering synchronizer
  return await module.exports.syncOfferingDocument({
    offeringId: offering._id,
    documentType: 'CIS',
    fileFormat: normalizedFormat,
    instanceName: '',
    buffer,
    user,
  });
};

/**
 * Lists all course files associated with a CourseOffering.
 *
 * @param {string} offeringId - CourseOffering ID
 * @param {Object} user - Authenticated user
 * @returns {Promise<Array<Object>>}
 */
const listOfferingFiles = async (offeringId, user) => {
  await courseOfferingService.getOfferingById(offeringId, user);

  return CourseFile.find({ courseOffering: offeringId })
    .populate('uploadedBy', 'name email designation')
    .sort({ documentType: 1, createdAt: -1 });
};

/**
 * Retrieves a CourseFile record by ID with authorization checks.
 *
 * @param {string} fileId - CourseFile ObjectId string
 * @param {Object} user - Authenticated user
 * @returns {Promise<Object>}
 */
const getCourseFileById = async (fileId, user) => {
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    const error = new Error('Invalid CourseFile ID.');
    error.statusCode = 400;
    throw error;
  }

  const courseFile = await CourseFile.findById(fileId).populate('courseOffering');
  if (!courseFile) {
    const error = new Error('Course file record not found.');
    error.statusCode = 404;
    throw error;
  }

  // Authorize against offering
  const offeringId = courseFile.courseOffering?._id || courseFile.courseOffering;
  if (!offeringId) {
    const error = new Error('Course offering associated with this file no longer exists.');
    error.statusCode = 404;
    throw error;
  }
  await courseOfferingService.getOfferingById(offeringId, user);

  return courseFile;
};

/**
 * Retrieves readable file stream from Google Drive for an authorized user.
 *
 * @param {string} fileId - CourseFile ObjectId
 * @param {Object} user - Authenticated user
 * @returns {Promise<{ stream: import('stream').Readable, courseFile: Object }>}
 */
const downloadCourseFile = async (fileId, user) => {
  const courseFile = await module.exports.getCourseFileById(fileId, user);
  const stream = await driveService.getFileStream(courseFile.googleDriveFileId);

  return { stream, courseFile };
};

module.exports = {
  syncOfferingDocument,
  generateAndSyncCIS,
  listOfferingFiles,
  getCourseFileById,
  downloadCourseFile,
  MIME_TYPES,
};
