const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, VerticalAlign, ImageRun } = require('docx');
const fs = require('fs');

const buildCCRHeader = (logoPath) => {
  let logoElement;
  
  if (logoPath && fs.existsSync(logoPath)) {
    logoElement = new Paragraph({
      children: [
        new ImageRun({
          data: fs.readFileSync(logoPath),
          transformation: {
            width: 300,
            height: 70,
          },
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 50, after: 50 }
    });
  } else {
    logoElement = new Paragraph({
      children: [new TextRun({ text: "IQRA UNIVERSITY IU", bold: true, size: 36, color: "1a56db" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 50, after: 50 }
    });
  }

  const cellMargin = 50;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [logoElement],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: cellMargin, bottom: cellMargin }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Faculty of Engineering Sciences and Technology", bold: true, size: 24 })], // size is half-points, 24 = 12pt
                alignment: AlignmentType.CENTER
              })
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: cellMargin, bottom: cellMargin }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "COURSE CONTROL REPORT", bold: true, size: 22 })],
                alignment: AlignmentType.CENTER
              })
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: cellMargin, bottom: cellMargin }
          })
        ]
      })
    ]
  });
};

module.exports = { buildCCRHeader };
