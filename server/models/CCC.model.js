/**
 * CCC.model.js — Mongoose schema for Course Completion Certificate.
 *
 * Mirrors the CCR model structure:
 *   course + faculty + semester + formType  →  unique compound index
 *
 * Fields:
 *   courseInfo       – Auto-filled read-only info (facultyName, courseTitle, courseCode, program)
 *   certificateData – Editable fields (sessionsHeld, totalRequiredSessions, date, completionPercentage)
 */
const mongoose = require('mongoose');

const cccSchema = new mongoose.Schema({
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
    enum: ['CCC'],
    default: 'CCC',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted'],
    default: 'draft'
  },
  courseInfo: {
    facultyName: { type: String, default: '' },
    courseTitle: { type: String, default: '' },
    courseCode: { type: String, default: '' },
    program: { type: String, default: '' },
    semesterName: { type: String, default: '' },
  },
  certificateData: {
    sessionsHeld: { type: String, default: '' },
    totalRequiredSessions: { type: String, default: '' },
    date: { type: String, default: '' },
    endTermReviewFilled: { type: String, default: 'Yes' },
  }
}, { timestamps: true });

// Ensure one CCC per course per faculty (optionally scoped by semester)
cccSchema.index({ course: 1, faculty: 1, semester: 1, formType: 1 }, { unique: true });

module.exports = mongoose.model('CCC', cccSchema);
