/**
 * CourseOffering.model.js — Junction model linking Faculty, Course, and Semester.
 *
 * Each record represents: "This faculty teaches this course (section) in this semester."
 *
 * Fields:
 *  faculty   – ObjectId ref → User (must have role 'faculty')
 *  course    – ObjectId ref → Course
 *  semester  – ObjectId ref → Semester
 *  section   – Section label (e.g. "A", "B"), defaults to "A"
 *  timestamps
 *
 * Unique compound index on { course, semester, section } ensures no duplicate
 * offerings of the same course-section in a semester.
 */
const mongoose = require('mongoose');

const courseOfferingSchema = new mongoose.Schema(
  {
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Faculty is required'],
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course is required'],
    },

    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: [true, 'Semester is required'],
    },

    section: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'A',
      maxlength: [5, 'Section cannot exceed 5 characters'],
    },
  },
  { timestamps: true }
);

/* ── Indexes ───────────────────────────────────────────────────────────────
 * A specific course-section can only be offered once per semester.
 * Different faculty can teach different sections of the same course.
 */
courseOfferingSchema.index({ course: 1, semester: 1, section: 1 }, { unique: true });
courseOfferingSchema.index({ faculty: 1, semester: 1 });
courseOfferingSchema.index({ semester: 1 });

// Ensure virtuals appear in JSON / Object serialisation
courseOfferingSchema.set('toJSON', { virtuals: true });
courseOfferingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CourseOffering', courseOfferingSchema);
