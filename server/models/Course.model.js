/**
 * Course.model.js — Mongoose schema for university courses.
 *
 * Fields:
 *  courseCode      – Unique identifier (e.g. "CS-301"), uppercase-normalised
 *  courseName      – Human-readable name
 *  type            – 'Core' | 'Elective'
 *  isLab           – Whether the course has a lab component
 *  assignedFaculty – Optional ref to User (faculty member)
 *  creditHours     – Standard credit-hour value (scalable addition)
 *  department      – Owning department (scalable addition)
 *  isActive        – Soft-disable without deletion
 *  timestamps      – createdAt + updatedAt via Mongoose
 */
const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: [true, 'Course code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [
        // /^[A-Z]{2,10}-\d{3,4}$/,
        // 'Course code must follow the pattern XX-000 (e.g. CS-301)',
        /^(CSC|HUM|HMT|BUS|SSC|CS|CE|SE|TE|MT|MS)\d{3}(-L)?$/,
        'Course code must follow the pattern (CSC|HUM|HMT|BUS|SSC|CS|CE|SE|TE|MT|MS)000(-L)? (e.g. CSC101 or CSC101-L)',
      ],
    },

    courseName: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true,
      minlength: [3, 'Course name must be at least 3 characters'],
      maxlength: [120, 'Course name cannot exceed 120 characters'],
    },

    type: {
      type: String,
      required: [true, 'Course type is required'],
      enum: {
        values: ['Core', 'Elective'],
        message: "Type must be 'Core' or 'Elective'",
      },
    },

    isLab: {
      type: Boolean,
      default: false,
    },

    assignedFaculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // Nullable — a course may exist before faculty is assigned.
    },

    // ── Scalable additions ──────────────────────────────────────────────────
    // These fields are included now so the schema can grow without migrations.

    creditHours: {
      type: Number,
      default: 3,
      min: [1, 'Credit hours must be at least 1'],
      max: [6, 'Credit hours cannot exceed 6'],
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* ── Indexes ───────────────────────────────────────────────────────────────
 * courseCode already has a unique index from `unique: true` above.
 * Adding a compound index for common query patterns (e.g. filtering courses
 * by type within a department).
 */
courseSchema.index({ department: 1, type: 1 });
courseSchema.index({ assignedFaculty: 1 });

/* ── Virtual ───────────────────────────────────────────────────────────────
 * A convenience label combining code + name, e.g. "CS-301: Data Structures"
 */
courseSchema.virtual('fullTitle').get(function () {
  return `${this.courseCode}: ${this.courseName}`;
});

// Ensure virtuals appear in JSON / Object serialisation
courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Course', courseSchema);
