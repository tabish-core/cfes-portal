const mongoose = require('mongoose');

const obeAssessmentSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['quizzes', 'assignments', 'midTerm', 'finalExam'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    components: [
      {
        componentNumber: {
          type: String,
          required: [true, 'Component number is required'],
        },
        title: {
          type: String,
          trim: true,
        },
        maxMarks: {
          type: Number,
          required: [true, 'Maximum marks are required'],
          min: [0.1, 'Maximum marks must be greater than 0'],
        },
        cloNumber: {
          type: String,
          required: [true, 'CLO mapping is required'],
        },
        active: {
          type: Boolean,
          default: true,
        },
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('OBEAssessment', obeAssessmentSchema);
