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
const CCR = require('../models/CCR.model');
const ccrWordService = require('./documentService/generateCCRWord');
const ccrPdfService = require('./documentService/generateCCRPDF');
const { Timetable } = require('../models/Timetable.model');
const timetableWordService = require('./documentService/generateTimetableWord');
const timetablePdfService = require('./documentService/generateTimetablePDF');
const Quiz = require('../models/Quiz.model');
const Assignment = require('../models/Assignment.model');
const quizWordService = require('./documentService/generateQuizWord');
const assignmentWordService = require('./documentService/generateAssignmentWord');
const quizPdfService = require('./documentService/generateQuizPDF');
const assignmentPdfService = require('./documentService/generateAssignmentPDF');
const CCP = require('../models/CCP.model');
const CCC = require('../models/CCC.model');
const CourseReviewReport = require('../models/CRR.model');
const CourseOffering = require('../models/CourseOffering.model');
const ccpPdfService = require('./documentService/generateCCPPDF');
const cccPdfService = require('./documentService/generateCCCPDF');
const crrPdfService = require('./documentService/generateCRRPDF');


/**
 * Maps common file extensions to standard MIME types.
 */
const MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  other: 'application/octet-stream',
};

const ALLOWED_LECTURE_FORMATS = ['ppt', 'pptx', 'pdf', 'doc', 'docx'];
const MAX_LECTURE_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXAM_FORMATS = ['pdf', 'doc', 'docx'];
const MAX_EXAM_FILE_SIZE = 25 * 1024 * 1024; // 25 MB


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

  const plainForm = form.toObject ? form.toObject() : form;

  // 3. Build export data structure expected by CIS generators
  const exportData = {
    courseInfo: {
      ...(plainForm.courseSummary || {}),
      ...(plainForm.basicInfo || {}),
      courseObjectives: plainForm.courseObjectives,
      courseContents: plainForm.courseContents,
    },
    alternateData: {
      cloTable: plainForm.cloTable || [],
      textbooks: plainForm.textbooks || [],
      obaTable: plainForm.obaTable || [],
      gradingPolicy: plainForm.gradingPolicy || {},
    },
    weeklyData: plainForm.weeklyPlan || [],
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
 * Generates the Course Control Report (CCR) from saved form data and uploads it to Google Drive.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {string} [params.fileFormat='pdf'] - 'pdf' | 'docx'
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<Object>} Persisted CourseFile document
 */
const generateAndSyncCCR = async ({ offeringId, fileFormat = 'pdf', user }) => {
  // 1. Verify offering access & authorization
  const offering = await courseOfferingService.getOfferingById(offeringId, user);

  // 2. Validate requested file format (pdf or docx)
  const rawFormat = (fileFormat || 'pdf').toLowerCase().trim();
  if (rawFormat !== 'pdf' && rawFormat !== 'docx') {
    const error = new Error(`Invalid file format: '${fileFormat}'. Supported formats: pdf, docx`);
    error.statusCode = 400;
    throw error;
  }
  const normalizedFormat = rawFormat;

  // 3. Locate saved CCR document (prefer courseOffering, fallback to course/faculty/semester/section)
  let form = await CCR.findOne({ courseOffering: offering._id });
  if (!form) {
    form = await CCR.findOne({
      course: offering.course._id || offering.course,
      faculty: offering.faculty._id || offering.faculty,
      semester: offering.semester._id || offering.semester,
      section: offering.section || 'A',
      formType: 'CCR',
    });
  }

  if (!form) {
    const error = new Error(
      'Course Control Report (CCR) form has not been saved for this course offering. Please fill and save the CCR form first.'
    );
    error.statusCode = 404;
    throw error;
  }

  const plainForm = form.toObject ? form.toObject() : form;

  // 4. Build export data structure expected by CCR generators
  const exportData = {
    courseInfo: plainForm.courseInfo || {},
    weeklyData: plainForm.weeklyData || [],
    alternateData: plainForm.alternateData || [],
  };

  // 5. Generate document buffer
  let buffer;
  try {
    if (normalizedFormat === 'docx') {
      buffer = await ccrWordService.generateCCRWord(exportData);
    } else {
      buffer = await ccrPdfService.generateCCRPDF(exportData);
    }
  } catch (genErr) {
    console.error(`CCR ${normalizedFormat.toUpperCase()} generation failed:`, genErr);
    const error = new Error(
      `Failed to generate Course Control Report (${normalizedFormat.toUpperCase()}): ${genErr.message}`
    );
    error.statusCode = 500;
    throw error;
  }

  // 6. Delegate to generic offering synchronizer
  return await module.exports.syncOfferingDocument({
    offeringId: offering._id,
    documentType: 'CCR',
    fileFormat: normalizedFormat,
    instanceName: '',
    buffer,
    user,
  });
};

/**
 * Generates and synchronizes the Timetable with Consulting Hours to Google Drive.
 *
 * Scoping:
 * The timetable is shared by a faculty member across their offerings for a semester.
 * Timetable data is stored in the database scoped strictly to { faculty, semester }
 * and does NOT store courseOffering. However, each sync operation is authorized
 * against the requested offering, uses that offering's metadata/filename, and marks
 * the offering's checklist item as completed.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {string} [params.fileFormat='pdf'] - 'pdf' | 'docx'
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<Object>} Persisted CourseFile document
 */
const generateAndSyncTimetable = async ({ offeringId, fileFormat = 'pdf', user }) => {
  // 1. Validate requested file format (pdf or docx)
  const rawFormat = (fileFormat || 'pdf').toLowerCase().trim();
  if (rawFormat !== 'pdf' && rawFormat !== 'docx') {
    const error = new Error(`Invalid file format: '${fileFormat}'. Supported formats: pdf, docx`);
    error.statusCode = 400;
    throw error;
  }
  const normalizedFormat = rawFormat;

  // 2. Verify offering access & authorization
  const offering = await courseOfferingService.getOfferingById(offeringId, user);

  // 3. Resolve faculty and semester from authorized offering
  const facultyId = offering.faculty?._id || offering.faculty;
  const semesterId = offering.semester?._id || offering.semester;

  // 4. Retrieve saved timetable strictly using faculty and semester
  let query = Timetable.findOne({
    faculty: facultyId,
    semester: semesterId,
  });

  if (query && typeof query.populate === 'function') {
    query = query.populate('semester', 'name status');
  }
  if (query && typeof query.lean === 'function') {
    query = query.lean();
  }

  const rawTimetable = await query;
  const timetable = rawTimetable && typeof rawTimetable.toObject === 'function'
    ? rawTimetable.toObject()
    : rawTimetable;

  // 5. Reject if no saved timetable exists
  if (!timetable) {
    const error = new Error(
      'Class Schedule and Counseling Hours (Timetable) has not been saved for this faculty member in this semester. Please configure and save the timetable first.'
    );
    error.statusCode = 404;
    throw error;
  }

  // 6. Generate document buffer
  let buffer;
  try {
    if (normalizedFormat === 'docx') {
      buffer = await timetableWordService.generateTimetableWord(timetable);
    } else {
      buffer = await timetablePdfService.generateTimetablePDF(timetable);
    }
  } catch (genErr) {
    console.error(`Timetable ${normalizedFormat.toUpperCase()} generation failed:`, genErr);
    const error = new Error(
      `Failed to generate Timetable (${normalizedFormat.toUpperCase()}): ${genErr.message}`
    );
    error.statusCode = 500;
    throw error;
  }

  // 7. Delegate to generic offering synchronizer
  return await module.exports.syncOfferingDocument({
    offeringId: offering._id,
    documentType: 'TIMETABLE',
    fileFormat: normalizedFormat,
    instanceName: '',
    buffer,
    user,
  });
};

