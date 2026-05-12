const docx = require('docx');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, VerticalAlign, Header } = docx;

// Import component builders
const { buildHeader } = require('./components/buildHeader');
const { buildCourseInfoTable } = require('./components/buildCourseInfoTable');
const { buildBasicInfoTable } = require('./components/buildBasicInfoTable');
const { buildObjectivesAndContents } = require('./components/buildObjectivesAndContents');
const { buildCLOTable } = require('./components/buildCLOTable');
const { buildTextbookTable } = require('./components/buildTextbookTable');
const { buildOBATable } = require('./components/buildOBATable');
const { buildWeeklyPlanTable } = require('./components/buildWeeklyPlanTable');
const { buildGradingPolicyTable } = require('./components/buildGradingPolicyTable');

const generateCISWord = async (formData) => {
  // We assume formData maps perfectly to the JSON schema designed earlier
  const { courseInfo, alternateData, weeklyData } = formData;
  const logoPath = path.join(__dirname, 'assets', 'logo.png');

  const doc = new Document({
    creator: "CFES Portal",
    title: `Course Information Sheet - ${courseInfo?.courseCode || 'Course'}`,
    description: "Auto-generated CIS Document",
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 21, // 10.5pt
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240, // Letter width
              height: 15840, // Letter height
            },
            margin: {
              top: 1080, // 0.75in
              right: 1080,
              bottom: 1080,
              left: 1080,
            },
          },
        },
        headers: {
          default: new Header({
            children: [...await buildHeader(logoPath)],
          }),
        },
        children: [
          // 2. Top Course Information Table
          buildCourseInfoTable(courseInfo),
          new Paragraph({ text: "" }),

          // 3. Section 1: Basic Information
          buildBasicInfoTable(courseInfo),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),

          // 4. Section 2 & 3: Course Objectives & Contents
          ...buildObjectivesAndContents(courseInfo),

          // 5. Section 4: Course Learning Outcomes
          buildCLOTable(alternateData?.cloTable || []),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),

          // 6. Section 5: Textbooks
          buildTextbookTable(alternateData?.textbooks || []),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),

          // 7. Section 6: OBA
          buildOBATable(alternateData?.obaTable || {}),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),

          // 8. Section 7: Weekly Plan
          buildWeeklyPlanTable(weeklyData || []),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),

          // 9. Section 8: Grading Policy
          buildGradingPolicyTable(alternateData?.gradingPolicy || {}),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
};

module.exports = {
  generateCISWord
};
