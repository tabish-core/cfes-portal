const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ImageRun } = require('docx');
const fs = require('fs');
const path = require('path');

const buildHeader = async (logoPath) => {
  let logoImage;
  
  if (logoPath && fs.existsSync(logoPath)) {
    logoImage = new ImageRun({
      data: fs.readFileSync(logoPath),
      transformation: {
        width: 176,
        height: 41,
      },
    });
  }

  return [
    new Paragraph({
      children: [
        logoImage ? logoImage : new TextRun({ text: "IQRA UNIVERSITY IU", bold: true, size: 36, color: "1a56db" })
      ],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "BS(CS)V1.1", color: "64748b", size: 18 })
      ],
      alignment: AlignmentType.RIGHT
    })
  ];
};

module.exports = { buildHeader };
