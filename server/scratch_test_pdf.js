const { generateCCRPDF } = require('./services/documentService/generateCCRPDF');
const fs = require('fs');
const path = require('path');

async function test() {
  const data = {
    courseInfo: {
      courseCode: 'CSC101',
      courseName: 'Intro to Computing',
      facultyName: 'Test Faculty'
    },
    weeklyData: [
      { weekNo: '1', topicCovered: 'Intro', duration: '3', activityType: 'Lecture' }
    ],
    alternateData: []
  };

  try {
    console.log('Starting PDF generation...');
    const buffer = await generateCCRPDF(data);
    fs.writeFileSync('test.pdf', buffer);
    console.log('PDF generated successfully: test.pdf');
  } catch (err) {
    console.error('PDF generation failed:', err);
  }
}

test();
