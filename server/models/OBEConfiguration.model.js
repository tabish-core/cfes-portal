const mongoose = require('mongoose');

const obeConfigurationSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Faculty reference is required'],
    },
    clos: [
      {
        cloNumber: { type: String, required: true },
        description: { type: String, required: true },
        active: { type: Boolean, default: true },
      },
    ],
    gas: [
      {
        gaNumber: { type: String, required: true },
        description: { type: String, required: true },
        active: { type: Boolean, default: true },
      },
    ],
    cloGaMapping: [
      {
        cloNumber: { type: String, required: true },
        mappedGAs: [{ type: String }],
      },
    ],
    assessments: {
      quizzes: { type: Number, default: 10, min: 0 },
      assignments: { type: Number, default: 25, min: 0 },
      midTerm: { type: Number, default: 25, min: 0 },
      finalExam: { type: Number, default: 40, min: 0 },
    },
    grades: {
      A: { type: Number, default: 88, min: 0, max: 100 },
      BPlus: { type: Number, default: 81, min: 0, max: 100 },
      B: { type: Number, default: 74, min: 0, max: 100 },
      CPlus: { type: Number, default: 67, min: 0, max: 100 },
      C: { type: Number, default: 60, min: 0, max: 100 },
      F: { type: Number, default: 59, min: 0, max: 100 }, // Representing below 60
    },
    kpiThreshold: {
      type: Number,
      default: 60,
      min: 0,
      max: 100
    },
  },
  { timestamps: true }
);

// One configuration per faculty-course pair
obeConfigurationSchema.index({ course: 1, faculty: 1 }, { unique: true });

module.exports = mongoose.model('OBEConfiguration', obeConfigurationSchema);
