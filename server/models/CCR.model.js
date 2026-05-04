const mongoose = require('mongoose');

const commonRowFields = {
  scheduleDate: { type: String, default: '' },
  timeIn: { type: String, default: '' },
  timeOut: { type: String, default: '' },
  topicCovered: { type: String, default: '' },
  activityType: { type: String, default: '' },
  hoursCompleted: { type: String, default: '' },
  signature: { type: String, default: '' },
  remarks: { type: String, default: '' }
};

const weeklyRowSchema = new mongoose.Schema({
  weekNo: { type: Number, required: true },
  ...commonRowFields
}, { _id: false });

const alternateRowSchema = new mongoose.Schema({
  rowNo: { type: Number, required: true },
  ...commonRowFields
}, { _id: false });

const ccrSchema = new mongoose.Schema({
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
  formType: {
    type: String,
    enum: ['CCR'],
    default: 'CCR',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted'],
    default: 'draft'
  },
  courseInfo: {
    facultyName: { type: String, default: '' },
    program: { type: String, default: '' },
    courseTitle: { type: String, default: '' },
    courseCode: { type: String, default: '' },
    edpCode: { type: String, default: '' },
    sessionDay: { type: String, default: '' },
    timeSlot: { type: String, default: '' },
    location: { type: String, default: '' }
  },
  weeklyData: {
    type: [weeklyRowSchema],
    default: () => Array.from({ length: 15 }, (_, i) => ({ weekNo: i + 1 }))
  },
  alternateData: {
    type: [alternateRowSchema],
    default: () => Array.from({ length: 4 }, (_, i) => ({ rowNo: i + 1 }))
  }
}, { timestamps: true });

// Ensure one form per course per faculty per formType
ccrSchema.index({ course: 1, faculty: 1, formType: 1 }, { unique: true });

module.exports = mongoose.model('CCR', ccrSchema);
