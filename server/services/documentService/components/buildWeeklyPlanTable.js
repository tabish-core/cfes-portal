const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, VerticalAlign, BorderStyle } = require('docx');

const buildWeeklyPlanTable = (weeklyData) => {
  const titleRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "7. Weekly Plan", bold: true })] })],
        columnSpan: 5,
        shading: { fill: "e2e8f0" }
      })
    ]
  });

  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Week", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Lecture No", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Topic Covered", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CLO", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Assessment Tool", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, shading: { fill: "f1f5f9" } }),
    ]
  });

  const dataRows = [];
  let currentWeek = null;

  // Calculate spans for Week column
  const weekSpans = {};
  weeklyData.forEach(row => {
    if (!row.isSpecialRow && row.week) {
      weekSpans[row.week] = (weekSpans[row.week] || 0) + 1;
    }
  });

  weeklyData.forEach((row, index) => {
    if (row.isSpecialRow) {
      dataRows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: row.week || (index + 1).toString(), bold: true })], alignment: AlignmentType.CENTER })],
            shading: { fill: "e2e8f0" },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: row.specialRowText || "", bold: true })], alignment: AlignmentType.CENTER })],
            columnSpan: 4,
            shading: { fill: "e2e8f0" },
            verticalAlign: VerticalAlign.CENTER
          })
        ]
      }));

      currentWeek = null; // Reset span tracking
    } else {
      const cells = [];
      
      // Handle Week column with rowSpan
      if (row.week !== currentWeek) {
        currentWeek = row.week;
        cells.push(new TableCell({
          children: [new Paragraph({ text: row.week || "", alignment: AlignmentType.CENTER })],
          rowSpan: weekSpans[row.week] || 1,
          verticalAlign: VerticalAlign.CENTER
        }));
      }

      cells.push(new TableCell({ children: [new Paragraph({ text: row.lectureNo || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }));
      cells.push(new TableCell({ children: [new Paragraph({ text: row.topicCovered || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }));
      cells.push(new TableCell({ children: [new Paragraph({ text: row.clo || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }));
      cells.push(new TableCell({ children: [new Paragraph({ text: row.assessmentTool || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }));

      dataRows.push(new TableRow({ children: cells }));
    }
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: {
      top: 50,
      bottom: 50,
      left: 100,
      right: 100,
    },
    rows: [titleRow, headerRow, ...dataRows]
  });
};

module.exports = { buildWeeklyPlanTable };
