const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  completed: { type: Boolean, default: false }
}, { _id: false });

const courseChecklistSchema = new mongoose.Schema({
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
  courseTitle: { type: String, default: '' },
  courseCode: { type: String, default: '' },
  batch: { type: String, default: '' },
  checklistItems: {
    type: [checklistItemSchema],
    default: [
      { name: 'Course Information Sheet', type: 'CIS', completed: false },
      { name: 'Weekly Plan', type: 'WP', completed: false },
      { name: 'Course Control Report', type: 'CCR', completed: false },
      { name: 'Timetable with consulting hours', type: 'TIMETABLE', completed: false },
      { name: 'Attendance Record', type: 'AR', completed: false },
      { name: 'Lectures', type: 'LECTURES', completed: false },
      { name: 'Question Paper, Model Solution, Quizzes', type: 'ASSESS_QUIZ', completed: false },
      { name: 'Assignments', type: 'ASSESS_ASSIGN', completed: false },
      { name: 'Midterm', type: 'ASSESS_MID', completed: false },
      { name: 'Final Exam', type: 'ASSESS_FINAL', completed: false },
      { name: 'CCP/Class Project/PBL', type: 'ASSESS_PROJECT', completed: false },
      { name: 'Course Completion Certificate', type: 'CCC', completed: false },
      { name: 'Final Marks and Grade Report', type: 'FMGR', completed: false },
      { name: 'Record of CLO assessment', type: 'CLO', completed: false },
      { name: 'Record of GA assessment', type: 'GA', completed: false },
      { name: 'Course Review Report', type: 'CRR', completed: false },
      { name: 'Detail of technology involved', type: 'TECH', completed: false },
      { name: 'Design skills practiced', type: 'DESIGN', completed: false },
      { name: 'Course effectiveness analysis', type: 'CEA', completed: false },
    ]
  }
}, { timestamps: true });

// One checklist per course per faculty per semester
courseChecklistSchema.index({ course: 1, faculty: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('CourseChecklist', courseChecklistSchema);
