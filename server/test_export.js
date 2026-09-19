const mongoose = require('mongoose');
const obeCalculationService = require('./services/obe/obeCalculationService');
const obeExcelService = require('./services/obe/obeExcelService');
const Course = require('./models/Course.model');
const OBEMark = require('./models/OBEMark.model');
require('dotenv').config();

async function testExport() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  
  const courseId = '69fc7bd8dd35a98a24284e91';
  
  const course = await Course.findById(courseId)
    .populate('faculty', 'name email')
    .populate('semester', 'name year');
    
  if (!course) {
    console.log('Course not found');
    process.exit(1);
  }

  const marks = await OBEMark.find({ course: courseId }).populate('student', 'studentId name');
  const config = course.obeConfig || {};

  const results = await obeCalculationService.calculateCourseOBE(courseId);

  const excelBuffer = await obeExcelService.generateOBEExcel(course, config, marks, results);
  
  const fs = require('fs');
  fs.writeFileSync('Generated_OBE_new.xlsx', excelBuffer);
  console.log('Exported successfully to Generated_OBE_new.xlsx');
  
  process.exit(0);
}

testExport().catch(e => {
  console.error(e);
  process.exit(1);
});