/**
 * Generates the CCP / Class Project document from saved form data and synchronizes it to Google Drive as PDF.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<Object>} Persisted CourseFile document
 */
const generateAndSyncProject = async ({ offeringId, user }) => {
  // 1. Authorize offering access
  const offering = await courseOfferingService.getOfferingById(offeringId, user);

  // 2. Retrieve saved CCP document for this offering (or link legacy record)
  let form = await CCP.findOne({ courseOffering: offering._id, formType: 'ASSESS_PROJECT' });
  if (!form) {
    form = await CCP.findOne({
      courseOffering: null,
      course: offering.course._id || offering.course,
      faculty: offering.faculty._id || offering.faculty,
      semester: offering.semester._id || offering.semester,
      section: offering.section || 'A',
      formType: 'ASSESS_PROJECT',
    });
  }
  if (!form) {
    const offeringCount = await CourseOffering.countDocuments({
      course: offering.course._id || offering.course,
      faculty: offering.faculty._id || offering.faculty,
    });
    if (offeringCount === 1) {
      form = await CCP.findOne({
        courseOffering: null,
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: null,
        formType: 'ASSESS_PROJECT',
      });
    }
  }

  if (form && !form.courseOffering) {
    form.courseOffering = offering._id;
    if (!form.section) form.section = offering.section || 'A';
    if (!form.semester) form.semester = offering.semester._id || offering.semester;
    await form.save();
  }

  if (!form) {
    const error = new Error(
      'Complex Computing Problem (CCP) / Class Project form has not been saved for this course offering. Please fill and save the Class Project form first.'
    );
    error.statusCode = 404;
    throw error;
  }

  // 3. Prepare payload expected by generateCCPPDF
  const exportData = {
    headerInfo: form.headerInfo?.toObject ? form.headerInfo.toObject() : form.headerInfo || {},
    mappingTable: form.mappingTable?.toObject ? form.mappingTable.toObject() : form.mappingTable || {},
    problemStatement: form.problemStatement || '',
    constraintsAssumptions: form.constraintsAssumptions || '',
    computationalTools: form.computationalTools || '',
    expectedOutcomes: form.expectedOutcomes || '',
    deliverables: form.deliverables?.toObject ? form.deliverables.toObject() : form.deliverables || {},
    wpAttributes: form.wpAttributes?.toObject ? form.wpAttributes.toObject() : form.wpAttributes || [],
  };

  // 4. In-memory PDF generation
  let buffer;
  try {
    buffer = await ccpPdfService.generateCCPPDF(exportData);
  } catch (genErr) {
    console.error('CCP PDF generation failed:', genErr);
    const error = new Error(`Failed to generate Class Project PDF document: ${genErr.message}`);
    error.statusCode = 500;
    throw error;
  }

  // 5. Delegate to generic offering synchronizer (uploads into offering root folder with canonical name)
  return await module.exports.syncOfferingDocument({
    offeringId: offering._id,
    documentType: 'ASSESS_PROJECT',
    fileFormat: 'pdf',
    instanceName: '',
    buffer,
    user,
  });
};

/**
 * Generates the Course Completion Certificate (CCC) from saved form data and synchronizes it to Google Drive as PDF.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<Object>} Persisted CourseFile document
 */
const generateAndSyncCCC = async ({ offeringId, user }) => {
  // 1. Authorize offering access
  const offering = await courseOfferingService.getOfferingById(offeringId, user);

  // 2. Retrieve saved CCC document for this offering
  let form = await CCC.findOne({ courseOffering: offering._id, formType: 'CCC' });
  if (!form) {
    form = await CCC.findOne({
      courseOffering: null,
      course: offering.course._id || offering.course,
      faculty: offering.faculty._id || offering.faculty,
      semester: offering.semester._id || offering.semester,
      section: offering.section || 'A',
      formType: 'CCC',
    });
  }
  if (!form) {
    const offeringCount = await CourseOffering.countDocuments({
      course: offering.course._id || offering.course,
      faculty: offering.faculty._id || offering.faculty,
    });
    if (offeringCount === 1) {
      form = await CCC.findOne({
        courseOffering: null,
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: null,
        formType: 'CCC',
      });
    }
  }

  if (form && !form.courseOffering) {
    form.courseOffering = offering._id;
    if (!form.section) form.section = offering.section || 'A';
    if (!form.semester) form.semester = offering.semester._id || offering.semester;
    await form.save();
  }

  if (!form) {
    const error = new Error(
      'Course Completion Certificate (CCC) has not been saved for this course offering. Please fill and save the CCC form first.'
    );
    error.statusCode = 404;
    throw error;
  }

  // 3. Prepare payload expected by generateCCCPDF
  const exportData = {
    courseInfo: form.courseInfo?.toObject ? form.courseInfo.toObject() : form.courseInfo || {},
    certificateData: form.certificateData?.toObject ? form.certificateData.toObject() : form.certificateData || {},
  };

  // 4. In-memory PDF generation
  let buffer;
  try {
    buffer = await cccPdfService.generateCCCPDF(exportData);
  } catch (genErr) {
    console.error('CCC PDF generation failed:', genErr);
    const error = new Error(`Failed to generate Course Completion Certificate PDF: ${genErr.message}`);
    error.statusCode = 500;
    throw error;
  }

  // 5. Delegate to generic offering synchronizer
  return await module.exports.syncOfferingDocument({
    offeringId: offering._id,
    documentType: 'CCC',
    fileFormat: 'pdf',
    instanceName: '',
    buffer,
    user,
  });
};

/**
 * Generates the Course Review Report (CRR) from saved form data and synchronizes it to Google Drive as PDF.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<Object>} Persisted CourseFile document
 */
