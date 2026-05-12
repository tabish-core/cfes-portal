const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, VerticalAlign, BorderStyle } = require('docx');

const buildCCRCourseInfoTable = (courseInfo) => {
  const cellMargin = 50;
  
  const createCell = (text, isHeader = false, widthPct = null) => {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text: text || "", bold: isHeader })],
          alignment: isHeader ? AlignmentType.LEFT : AlignmentType.CENTER
        })
      ],
      width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: cellMargin, bottom: cellMargin, left: cellMargin, right: cellMargin }
    });
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createCell("NAME OF FACULTY MEMBER", true, 33),
          createCell(courseInfo.facultyName, false, 32),
          createCell("Session Days", true, 15),
          createCell(courseInfo.sessionDay, false, 20)
        ]
      }),
      new TableRow({
        children: [
          createCell("PROGRAM", true, 33),
          createCell(courseInfo.program, false, 32),
          createCell("Time Slot", true, 15),
          createCell(courseInfo.timeSlot, false, 20)
        ]
      }),
      new TableRow({
        children: [
          createCell("COURSE TITLE", true, 33),
          createCell(courseInfo.courseTitle, false, 32),
          createCell("Location", true, 15),
          createCell(courseInfo.location, false, 20)
        ]
      }),
      new TableRow({
        children: [
          createCell("EDP CODE", true, 33),
          createCell(courseInfo.edpCode, false, 32),
          createCell("Course Code", true, 15),
          createCell(courseInfo.courseCode, false, 20)
        ]
      })
    ]
  });
};

module.exports = { buildCCRCourseInfoTable };
