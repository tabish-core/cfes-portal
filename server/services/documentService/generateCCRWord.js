const { Document, Packer, Paragraph, PageOrientation, PageSize } = require('docx');
const path = require('path');
const { buildCCRHeader } = require('./components/buildCCRHeader');
const { buildCCRCourseInfoTable } = require('./components/buildCCRCourseInfoTable');
const { buildCCRWeeklyPlanTable } = require('./components/buildCCRWeeklyPlanTable');
const { buildCCRAlternateTable } = require('./components/buildCCRAlternateTable');

const generateCCRWord = async (data) => {
  const doc = new Document({
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
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,    // 0.5 inch
            bottom: 720, // 0.5 inch
            left: 720,   // 0.5 inch
            right: 720   // 0.5 inch
          },
          size: {
            orientation: PageOrientation.LANDSCAPE,
            width: 16838, // A4 Landscape (swapped from portrait)
            height: 11906
          }
        }
      },
      children: [
        buildCCRHeader(path.join(__dirname, 'assets', 'logo.png')),
        new Paragraph({ text: "" }),
        buildCCRCourseInfoTable(data.courseInfo || {}),
        new Paragraph({ text: "" }),
        buildCCRWeeklyPlanTable(data.weeklyData || []),
        new Paragraph({ text: "" }),
        buildCCRAlternateTable(data.alternateData || [])
      ]
    }]
  });

  return await Packer.toBuffer(doc);
};

module.exports = { generateCCRWord };