const generateAndSyncCRR = async ({ offeringId, user }) => {
  // 1. Authorize offering access
  const offering = await courseOfferingService.getOfferingById(offeringId, user);

  // 2. Retrieve saved CRR document for this offering
  let form = await CourseReviewReport.findOne({ courseOffering: offering._id, formType: 'CRR' });
  if (!form) {
    form = await CourseReviewReport.findOne({
      courseOffering: null,
      course: offering.course._id || offering.course,
      faculty: offering.faculty._id || offering.faculty,
      semester: offering.semester._id || offering.semester,
      section: offering.section || 'A',
      formType: 'CRR',
    });
  }
  if (!form) {
    const offeringCount = await CourseOffering.countDocuments({
      course: offering.course._id || offering.course,
      faculty: offering.faculty._id || offering.faculty,
    });
    if (offeringCount === 1) {
      form = await CourseReviewReport.findOne({
        courseOffering: null,
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: null,
        formType: 'CRR',
      });
    }
  }

  if (form && !form.courseOffering) {
    form.courseOffering = offering._id;
    if (!form.section) form.section = offering.section || 'A';
    if (!form.semester) form.semester = offering.semester._id || offering.semester;
    await form.save();
  }

  if (!form) {
    const error = new Error(
      'Course Review Report (CRR) has not been saved for this course offering. Please fill and save the CRR form first.'
    );
    error.statusCode = 404;
    throw error;
  }

  // 3. Prepare payload expected by generateCRRPDF
  const exportData = {
    courseInfo: form.courseInfo?.toObject ? form.courseInfo.toObject() : form.courseInfo || {},
    assessmentSummary: form.assessmentSummary?.toObject ? form.assessmentSummary.toObject() : form.assessmentSummary || [],
    gradeSummary: form.gradeSummary?.toObject ? form.gradeSummary.toObject() : form.gradeSummary || {},
    courseLearningOutcomes: form.courseLearningOutcomes?.toObject ? form.courseLearningOutcomes.toObject() : form.courseLearningOutcomes || {},
    courseEnhancement: form.courseEnhancement?.toObject ? form.courseEnhancement.toObject() : form.courseEnhancement || {},
    signatureInfo: form.signatureInfo?.toObject ? form.signatureInfo.toObject() : form.signatureInfo || {},
  };

  // 4. In-memory PDF generation
  let buffer;
  try {
    buffer = await crrPdfService.generateCRRPDF(exportData);
  } catch (genErr) {
    console.error('CRR PDF generation failed:', genErr);
    const error = new Error(`Failed to generate Course Review Report PDF: ${genErr.message}`);
    error.statusCode = 500;
    throw error;
  }

  // 5. Delegate to generic offering synchronizer
  return await module.exports.syncOfferingDocument({
    offeringId: offering._id,
    documentType: 'CRR',
    fileFormat: 'pdf',
    instanceName: '',
    buffer,
    user,
  });
};


/**
 * Resolves or creates an offering-scoped Lectures folder in Google Drive.
 *
 * @param {Object} offering
 * @returns {Promise<string>} Folder ID
 */
const getLecturesFolderForOffering = async (offering) => {
  const courseCode = offering.course?.courseCode || 'COURSE';
  const section = offering.section || 'A';
  const folderName = `${courseCode}_Sec${section}_Lectures`;
  try {
    return await driveService.getOrCreateFolder(
      folderName,
      googleDriveConfig.DESTINATION_FOLDER_ID
    );
  } catch (err) {
    console.warn(`Could not resolve Lectures subfolder '${folderName}':`, err.message);
    return googleDriveConfig.DESTINATION_FOLDER_ID;
  }
};

/**
 * Resolves or creates an offering-scoped Quizzes folder in Google Drive.
 *
 * @param {Object} offering
 * @returns {Promise<string>} Folder ID
 */
const getQuizzesFolderForOffering = async (offering) => {
  const courseCode = offering.course?.courseCode || 'COURSE';
  const section = offering.section || 'A';
  const folderName = `${courseCode}_Sec${section}_Quizzes`;
  try {
    return await driveService.getOrCreateFolder(
      folderName,
      googleDriveConfig.DESTINATION_FOLDER_ID
    );
  } catch (err) {
    console.warn(`Could not resolve Quizzes subfolder '${folderName}':`, err.message);
    return googleDriveConfig.DESTINATION_FOLDER_ID;
  }
};

/**
 * Resolves or creates an offering-scoped Assignments folder in Google Drive.
 *
 * @param {Object} offering
 * @returns {Promise<string>} Folder ID
 */
const getAssignmentsFolderForOffering = async (offering) => {
  const courseCode = offering.course?.courseCode || 'COURSE';
  const section = offering.section || 'A';
  const folderName = `${courseCode}_Sec${section}_Assignments`;
  try {
    return await driveService.getOrCreateFolder(
      folderName,
      googleDriveConfig.DESTINATION_FOLDER_ID
    );
  } catch (err) {
    console.warn(`Could not resolve Assignments subfolder '${folderName}':`, err.message);
    return googleDriveConfig.DESTINATION_FOLDER_ID;
  }
};

/**
 * Resolves or creates an offering-scoped Midterm folder in Google Drive.
 * Name: `${courseCode}_Sec${section}_Midterm`
 *
 * @param {Object} offering
 * @returns {Promise<string>} Folder ID
 */
const getMidtermFolderForOffering = async (offering) => {
  const courseCode = offering.course?.courseCode || 'COURSE';
  const section = offering.section || 'A';
  const folderName = `${courseCode}_Sec${section}_Midterm`;
  try {
    return await driveService.getOrCreateFolder(
      folderName,
      googleDriveConfig.DESTINATION_FOLDER_ID
    );
  } catch (err) {
    console.warn(`Could not resolve Midterm subfolder '${folderName}':`, err.message);
    return googleDriveConfig.DESTINATION_FOLDER_ID;
  }
};

/**
 * Resolves or creates an offering-scoped Final folder in Google Drive.
 * Name: `${courseCode}_Sec${section}_Final`
 *
 * @param {Object} offering
 * @returns {Promise<string>} Folder ID
 */
const getFinalFolderForOffering = async (offering) => {
  const courseCode = offering.course?.courseCode || 'COURSE';
  const section = offering.section || 'A';
  const folderName = `${courseCode}_Sec${section}_Final`;
  try {
    return await driveService.getOrCreateFolder(
      folderName,
      googleDriveConfig.DESTINATION_FOLDER_ID
    );
  } catch (err) {
    console.warn(`Could not resolve Final subfolder '${folderName}':`, err.message);
    return googleDriveConfig.DESTINATION_FOLDER_ID;
  }
};

/**
 * Uploads a single lecture material file to Google Drive and creates CourseFile metadata.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {Object} params.file - Multer file object ({ originalname, buffer, size, mimetype })
 * @param {Object} params.user - Authenticated user
 * @param {Object} [params.offering] - Pre-authorized offering object (optional)
 * @returns {Promise<Object>} Created CourseFile document
 */
