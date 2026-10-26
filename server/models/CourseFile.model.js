/**
 * CourseFile.model.js — Mongoose schema for course files stored in Google Drive.
 *
 * Persists metadata and Google Drive references for generated and uploaded
 * course documents (CIS, CCR, CCP, Exam papers, etc.) scoped to a CourseOffering.
 *
 * Concurrency & Uniqueness:
 *  - Compound unique index on { courseOffering, documentType, fileFormat, instanceName }
 *    prevents duplicate files for canonical documents (where instanceName = '') while
 *    allowing separate multi-instance records (e.g. "Quiz 1", "Quiz 2").
 */
const mongoose = require('mongoose');

const DOCUMENT_TYPES = [
  'CIS',
  'CCR',
  'CCC',
  'CCP',
  'TIMETABLE',
  'WP',
  'AR',
  'LECTURES',
  'ASSESS_QUIZ',
  'ASSESS_ASSIGN',
  'ASSESS_MID',
  'ASSESS_FINAL',
  'FMGR',
  'CLO',
  'GA',
  'CRR',
  'TECH',
  'DESIGN',
  'OTHER',
];

const FILE_FORMATS = ['docx', 'pdf', 'xlsx', 'other'];

const courseFileSchema = new mongoose.Schema(
  {
    courseOffering: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseOffering',
      required: [true, 'Course offering reference is required'],
      index: true,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
      index: true,
    },

    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Faculty reference is required'],
      index: true,
    },

    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: [true, 'Semester reference is required'],
      index: true,
    },

    section: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'A',
      maxlength: [10, 'Section code cannot exceed 10 characters'],
    },

    documentType: {
      type: String,
      required: [true, 'Document type is required'],
      enum: {
        values: DOCUMENT_TYPES,
        message: 'Invalid document type: {VALUE}',
      },
      index: true,
    },

    fileFormat: {
      type: String,
      required: [true, 'File format is required'],
      enum: {
        values: FILE_FORMATS,
        message: 'Invalid file format: {VALUE}',
      },
      lowercase: true,
    },

    filename: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true,
    },

    googleDriveFileId: {
      type: String,
      required: [true, 'Google Drive file ID is required'],
      trim: true,
      index: true,
    },

    googleDriveFolderId: {
      type: String,
      required: [true, 'Google Drive destination folder ID is required'],
      trim: true,
    },

    googleDriveWebViewLink: {
      type: String,
      default: null,
      trim: true,
    },

    googleDriveWebContentLink: {
      type: String,
      default: null,
      trim: true,
    },

    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true,
    },

    sizeBytes: {
      type: Number,
      default: 0,
      min: [0, 'File size cannot be negative'],
    },

    version: {
      type: Number,
      default: 1,
      min: [1, 'Version must be at least 1'],
    },

    isCanonical: {
      type: Boolean,
      default: true,
    },

    // Used for multi-instance documents (e.g. 'Quiz 1', 'Assignment 2'). Empty string for canonical documents.
    instanceName: {
      type: String,
      default: '',
      trim: true,
    },

    status: {
      type: String,
      enum: ['synced', 'draft', 'archived'],
      default: 'synced',
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploaded by user reference is required'],
    },
  },
  { timestamps: true }
);

/* ── Indexes ─────────────────────────────────────────────────────────────── */

// Canonical & multi-instance document uniqueness per offering:
// Exactly one record per offering + documentType + fileFormat + instanceName
courseFileSchema.index(
  { courseOffering: 1, documentType: 1, fileFormat: 1, instanceName: 1 },
  { unique: true }
);

courseFileSchema.index({ course: 1, semester: 1 });
courseFileSchema.index({ faculty: 1, semester: 1 });

// Ensure virtuals appear in JSON / Object serialization
courseFileSchema.set('toJSON', { virtuals: true });
courseFileSchema.set('toObject', { virtuals: true });

const CourseFile = mongoose.model('CourseFile', courseFileSchema);

module.exports = CourseFile;
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
module.exports.FILE_FORMATS = FILE_FORMATS;
