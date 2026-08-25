/**
 * Quiz.model.js — Mongoose schema for Quiz documents.
 *
 * Unlike CCC/CCR/CRR (one-per-course), a course can have many quizzes.
 * Each quiz is a separate document linked to a course + faculty.
 *
 * Fields:
 *   course       – ObjectId ref → Course
 *   faculty      – ObjectId ref → User
 *   semester     – ObjectId ref → Semester (optional scope)
 *   quizInfo     – Quiz metadata (number, date, duration, marks)
 *   courseInfo   – Snapshot of course details at quiz creation time
 *   cloMappings  – CLO/GA/SDG mapping rows
 *   questions    – Question list with auto-numbered entries
 *   status       – 'draft' | 'submitted'
 *   timestamps   – createdAt + updatedAt via Mongoose
 */
const mongoose = require('mongoose');

const cloMappingSchema = new mongoose.Schema({
  mappedCLO: { type: String, default: '' },
  mappedGA: { type: String, default: '' },
  mappedLearningLevel: { type: String, default: '' },
  sdg: { type: String, default: '' },
}, { _id: false });

const questionSchema = new mongoose.Schema({
  questionNumber: { type: Number, required: true },
  questionText: { type: String, default: '' },
  marks: { type: String, default: '' },
}, { _id: false });

const quizSchema = new mongoose.Schema({
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

  /* ── Quiz Metadata ──────────────────────────────────────── */
  quizInfo: {
    quizNumber: { type: String, default: '' },
    date: { type: String, default: '' },
    duration: { type: String, default: '' },
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

  /* ── Questions ──────────────────────────────────────────── */
  questions: [questionSchema],

  /* ── Status ─────────────────────────────────────────────── */
  status: {
    type: String,
    enum: ['draft', 'submitted'],
    default: 'draft'
  },

}, { timestamps: true });

// Index for fast lookups: all quizzes for a course by a faculty member
quizSchema.index({ course: 1, faculty: 1 });

module.exports = mongoose.model('Quiz', quizSchema);
