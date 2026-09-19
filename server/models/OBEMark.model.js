const mongoose = require('mongoose');

const obeMarkSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OBEStudent',
      required: [true, 'Student reference is required'],
    },
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OBEAssessment',
      required: [true, 'Assessment reference is required'],
    },
    componentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Component ID is required'],
    },
    marks: {
      type: Number,
      required: [true, 'Marks are required'],
      min: [0, 'Marks cannot be negative'],
    },
  },
  { timestamps: true }
);

// Ensure there is at most one mark per student for a specific component in a course
obeMarkSchema.index({ course: 1, student: 1, componentId: 1 }, { unique: true });

module.exports = mongoose.model('OBEMark', obeMarkSchema);
