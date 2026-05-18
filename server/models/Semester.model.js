/**
 * Semester.model.js — Mongoose schema for academic semesters.
 *
 * Fields:
 *  name     – Human-readable label (e.g. "Fall 2025"), unique
 *  status   – 'active' | 'inactive'
 *  timestamps – createdAt + updatedAt via Mongoose
 */
const mongoose = require('mongoose');

const semesterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Semester name is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Semester name must be at least 3 characters'],
      maxlength: [50, 'Semester name cannot exceed 50 characters'],
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: "Status must be 'active' or 'inactive'",
      },
      default: 'inactive',
    },
  },
  { timestamps: true }
);

// Ensure virtuals appear in JSON / Object serialisation
semesterSchema.set('toJSON', { virtuals: true });
semesterSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Semester', semesterSchema);
