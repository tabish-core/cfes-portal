const mongoose = require('mongoose');

const obeStudentSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
    },
    registrationNo: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true,
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate registration numbers within the SAME course
obeStudentSchema.index({ course: 1, registrationNo: 1 }, { unique: true });

module.exports = mongoose.model('OBEStudent', obeStudentSchema);
