/**
 * Assignment.model.js — Mongoose schema for Assignment documents.
 *
 * Like quizzes, a course can have many assignments.
 * Each assignment is a separate document linked to a course + faculty.
 *
 * Fields:
 *   course              – ObjectId ref → Course
 *   faculty             – ObjectId ref → User
 *   semester            – ObjectId ref → Semester (optional scope)
 *   assignmentInfo      – Assignment metadata (number, dates, marks)
 *   courseInfo           – Snapshot of course details at creation time
 *   cloMappings          – CLO/GA/SDG mapping rows
 *   assignmentTitle      – Title of the assignment
 *   objective            – Objective text
 *   assignmentDescription – Full description
 *   tasks                – List of task strings
 *   submissionGuidelines – List of guideline strings
 *   evaluationCriteria   – List of criterion strings
 *   tipsForSuccess       – List of tip strings
 *   status               – 'draft' | 'submitted'
 *   timestamps           – createdAt + updatedAt via Mongoose
 */
const mongoose = require('mongoose');

const cloMappingSchema = new mongoose.Schema({
  mappedCLO: { type: String, default: '' },
  mappedGA: { type: String, default: '' },
  mappedLearningLevel: { type: String, default: '' },
  sdg: { type: String, default: '' },
}, { _id: false });

const assignmentSchema = new mongoose.Schema({
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

  /* ── Assignment Metadata ────────────────────────────────── */
  assignmentInfo: {
    assignmentNumber: { type: String, default: '' },
    announcementDate: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    maxMarks: { type: String, default: '' },
  },

  /* ── Course Snapshot ────────────────────────────────────── */
  courseInfo: {
    department: { type: String, default: '' },
    program: { type: String, default: '' },
    courseTitle: { type: String, default: '' },
  },

  /* ── CLO Mappings ───────────────────────────────────────── */
  cloMappings: [cloMappingSchema],

  /* ── Assignment Content ─────────────────────────────────── */
  assignmentTitle: { type: String, default: '' },
  objective: { type: String, default: '' },
  assignmentDescription: { type: String, default: '' },

  /* ── Dynamic Lists ──────────────────────────────────────── */
  tasks: [{ type: String }],
  submissionGuidelines: [{ type: String }],
  evaluationCriteria: [{ type: String }],
  tipsForSuccess: [{ type: String }],

  /* ── Status ─────────────────────────────────────────────── */
  status: {
    type: String,
    enum: ['draft', 'submitted'],
    default: 'draft'
  },

}, { timestamps: true });

// Index for fast lookups: all assignments for a course by a faculty member
assignmentSchema.index({ course: 1, faculty: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
