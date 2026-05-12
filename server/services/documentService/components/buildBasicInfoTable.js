const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } = require('docx');

const buildBasicInfoTable = (courseInfo) => {
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
            children: [new Paragraph({ children: [new TextRun({ text: "1. Basic Information", bold: true })] })],
            columnSpan: 4,
            shading: { fill: "e2e8f0" }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ children: [new TextRun({ text: "Instructor", bold: true })] })],
            width: { size: 20, type: WidthType.PERCENTAGE }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: courseInfo?.instructor || "", alignment: AlignmentType.CENTER })],
            width: { size: 30, type: WidthType.PERCENTAGE }
          }),
          new TableCell({ 
            children: [new Paragraph({ children: [new TextRun({ text: "Designation", bold: true })] })],
            width: { size: 20, type: WidthType.PERCENTAGE }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: courseInfo?.designation || "", alignment: AlignmentType.CENTER })],
            width: { size: 30, type: WidthType.PERCENTAGE }
          }),
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Prerequisite(s)", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: courseInfo?.prerequisites || "", alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Semester", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: courseInfo?.semester || "", alignment: AlignmentType.CENTER })] }),
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Email", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: courseInfo?.email || "", alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Phone", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: courseInfo?.phone || "", alignment: AlignmentType.CENTER })] }),
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Consulting Hours", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: courseInfo?.consultingHours || "", alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Office Location", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: courseInfo?.officeLocation || "", alignment: AlignmentType.CENTER })] }),
        ]
      }),
    ]
  });
};

module.exports = { buildBasicInfoTable };
