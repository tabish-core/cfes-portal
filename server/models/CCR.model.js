const mongoose = require('mongoose');

const commonRowFields = {
  scheduleDate: { type: String, default: '' },
  timeIn: { type: String, default: '' },
  timeOut: { type: String, default: '' },
  topicCovered: { type: String, default: '' },
  activityType: { type: String, default: '' },
  duration: { type: String, default: '' }, // Updated from hoursCompleted to match template
  signature: { type: String, default: '' },
  remarks: { type: String, default: '' },
  isSpecialRow: { type: Boolean, default: false },
  specialRowText: { type: String, default: '' }
};

const weeklyRowSchema = new mongoose.Schema({
  weekNo: { type: String, default: '' }, // String to allow flexibility or empty for merged rows
  ...commonRowFields
}, { _id: false });

const alternateRowSchema = new mongoose.Schema({
  rowNo: { type: Number },
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
  semester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    default: null,
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
  weeklyData: [weeklyRowSchema],
  alternateData: [alternateRowSchema]
}, { timestamps: true });

// Ensure one form per course per faculty per semester per formType
ccrSchema.index({ course: 1, faculty: 1, semester: 1, formType: 1 }, { unique: true });

module.exports = mongoose.model('CCR', ccrSchema);
