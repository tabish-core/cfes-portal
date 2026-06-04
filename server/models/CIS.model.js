const mongoose = require('mongoose');

const CISSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  semester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    default: null,
  },
  formType: {
    type: String,
    default: 'CIS',
    enum: ['CIS'],
  },
  status: {
    type: String,
    enum: ['draft', 'submitted'],
    default: 'draft',
  },

  courseSummary: {
    courseCode: { type: String, default: '' },
    courseName: { type: String, default: '' },
    creditHours: { type: String, default: '' },
  },

  basicInfo: {
    instructor: { type: String, default: '' },
    designation: { type: String, default: '' },
    prerequisites: { type: String, default: '' },
    semester: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    consultingHours: { type: String, default: '' },
    officeLocation: { type: String, default: '' },
  },

  courseObjectives: { type: String, default: '' },
  courseContents: { type: String, default: '' },

  cloTable: [{
    cloNumber: { type: String, default: '' },
    cloStatement: { type: String, default: '' },
    btLevel: { type: String, default: '' },
    gaMapping: { type: String, default: '' },
    acmKaMapping: { type: String, default: '' },
    sgdMapping: { type: String, default: '' },
    weightPercentage: { type: Number },
  }],

  textbooks: [{
    serialNo: { type: String, default: '' },
    bookTitle: { type: String, default: '' },
    authors: { type: String, default: '' },
    editionPublicationPublisher: { type: String, default: '' },
  }],

  obaTable: [{
    category: { type: String, default: '' },
    assessmentTool: { type: String, default: '' },
    cloMapped: { type: String, default: '' },
    cloMarks: { type: Number },
    weightPercentage: { type: Number },
    totalMarks: { type: Number },
    assessmentDate: { type: String, default: '' },
  }],

  weeklyPlan: [{
    week: { type: String, default: '' },
    lectureNo: { type: String, default: '' },
    topicCovered: { type: String, default: '' },
    clo: { type: String, default: '' },
    assessmentTool: { type: String, default: '' },
    isSpecialRow: { type: Boolean, default: false },
    specialRowText: { type: String, default: '' },
  }],

  gradingPolicy: {
    quizzes: { type: Number },
    assignments: { type: Number },
    project: { type: Number },
    midterm: { type: Number },
    finalExam: { type: Number },
  }
}, {
  timestamps: true
});

// Ensure only one CIS document per course + faculty + semester triple
CISSchema.index({ course: 1, faculty: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('CIS', CISSchema);
