/**
 * CRR.model.js — Mongoose schema for Course Review Report (Theory Courses).
 *
 * Mirrors the CCC/CCR model structure:
 *   course + faculty + semester + formType  →  unique compound index
 *
 * Fields:
 *   courseInfo              – Auto-filled info (teacherName, department, courseTitle, etc.)
 *   assessmentSummary      – CLO/GAs attainment rows
 *   gradeSummary           – Grade distribution + class average
 *   courseLearningOutcomes – Adequacy + CLO/PLO attainment comments
 *   courseEnhancement       – Enhancement/improvement textareas
 *   signatureInfo          – Instructor & HoD signature metadata
 */
const mongoose = require('mongoose');

const assessmentRowSchema = new mongoose.Schema({
  clo: { type: String, default: '' },
  cloAttainment: { type: String, default: '' },
  mappedGAs: { type: String, default: '' },
  gaAttainment: { type: String, default: '' },
  assessmentName: { type: String, default: '' },
}, { _id: false });

const crrSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  semester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    default: null,
  },
  formType: {
    type: String,
    enum: ['CRR'],
    default: 'CRR',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted'],
    default: 'draft'
  },

  /* ── Section A: Course Details ─────────────────────────── */
  courseInfo: {
    teacherName: { type: String, default: '' },
    department: { type: String, default: '' },
    courseTitle: { type: String, default: '' },
    courseCode: { type: String, default: '' },
    creditHours: { type: String, default: '' },
    semester: { type: String, default: '' },
    noOfStudents: { type: String, default: '' },
  },

  /* ── Section B: Assessment Summary ─────────────────────── */
  assessmentSummary: [assessmentRowSchema],

  /* ── Section C: Grade Summary ──────────────────────────── */
  gradeSummary: {
    'A+': { type: String, default: '' },
    'A': { type: String, default: '' },
    'B+': { type: String, default: '' },
    'B': { type: String, default: '' },
    'C+': { type: String, default: '' },
    'C': { type: String, default: '' },
    'F': { type: String, default: '' },
    classAverage: { type: String, default: '' },
  },

  /* ── Section D: Course Learning Outcomes ────────────────── */
  courseLearningOutcomes: {
    outcomesAdequate: { type: String, default: '' },
    revisionSuggestion: { type: String, default: '' },
    cloAttainmentStatus: { type: String, default: '' },
    cloAttainmentReason: { type: String, default: '' },
    ploAttainmentStatus: { type: String, default: '' },
    ploAttainmentReason: { type: String, default: '' },
  },

  /* ── Section E: Course Enhancement / Improvement ────────── */
  courseEnhancement: {
    courseEnhancementComment: { type: String, default: '' },
    implementationComments: { type: String, default: '' },
    appropriatenessComments: { type: String, default: '' },
  },

  /* ── Signature Section ─────────────────────────────────── */
  signatureInfo: {
    instructorDate: { type: String, default: '' },
    hodDate: { type: String, default: '' },
  },

}, { timestamps: true });

// Ensure one CRR per course per faculty (optionally scoped by semester)
crrSchema.index({ course: 1, faculty: 1, semester: 1, formType: 1 }, { unique: true });

module.exports = mongoose.model('CourseReviewReport', crrSchema);
