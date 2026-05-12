const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, VerticalAlign, BorderStyle } = require('docx');

const buildCCRWeeklyPlanTable = (weeklyData) => {
  const cellMargin = 50;

  const colWidths = [5, 12, 8, 8, 32, 8, 7, 10, 10]; // Sums to 100%

  const createHeaderCell = (text, widthIdx) => {
    return new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: text, bold: true })], alignment: AlignmentType.CENTER })],
      width: widthIdx !== undefined ? { size: colWidths[widthIdx], type: WidthType.PERCENTAGE } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: cellMargin, bottom: cellMargin, left: cellMargin, right: cellMargin }
    });
  };

  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Week", bold: true })], alignment: AlignmentType.CENTER }), new Paragraph({ children: [new TextRun({ text: "No.", bold: true })], alignment: AlignmentType.CENTER })], width: { size: colWidths[0], type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
      createHeaderCell("Schedule Date", 1),
      createHeaderCell("Time In", 2),
      createHeaderCell("Time Out", 3),
      createHeaderCell("Topic Covered", 4),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "*Q/A/CP/", bold: true })], alignment: AlignmentType.CENTER }), new Paragraph({ children: [new TextRun({ text: "MT/FE", bold: true })], alignment: AlignmentType.CENTER })], width: { size: colWidths[5], type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
      createHeaderCell("Duration", 6),
      createHeaderCell("Signature", 7),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Remarks/", bold: true })], alignment: AlignmentType.CENTER }), new Paragraph({ children: [new TextRun({ text: "Comments", bold: true })], alignment: AlignmentType.CENTER })], width: { size: colWidths[8], type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
    ]
  });

  const dataRows = [];
  let currentWeek = null;

  // Calculate spans for Week No and Duration
  const weekSpans = {};
  weeklyData.forEach(row => {
    if (!row.isSpecialRow && row.weekNo) {
      weekSpans[row.weekNo] = (weekSpans[row.weekNo] || 0) + 1;
    }
  });

  weeklyData.forEach((row, index) => {
    if (row.isSpecialRow) {
      dataRows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: row.weekNo || "", bold: true })], alignment: AlignmentType.CENTER })],
            shading: { fill: "e2e8f0" },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: cellMargin, bottom: cellMargin }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: row.specialRowText || "", bold: true })], alignment: AlignmentType.CENTER })],
            columnSpan: 4,
            shading: { fill: "e2e8f0" },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: cellMargin, bottom: cellMargin }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: row.activityType || "", bold: true })], alignment: AlignmentType.CENTER })],
            shading: { fill: "e2e8f0" },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: cellMargin, bottom: cellMargin }
          }),
          new TableCell({
            children: [new Paragraph({ text: "" })],
            columnSpan: 3,
            shading: { fill: "e2e8f0" },
            verticalAlign: VerticalAlign.CENTER
          })
        ]
      }));
      currentWeek = null; // Reset span tracking
    } else {
      const cells = [];
      
      // Handle Week column with rowSpan
      if (row.weekNo !== currentWeek) {
        currentWeek = row.weekNo;
        cells.push(new TableCell({
          children: [new Paragraph({ text: row.weekNo || "", alignment: AlignmentType.CENTER })],
          rowSpan: weekSpans[row.weekNo] || 1,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: cellMargin, bottom: cellMargin }
        }));
      }

      cells.push(new TableCell({ children: [new Paragraph({ text: row.scheduleDate || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin } }));
      cells.push(new TableCell({ children: [new Paragraph({ text: row.timeIn || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin } }));
      cells.push(new TableCell({ children: [new Paragraph({ text: row.timeOut || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin } }));
      cells.push(new TableCell({ children: [new Paragraph({ text: row.topicCovered || "", alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin, left: cellMargin } }));
      cells.push(new TableCell({ children: [new Paragraph({ text: row.activityType || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin } }));

      // Duration is also merged per week
      if (row.weekNo === currentWeek && (!weekSpans[row.weekNo] || weekSpans[row.weekNo] === 1 || Object.keys(cells).length === 6)) { // It means we just added weekNo, so it's the first row
         cells.push(new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: row.duration || "", bold: true })], alignment: AlignmentType.CENTER })],
          rowSpan: weekSpans[row.weekNo] || 1,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: cellMargin, bottom: cellMargin }
        }));
      }

      cells.push(new TableCell({ children: [new Paragraph({ text: row.signature || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin } }));
      cells.push(new TableCell({ children: [new Paragraph({ text: row.remarks || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin } }));

      dataRows.push(new TableRow({ children: cells }));
    }
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows]
  });
};

module.exports = { buildCCRWeeklyPlanTable };
