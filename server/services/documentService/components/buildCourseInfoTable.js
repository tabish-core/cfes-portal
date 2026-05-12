const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } = require('docx');

const buildCourseInfoTable = (courseInfo) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: {
      top: 50,
      bottom: 50,
      left: 100,
      right: 100,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "IQRA University (IU)", bold: true })], alignment: AlignmentType.CENTER })],
            columnSpan: 3,
            shading: { fill: "e2e8f0" }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Faculty of Engineering Sciences and Technology (FEST)", bold: true })], alignment: AlignmentType.CENTER })],
            columnSpan: 3,
            shading: { fill: "e2e8f0" }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Computer Science Department (CS)", bold: true })], alignment: AlignmentType.CENTER })],
            columnSpan: 3,
            shading: { fill: "e2e8f0" }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ children: [new TextRun({ text: "Course Code", bold: true })], alignment: AlignmentType.CENTER })],
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: "e2e8f0" }
          }),
          new TableCell({ 
            children: [new Paragraph({ children: [new TextRun({ text: "Course Name", bold: true })], alignment: AlignmentType.CENTER })],
            width: { size: 60, type: WidthType.PERCENTAGE },
            shading: { fill: "e2e8f0" }
          }),
          new TableCell({ 
            children: [new Paragraph({ children: [new TextRun({ text: "Credit Hr", bold: true })], alignment: AlignmentType.CENTER })],
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: "e2e8f0" }
          }),
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: courseInfo?.courseCode || "", alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: courseInfo?.courseName || "", alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: courseInfo?.creditHours || "", alignment: AlignmentType.CENTER })] }),
        ]
      })
    ]
  });
};

module.exports = { buildCourseInfoTable };
