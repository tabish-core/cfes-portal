const mongoose = require('mongoose');
const User = require('./models/User.model');
const CourseOffering = require('./models/CourseOffering.model');
const OBEConfiguration = require('./models/OBEConfiguration.model');
const OBEStudent = require('./models/OBEStudent.model');
const OBEAssessment = require('./models/OBEAssessment.model');
const OBEMark = require('./models/OBEMark.model');

async function run() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cfes_portal', { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to DB');

    // Check for a faculty user
    const user = await User.findOne({ role: 'faculty' });
    console.log('Faculty user:', user?.email);

    // Find a course for this user
    const courses = await CourseOffering.find({ instructor: user?._id });
    console.log('Courses for faculty:', courses.map(c => c.courseCode));

    if (courses.length > 0) {
      const courseId = courses[0]._id;
      const config = await OBEConfiguration.findOne({ course: courseId });
      console.log('Has config?', !!config);
      const students = await OBEStudent.find({ course: courseId });
      console.log('Students count:', students.length);
      const assessments = await OBEAssessment.find({ course: courseId });
      console.log('Assessments:', assessments.map(a => a.category + '(' + a.components.length + ')'));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
