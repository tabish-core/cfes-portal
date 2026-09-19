require('dotenv').config();
const mongoose = require('mongoose');
const OBEConfiguration = require('./models/OBEConfiguration.model');
const CourseOffering = require('./models/CourseOffering.model');
const OBEStudent = require('./models/OBEStudent.model');
const OBEAssessment = require('./models/OBEAssessment.model');
const OBEMark = require('./models/OBEMark.model');
const { generateCourseResults } = require('./services/obe/obeCalculationService');
const { generateOBEExcel } = require('./services/obe/obeExcelService');

async function testExport(courseId) {
  try {
    await mongoose.connect('mongodb://localhost:27017/cfes_portal');
    console.log('Connected to DB');

    const course = await CourseOffering.findOne({ course: courseId }).populate('course').populate('faculty', 'name').lean();
    if (!course) {
      console.log('Course not found');
      return;
    }
    
    const courseData = {
      ...course,
      courseCode: course.course?.courseCode,
      courseName: course.course?.courseName,
      creditHours: course.course?.creditHours,
      type: course.course?.type
    };

    const config = await OBEConfiguration.findOne({ course: courseId }).lean();
    const students = await OBEStudent.find({ course: courseId, active: true }).sort({ registrationNo: 1 }).lean();
    const assessments = await OBEAssessment.find({ course: courseId, active: true }).lean();
    const marks = await OBEMark.find({ course: courseId }).lean();

    console.log('Generating results...');
    const results = generateCourseResults(config, students, assessments, marks);

    console.log('Generating excel...');
    const buffer = await generateOBEExcel({ course: courseData, config, assessments, marks, results });
    console.log('SUCCESS! Buffer length:', buffer.length);

  } catch (error) {
    console.error('ERROR ENCOUNTERED:', error);
  } finally {
    mongoose.disconnect();
  }
}

// User's courseId from URL
testExport('69fc7bd8dd35a98a24284e91').catch(console.error);