const uploadLectureFile = async ({ offeringId, file, user, offering = null }) => {
  if (!file || !file.buffer || !Buffer.isBuffer(file.buffer)) {
    const error = new Error('A valid file Buffer is required for lecture upload.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Authorize offering access
  const authorizedOffering =
    offering || (await courseOfferingService.getOfferingById(offeringId, user));

  // 2. Validate file size (25 MB limit)
  const fileSize = file.size || file.buffer.length;
  if (fileSize > MAX_LECTURE_FILE_SIZE) {
    const error = new Error(
      `File '${file.originalname}' exceeds the maximum allowed size of 25 MB.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate file extension
  const rawFilename = file.originalname || 'lecture_document';
  const ext = rawFilename.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_LECTURE_FORMATS.includes(ext)) {
    const error = new Error(
      `Unsupported file format: '.${ext}'. Supported formats for lectures: .ppt, .pptx, .pdf, .doc, .docx`
    );
    error.statusCode = 400;
    throw error;
  }

  // 4. Duplicate prevention for this offering
  const safeFilename = rawFilename.trim();
  const existingFile = await CourseFile.findOne({
    courseOffering: authorizedOffering._id,
    documentType: 'LECTURES',
    filename: safeFilename,
  });

  if (existingFile) {
    const error = new Error(
      `A lecture file named "${safeFilename}" already exists for this course offering. Please delete the existing file or rename the file.`
    );
    error.statusCode = 400;
    throw error;
  }

  const mimeType = MIME_TYPES[ext] || file.mimetype || 'application/octet-stream';

  // 5. Resolve Drive destination folder (offering-specific Lectures subfolder or destination folder)
  const folderId = await module.exports.getLecturesFolderForOffering(authorizedOffering);

  // 6. Upload file buffer to Google Drive
  let uploadResult;
  try {
    uploadResult = await driveService.uploadDocumentBuffer({
      buffer: file.buffer,
      filename: safeFilename,
      mimeType,
      folderId,
    });
  } catch (driveErr) {
    const error = new Error(`Google Drive upload failed: ${driveErr.message}`);
    error.statusCode = 500;
    throw error;
  }

  // 7. Persist CourseFile record in MongoDB
  let courseFile;
  try {
    courseFile = await CourseFile.create({
      courseOffering: authorizedOffering._id,
      course: authorizedOffering.course._id || authorizedOffering.course,
      faculty: authorizedOffering.faculty._id || authorizedOffering.faculty,
      semester: authorizedOffering.semester._id || authorizedOffering.semester,
      section: authorizedOffering.section || 'A',
      documentType: 'LECTURES',
      fileFormat: ext,
      filename: safeFilename,
      googleDriveFileId: uploadResult.fileId,
      googleDriveFolderId: folderId,
      googleDriveWebViewLink: uploadResult.webViewLink,
      googleDriveWebContentLink: uploadResult.webContentLink,
      mimeType: uploadResult.mimeType || mimeType,
      sizeBytes: uploadResult.sizeBytes || fileSize,
      version: 1,
      isCanonical: false,
      instanceName: safeFilename,
      status: 'synced',
      uploadedBy: user._id,
    });
  } catch (createErr) {
    createErr.driveFileId = uploadResult.fileId;
    createErr.driveFileName = uploadResult.name;
    console.error(
      `CRITICAL: File uploaded to Google Drive (${uploadResult.fileId}) but CourseFile database creation failed: ${createErr.message}`
    );
    try {
      await driveService.deleteFile(uploadResult.fileId);
    } catch (cleanupErr) {
      console.warn(`Could not clean up orphaned Drive file ${uploadResult.fileId}: ${cleanupErr.message}`);
    }
    const error = new Error(`Failed to save lecture file metadata: ${createErr.message}`);
    error.statusCode = 500;
    throw error;
  }

  // 8. Update CourseChecklist completion status for LECTURES
  try {
    let checklist = await CourseChecklist.findOne({ courseOffering: authorizedOffering._id });
    if (!checklist) {
      checklist = await CourseChecklist.findOne({
        course: authorizedOffering.course._id || authorizedOffering.course,
        faculty: authorizedOffering.faculty._id || authorizedOffering.faculty,
        semester: authorizedOffering.semester._id || authorizedOffering.semester,
        section: authorizedOffering.section || 'A',
      });
    }

    if (checklist && Array.isArray(checklist.checklistItems)) {
      const item = checklist.checklistItems.find((i) => i.type === 'LECTURES');
      if (item && !item.completed) {
        item.completed = true;
        await checklist.save();
      }
    }
  } catch (err) {
    console.warn('Could not update checklist status for LECTURES:', err.message);
  }

  return courseFile;
};

/**
 * Uploads multiple lecture material files for a CourseOffering.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {Array<Object>} params.files - Array of Multer file objects
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<Array<Object>>} Array of created CourseFile records
 */
const uploadLectureFiles = async ({ offeringId, files, user }) => {
  if (!files || !Array.isArray(files) || files.length === 0) {
    const error = new Error('At least one file is required for lecture upload.');
    error.statusCode = 400;
    throw error;
  }

  // Pre-authorize offering once
  const offering = await courseOfferingService.getOfferingById(offeringId, user);

  const results = [];
  for (const file of files) {
    const record = await module.exports.uploadLectureFile({
      offeringId,
      file,
      user,
      offering,
    });
    results.push(record);
  }

  return results;
};

/**
 * Updates CourseChecklist completion status for Midterm (ASSESS_MID) or Final Exam (ASSESS_FINAL).
 * Requires all 4 distinct document categories uploaded with status 'synced' to mark complete.
 * Independent 0/4, 1-3/4 (incomplete), and 4/4 (completed) calculations.
 *
 * @param {string} offeringId
 * @param {string} documentType - Any of the 8 exam document types
 */
const updateExamChecklistStatus = async (offeringId, documentType) => {
  const isMidterm = CourseFile.MIDTERM_DOCUMENT_TYPES.includes(documentType) || documentType === 'ASSESS_MID';
  const isFinal = CourseFile.FINAL_DOCUMENT_TYPES.includes(documentType) || documentType === 'ASSESS_FINAL';
  if (!isMidterm && !isFinal) return;

  const targetTypes = isMidterm ? CourseFile.MIDTERM_DOCUMENT_TYPES : CourseFile.FINAL_DOCUMENT_TYPES;
  const checklistType = isMidterm ? 'ASSESS_MID' : 'ASSESS_FINAL';

  try {
    // Count distinct synced categories present for this offering
    const distinctTypes = await CourseFile.distinct('documentType', {
      courseOffering: offeringId,
      documentType: { $in: targetTypes },
      status: 'synced',
    });

    const isAllUploaded = distinctTypes.length === 4;

    let checklist = await CourseChecklist.findOne({ courseOffering: offeringId });
    if (!checklist) {
      const offering = await courseOfferingService.getOfferingById(offeringId).catch(() => null);
      if (offering) {
        checklist = await CourseChecklist.findOne({
          course: offering.course?._id || offering.course,
          faculty: offering.faculty?._id || offering.faculty,
          semester: offering.semester?._id || offering.semester,
          section: offering.section || 'A',
        });
      }
    }

    if (checklist && Array.isArray(checklist.checklistItems)) {
      const item = checklist.checklistItems.find((i) => i.type === checklistType);
      if (item && item.completed !== isAllUploaded) {
        item.completed = isAllUploaded;
        await checklist.save();
      }
    }
  } catch (err) {
    console.warn(`Could not update checklist status for ${checklistType}:`, err.message);
  }
};

/**
 * Uploads or replaces an exam document (Midterm or Final) in Google Drive and manages CourseFile record.
 *
 * Enforces:
 *  - Offering authorization (Faculty assigned / HoD dept / Dean global)
 *  - 25 MB max file size
 *  - PDF, DOC, and DOCX formats only
 *  - Offering-specific destination subfolder:
 *      `${courseCode}_Sec${section}_Midterm` or `${courseCode}_Sec${section}_Final`
 *  - In-place Drive file update when replacing (no duplicate files created in Drive)
 *  - Re-creation in Drive if the existing file was deleted (404 recovery)
 *  - Preserves original filename where practical
 *  - Independent completion tracking for Midterm and Final
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {string} params.documentType - One of CourseFile.EXAM_DOCUMENT_TYPES
 * @param {Object} params.file - Multer file object ({ originalname, buffer, size, mimetype })
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<Object>} Persisted CourseFile document
 */
const uploadExamDocument = async ({ offeringId, documentType, file, user }) => {
  if (!offeringId) {
    const error = new Error('Course offering ID is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!documentType || !CourseFile.EXAM_DOCUMENT_TYPES.includes(documentType)) {
    const error = new Error(
      `Invalid exam document type: '${documentType}'. Must be one of: ${CourseFile.EXAM_DOCUMENT_TYPES.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (!file || !file.buffer || !Buffer.isBuffer(file.buffer)) {
    const error = new Error('A valid file Buffer is required for document upload.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Authorize offering access
  const authorizedOffering = await courseOfferingService.getOfferingById(offeringId, user);

  // 2. Validate file size (25 MB limit)
  const fileSize = file.size || file.buffer.length;
  if (fileSize > MAX_EXAM_FILE_SIZE) {
    const error = new Error(
      `File '${file.originalname}' exceeds the maximum allowed size of 25 MB.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate file extension (.pdf, .doc, .docx)
  const rawFilename = (file.originalname || 'exam_document').trim();
  const ext = rawFilename.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXAM_FORMATS.includes(ext)) {
    const error = new Error(
      `Unsupported file format: '.${ext}'. Only PDF (.pdf), Microsoft Word (.doc), and Microsoft Word (.docx) files are supported.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate MIME type
  const clientMime = (file.mimetype || '').toLowerCase();
  const validMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/x-msword',
    'application/octet-stream',
  ];
  if (clientMime && !validMimes.includes(clientMime)) {
    const error = new Error(
      `Invalid MIME type: '${file.mimetype}'. Only PDF and Microsoft Word documents are supported.`
    );
    error.statusCode = 400;
    throw error;
  }

  const safeFilename = rawFilename;
  const isMidterm = CourseFile.MIDTERM_DOCUMENT_TYPES.includes(documentType);
  const folderId = isMidterm
    ? await module.exports.getMidtermFolderForOffering(authorizedOffering)
    : await module.exports.getFinalFolderForOffering(authorizedOffering);

  const mimeType = MIME_TYPES[ext] || file.mimetype || 'application/octet-stream';

  // 5. Check for existing canonical record for this offering and category slot
  const query = {
    courseOffering: authorizedOffering._id,
    documentType,
  };
  const existingRecord = await CourseFile.findOne(query);

  // 6. Upload or in-place update in Google Drive
  let uploadResult;
  try {
    uploadResult = await driveService.uploadDocumentBuffer({
      buffer: file.buffer,
      filename: safeFilename,
      mimeType,
      folderId,
      existingFileId: existingRecord ? existingRecord.googleDriveFileId : null,
    });
  } catch (driveErr) {
    const error = new Error(`Google Drive upload failed: ${driveErr.message}`);
    error.statusCode = 500;
    throw error;
  }

  // 7. Persist or update CourseFile record in MongoDB
  let courseFile;
  if (existingRecord) {
    existingRecord.googleDriveFileId = uploadResult.fileId;
    existingRecord.googleDriveFolderId = folderId;
    existingRecord.googleDriveWebViewLink = uploadResult.webViewLink || existingRecord.googleDriveWebViewLink;
    existingRecord.googleDriveWebContentLink = uploadResult.webContentLink || existingRecord.googleDriveWebContentLink;
    existingRecord.filename = uploadResult.name || safeFilename;
    existingRecord.fileFormat = ext;
    existingRecord.mimeType = uploadResult.mimeType || mimeType;
    existingRecord.sizeBytes = uploadResult.sizeBytes || fileSize;
    existingRecord.version = (existingRecord.version || 1) + 1;
    existingRecord.uploadedBy = user._id;
    existingRecord.status = 'synced';
    try {
      courseFile = await existingRecord.save();
    } catch (saveErr) {
      saveErr.driveFileId = uploadResult.fileId;
      saveErr.driveFileName = uploadResult.name;
      console.error(
        `CRITICAL: Exam file updated in Google Drive (${uploadResult.fileId}) but CourseFile database update failed: ${saveErr.message}`
      );
      throw saveErr;
    }
  } else {
    try {
      courseFile = await CourseFile.create({
        courseOffering: authorizedOffering._id,
        course: authorizedOffering.course._id || authorizedOffering.course,
        faculty: authorizedOffering.faculty._id || authorizedOffering.faculty,
        semester: authorizedOffering.semester._id || authorizedOffering.semester,
        section: authorizedOffering.section || 'A',
        documentType,
        fileFormat: ext,
        filename: uploadResult.name || safeFilename,
        googleDriveFileId: uploadResult.fileId,
        googleDriveFolderId: folderId,
        googleDriveWebViewLink: uploadResult.webViewLink,
        googleDriveWebContentLink: uploadResult.webContentLink,
        mimeType: uploadResult.mimeType || mimeType,
        sizeBytes: uploadResult.sizeBytes || fileSize,
        version: 1,
        isCanonical: true,
        instanceName: '',
        status: 'synced',
        uploadedBy: user._id,
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        console.warn(
          `Concurrent insert detected for offering ${authorizedOffering._id} (${documentType}). Reconciling with existing record.`
        );
        const concurrentRecord = await CourseFile.findOne(query);
        if (concurrentRecord) {
          concurrentRecord.googleDriveFileId = uploadResult.fileId;
          concurrentRecord.googleDriveFolderId = folderId;
          concurrentRecord.googleDriveWebViewLink = uploadResult.webViewLink;
          concurrentRecord.googleDriveWebContentLink = uploadResult.webContentLink;
          concurrentRecord.filename = uploadResult.name || safeFilename;
          concurrentRecord.fileFormat = ext;
          concurrentRecord.mimeType = uploadResult.mimeType || mimeType;
          concurrentRecord.sizeBytes = uploadResult.sizeBytes || fileSize;
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
        try {
          await driveService.deleteFile(uploadResult.fileId);
        } catch (cleanupErr) {
          console.warn(`Could not clean up orphaned Drive file ${uploadResult.fileId}: ${cleanupErr.message}`);
        }
        const error = new Error(`Failed to save exam file metadata: ${createErr.message}`);
        error.statusCode = 500;
        throw error;
      }
    }
  }

  // 8. Update CourseChecklist completion status independently
  await module.exports.updateExamChecklistStatus(authorizedOffering._id, documentType);

  return courseFile;
};

/**
 * Deletes a course file from Google Drive and removes its database record.
 * If deleting a lecture file and no lecture files remain, sets checklist LECTURES completed to false.
 * If deleting an exam file, re-evaluates independent Midterm or Final completion status.
 *
 * @param {string} fileId - CourseFile ObjectId
 * @param {Object} user - Authenticated user
 * @returns {Promise<Object>} Deletion summary
 */
const deleteCourseFile = async (fileId, user) => {
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

  // 1. Delete from Google Drive
  if (courseFile.googleDriveFileId) {
    try {
      await driveService.deleteFile(courseFile.googleDriveFileId);
    } catch (driveErr) {
      console.warn(
        `Warning: Could not delete file ${courseFile.googleDriveFileId} from Google Drive: ${driveErr.message}`
      );
    }
  }

  // 2. Remove CourseFile record from MongoDB
  await CourseFile.findByIdAndDelete(fileId);

  let remainingLecturesCount = null;
  // 3. Update CourseChecklist if this was a lecture file and 0 lectures remain
  if (courseFile.documentType === 'LECTURES') {
    remainingLecturesCount = await CourseFile.countDocuments({
      courseOffering: offeringId,
      documentType: 'LECTURES',
      status: 'synced',
    });

    if (remainingLecturesCount === 0) {
      try {
        let checklist = await CourseChecklist.findOne({ courseOffering: offeringId });
        if (!checklist) {
          checklist = await CourseChecklist.findOne({
            course: courseFile.course?._id || courseFile.course,
            faculty: courseFile.faculty?._id || courseFile.faculty,
            semester: courseFile.semester?._id || courseFile.semester,
            section: courseFile.section || 'A',
          });
        }
        if (checklist && Array.isArray(checklist.checklistItems)) {
          const item = checklist.checklistItems.find((i) => i.type === 'LECTURES');
          if (item && item.completed) {
            item.completed = false;
            await checklist.save();
          }
        }
      } catch (err) {
        console.warn('Could not reset checklist status for LECTURES:', err.message);
      }
    }
  }

  // 4. Update CourseChecklist if this was an exam document
  if (CourseFile.EXAM_DOCUMENT_TYPES.includes(courseFile.documentType)) {
    await module.exports.updateExamChecklistStatus(offeringId, courseFile.documentType);
  }

  return {
    deleted: true,
    deletedFileId: fileId,
    filename: courseFile.filename,
    documentType: courseFile.documentType,
    ...(remainingLecturesCount !== null && { remainingLecturesCount }),
  };
};

/**
 * Lists course files associated with a CourseOffering, with optional documentType filtering.
 *
 * @param {string} offeringId - CourseOffering ID
 * @param {Object} user - Authenticated user
 * @param {string} [documentType] - Optional documentType filter (e.g. 'LECTURES')
 * @returns {Promise<Array<Object>>}
 */
const listOfferingFiles = async (offeringId, user, documentType = null) => {
  await courseOfferingService.getOfferingById(offeringId, user);

  const query = { courseOffering: offeringId };
  if (documentType) {
    query.documentType = documentType;
  }

  return CourseFile.find(query)
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
 * Generates and synchronizes a Quiz Word document (.docx) to Google Drive.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {string} params.quizId - Quiz ID
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<Object>} Persisted CourseFile document
 */
const generateAndSyncQuiz = async ({ offeringId, quizId, user }) => {
  if (!offeringId || !mongoose.Types.ObjectId.isValid(offeringId)) {
    const error = new Error('Invalid or missing CourseOffering ID.');
    error.statusCode = 400;
    throw error;
  }
  if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
    const error = new Error('Invalid or missing Quiz ID.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Authorize offering access
  const offering = await courseOfferingService.getOfferingById(offeringId, user);

  // 2. Retrieve quiz
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    const error = new Error('Quiz not found.');
    error.statusCode = 404;
    throw error;
  }

  // 3. Verify quiz belongs to offering and reject unassociated legacy assessments
  if (!quiz.courseOffering) {
    const error = new Error(
      'This quiz is not associated with a course offering. Please associate it with an offering before synchronizing to Google Drive.'
    );
    error.statusCode = 400;
    throw error;
  }

  if (quiz.courseOffering.toString() !== offering._id.toString()) {
    const error = new Error('This quiz belongs to a different course offering.');
    error.statusCode = 403;
    throw error;
  }

  // 4. Generate PDF buffer
  let buffer;
  try {
    buffer = await quizPdfService.generateQuizPDF(quiz);
  } catch (genErr) {
    console.error('Quiz PDF document generation failed:', genErr);
    const error = new Error(`Failed to generate Quiz PDF document: ${genErr.message}`);
    error.statusCode = 500;
    throw error;
  }

  // 5. Resolve Drive destination folder
  const folderId = await module.exports.getQuizzesFolderForOffering(offering);

  // 6. Generate filename
  const rawQuizNum = (quiz.quizInfo?.quizNumber || '1').toString().trim();
  const safeQuizNum = rawQuizNum.toLowerCase().startsWith('quiz')
    ? rawQuizNum.replace(/[^a-zA-Z0-9_-]/g, '_')
    : `Quiz_${rawQuizNum.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const courseCode = offering.course?.courseCode || 'COURSE';
  const section = offering.section || 'A';
  const filename = `ASSESS_QUIZ_${courseCode}_Sec${section}_${safeQuizNum}.pdf`;

  // 7. Check for existing CourseFile record for this quiz (specifically PDF format)
  const query = {
    courseOffering: offering._id,
    documentType: 'ASSESS_QUIZ',
    fileFormat: 'pdf',
    instanceName: quizId.toString(),
  };
  const existingRecord = await CourseFile.findOne(query);

  // 8. Upload to Google Drive (in-place update if existing, or fresh creation)
  const mimeType = MIME_TYPES.pdf;
  let uploadResult;
  try {
    uploadResult = await driveService.uploadDocumentBuffer({
      buffer,
      filename,
      mimeType,
      folderId,
      existingFileId: existingRecord ? existingRecord.googleDriveFileId : null,
    });
  } catch (driveErr) {
    const error = new Error(`Google Drive upload failed: ${driveErr.message}`);
    error.statusCode = 500;
    throw error;
  }

  // 9. Persist CourseFile metadata
  let courseFile;
  if (existingRecord) {
    existingRecord.googleDriveFileId = uploadResult.fileId;
    existingRecord.googleDriveFolderId = folderId;
    existingRecord.googleDriveWebViewLink = uploadResult.webViewLink;
    existingRecord.googleDriveWebContentLink = uploadResult.webContentLink;
    existingRecord.filename = uploadResult.name;
    existingRecord.fileFormat = 'pdf';
    existingRecord.mimeType = uploadResult.mimeType || mimeType;
    existingRecord.sizeBytes = uploadResult.sizeBytes || buffer.length;
    existingRecord.version = (existingRecord.version || 1) + 1;
    existingRecord.uploadedBy = user._id;
    existingRecord.status = 'synced';
    try {
      courseFile = await existingRecord.save();
    } catch (saveErr) {
      saveErr.driveFileId = uploadResult.fileId;
      saveErr.driveFileName = uploadResult.name;
      console.error(
        `CRITICAL: Quiz file updated in Google Drive (${uploadResult.fileId}) but CourseFile database update failed: ${saveErr.message}`
      );
      throw saveErr;
    }
  } else {
    try {
      courseFile = await CourseFile.create({
        courseOffering: offering._id,
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: offering.semester?._id || offering.semester,
        section: offering.section || 'A',
        documentType: 'ASSESS_QUIZ',
        fileFormat: 'pdf',
        filename: uploadResult.name,
        googleDriveFileId: uploadResult.fileId,
        googleDriveFolderId: folderId,
        googleDriveWebViewLink: uploadResult.webViewLink,
        googleDriveWebContentLink: uploadResult.webContentLink,
        mimeType: uploadResult.mimeType || mimeType,
        sizeBytes: uploadResult.sizeBytes || buffer.length,
        version: 1,
        isCanonical: false,
        instanceName: quizId.toString(),
        status: 'synced',
        uploadedBy: user._id,
      });
    } catch (createErr) {
      createErr.driveFileId = uploadResult.fileId;
      createErr.driveFileName = uploadResult.name;
      console.error(
        `CRITICAL: Quiz file uploaded to Google Drive (${uploadResult.fileId}) but CourseFile database creation failed: ${createErr.message}`
      );
      try {
        await driveService.deleteFile(uploadResult.fileId);
      } catch (cleanupErr) {
        console.warn(`Could not clean up orphaned Drive file ${uploadResult.fileId}: ${cleanupErr.message}`);
      }
      const error = new Error(`Failed to save quiz file metadata: ${createErr.message}`);
      error.statusCode = 500;
      throw error;
    }
  }

  // 10. Update CourseChecklist completion status
  try {
    let checklist = await CourseChecklist.findOne({ courseOffering: offering._id });
    if (!checklist) {
      checklist = await CourseChecklist.findOne({
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: offering.semester?._id || offering.semester,
        section: offering.section || 'A',
      });
    }
    if (checklist && Array.isArray(checklist.checklistItems)) {
      const item = checklist.checklistItems.find((i) => i.type === 'ASSESS_QUIZ');
      if (item && !item.completed) {
        item.completed = true;
        await checklist.save();
      }
    }
  } catch (err) {
    console.warn('Could not update checklist status for ASSESS_QUIZ:', err.message);
  }

  return courseFile;
};

/**
 * Generates and synchronizes an Assignment Word document (.docx) to Google Drive.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {string} params.assignmentId - Assignment ID
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<Object>} Persisted CourseFile document
 */
const generateAndSyncAssignment = async ({ offeringId, assignmentId, user }) => {
  if (!offeringId || !mongoose.Types.ObjectId.isValid(offeringId)) {
    const error = new Error('Invalid or missing CourseOffering ID.');
    error.statusCode = 400;
    throw error;
  }
  if (!assignmentId || !mongoose.Types.ObjectId.isValid(assignmentId)) {
    const error = new Error('Invalid or missing Assignment ID.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Authorize offering access
  const offering = await courseOfferingService.getOfferingById(offeringId, user);

  // 2. Retrieve assignment
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    const error = new Error('Assignment not found.');
    error.statusCode = 404;
    throw error;
  }

  // 3. Verify assignment belongs to offering and reject unassociated legacy assessments
  if (!assignment.courseOffering) {
    const error = new Error(
      'This assignment is not associated with a course offering. Please associate it with an offering before synchronizing to Google Drive.'
    );
    error.statusCode = 400;
    throw error;
  }

  if (assignment.courseOffering.toString() !== offering._id.toString()) {
    const error = new Error('This assignment belongs to a different course offering.');
    error.statusCode = 403;
    throw error;
  }

  // 4. Generate PDF buffer
  let buffer;
  try {
    buffer = await assignmentPdfService.generateAssignmentPDF(assignment);
  } catch (genErr) {
    console.error('Assignment PDF document generation failed:', genErr);
    const error = new Error(`Failed to generate Assignment PDF document: ${genErr.message}`);
    error.statusCode = 500;
    throw error;
  }

  // 5. Resolve Drive destination folder
  const folderId = await module.exports.getAssignmentsFolderForOffering(offering);

  // 6. Generate filename
  const rawAssignNum = (assignment.assignmentInfo?.assignmentNumber || '1').toString().trim();
  const safeAssignNum = rawAssignNum.toLowerCase().startsWith('assignment')
    ? rawAssignNum.replace(/[^a-zA-Z0-9_-]/g, '_')
    : `Assignment_${rawAssignNum.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const courseCode = offering.course?.courseCode || 'COURSE';
  const section = offering.section || 'A';
  const filename = `ASSESS_ASSIGN_${courseCode}_Sec${section}_${safeAssignNum}.pdf`;

  // 7. Check for existing CourseFile record for this assignment (specifically PDF format)
  const query = {
    courseOffering: offering._id,
    documentType: 'ASSESS_ASSIGN',
    fileFormat: 'pdf',
    instanceName: assignmentId.toString(),
  };
  const existingRecord = await CourseFile.findOne(query);

  // 8. Upload to Google Drive (in-place update if existing, or fresh creation)
  const mimeType = MIME_TYPES.pdf;
  let uploadResult;
  try {
    uploadResult = await driveService.uploadDocumentBuffer({
      buffer,
      filename,
      mimeType,
      folderId,
      existingFileId: existingRecord ? existingRecord.googleDriveFileId : null,
    });
  } catch (driveErr) {
    const error = new Error(`Google Drive upload failed: ${driveErr.message}`);
    error.statusCode = 500;
    throw error;
  }

  // 9. Persist CourseFile metadata
  let courseFile;
  if (existingRecord) {
    existingRecord.googleDriveFileId = uploadResult.fileId;
    existingRecord.googleDriveFolderId = folderId;
    existingRecord.googleDriveWebViewLink = uploadResult.webViewLink;
    existingRecord.googleDriveWebContentLink = uploadResult.webContentLink;
    existingRecord.filename = uploadResult.name;
    existingRecord.fileFormat = 'pdf';
    existingRecord.mimeType = uploadResult.mimeType || mimeType;
    existingRecord.sizeBytes = uploadResult.sizeBytes || buffer.length;
    existingRecord.version = (existingRecord.version || 1) + 1;
    existingRecord.uploadedBy = user._id;
    existingRecord.status = 'synced';
    try {
      courseFile = await existingRecord.save();
    } catch (saveErr) {
      saveErr.driveFileId = uploadResult.fileId;
      saveErr.driveFileName = uploadResult.name;
      console.error(
        `CRITICAL: Assignment file updated in Google Drive (${uploadResult.fileId}) but CourseFile database update failed: ${saveErr.message}`
      );
      throw saveErr;
    }
  } else {
    try {
      courseFile = await CourseFile.create({
        courseOffering: offering._id,
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: offering.semester?._id || offering.semester,
        section: offering.section || 'A',
        documentType: 'ASSESS_ASSIGN',
        fileFormat: 'pdf',
        filename: uploadResult.name,
        googleDriveFileId: uploadResult.fileId,
        googleDriveFolderId: folderId,
        googleDriveWebViewLink: uploadResult.webViewLink,
        googleDriveWebContentLink: uploadResult.webContentLink,
        mimeType: uploadResult.mimeType || mimeType,
        sizeBytes: uploadResult.sizeBytes || buffer.length,
        version: 1,
        isCanonical: false,
        instanceName: assignmentId.toString(),
        status: 'synced',
        uploadedBy: user._id,
      });
    } catch (createErr) {
      createErr.driveFileId = uploadResult.fileId;
      createErr.driveFileName = uploadResult.name;
      console.error(
        `CRITICAL: Assignment file uploaded to Google Drive (${uploadResult.fileId}) but CourseFile database creation failed: ${createErr.message}`
      );
      try {
        await driveService.deleteFile(uploadResult.fileId);
      } catch (cleanupErr) {
        console.warn(`Could not clean up orphaned Drive file ${uploadResult.fileId}: ${cleanupErr.message}`);
      }
      const error = new Error(`Failed to save assignment file metadata: ${createErr.message}`);
      error.statusCode = 500;
      throw error;
    }
  }

  // 10. Update CourseChecklist completion status
  try {
    let checklist = await CourseChecklist.findOne({ courseOffering: offering._id });
    if (!checklist) {
      checklist = await CourseChecklist.findOne({
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: offering.semester?._id || offering.semester,
        section: offering.section || 'A',
      });
    }
    if (checklist && Array.isArray(checklist.checklistItems)) {
      const item = checklist.checklistItems.find((i) => i.type === 'ASSESS_ASSIGN');
      if (item && !item.completed) {
        item.completed = true;
        await checklist.save();
      }
    }
  } catch (err) {
    console.warn('Could not update checklist status for ASSESS_ASSIGN:', err.message);
  }

  return courseFile;
};

/**
 * Deletes the CourseFile record and associated Google Drive file for an assessment.
 *
 * @param {Object} params
 * @param {string} params.offeringId - CourseOffering ID
 * @param {string} params.documentType - 'ASSESS_QUIZ' | 'ASSESS_ASSIGN'
 * @param {string} params.assessmentId - MongoDB ObjectId string of the quiz or assignment
 * @param {Object} params.user - Authenticated user
 * @returns {Promise<{ deleted: boolean, driveFileId?: string }>}
 */
const deleteAssessmentFile = async ({ offeringId, documentType, assessmentId, user }) => {
  if (!offeringId || !assessmentId) return { deleted: false };

  // Verify offering authorization
  await courseOfferingService.getOfferingById(offeringId, user);

  const courseFile = await CourseFile.findOne({
    courseOffering: offeringId,
    documentType,
    instanceName: assessmentId.toString(),
  });

  if (!courseFile) {
    return { deleted: false };
  }

  // 1. Delete from Google Drive if driveFileId exists
  if (courseFile.googleDriveFileId) {
    try {
      await driveService.deleteFile(courseFile.googleDriveFileId);
    } catch (driveErr) {
      console.error(
        `Failed to delete ${documentType} file ${courseFile.googleDriveFileId} from Google Drive: ${driveErr.message}`
      );
      const error = new Error(`Google Drive deletion failed: ${driveErr.message}`);
      error.statusCode = 502;
      error.courseFileId = courseFile._id;
      error.driveFileId = courseFile.googleDriveFileId;
      throw error;
    }
  }

  // 2. Delete CourseFile record only after Drive file deletion succeeds
  await CourseFile.findByIdAndDelete(courseFile._id);

  return {
    deleted: true,
    deletedFileId: courseFile._id,
    driveFileId: courseFile.googleDriveFileId,
  };
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
  generateAndSyncCCR,
  generateAndSyncTimetable,
  generateAndSyncProject,
  generateAndSyncCCC,
  generateAndSyncCRR,
  uploadLectureFile,
  uploadLectureFiles,
  deleteCourseFile,
  getLecturesFolderForOffering,
  getQuizzesFolderForOffering,
  getAssignmentsFolderForOffering,
  getMidtermFolderForOffering,
  getFinalFolderForOffering,
  updateExamChecklistStatus,
  uploadExamDocument,
  generateAndSyncQuiz,
  generateAndSyncAssignment,
  deleteAssessmentFile,
  listOfferingFiles,
  getCourseFileById,
  downloadCourseFile,
  MIME_TYPES,
  ALLOWED_LECTURE_FORMATS,
  MAX_LECTURE_FILE_SIZE,
  ALLOWED_EXAM_FORMATS,
  MAX_EXAM_FILE_SIZE,
};
