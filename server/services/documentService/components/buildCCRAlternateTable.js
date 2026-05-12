const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, VerticalAlign, BorderStyle } = require('docx');

const buildCCRAlternateTable = (alternateData) => {
  const cellMargin = 50;

  const createHeaderCell = (text) => {
    return new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: text, bold: true })], alignment: AlignmentType.CENTER })],
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: cellMargin, bottom: cellMargin, left: cellMargin, right: cellMargin }
    });
  };

  const titleRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Alternate Teacher/ Makeup Class", bold: true })], alignment: AlignmentType.CENTER })],
        columnSpan: 9,
        shading: { fill: "f1f5f9" },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: cellMargin, bottom: cellMargin }
      })
    ]
  });

  const dataRows = [];

  const colWidths = [5, 12, 8, 8, 32, 8, 7, 10, 10]; // Total 100%, matching Weekly Plan table exactly
  
  alternateData.forEach((row, index) => {
    const cells = [];
    
    // Helper to conditionally apply width only to the first row to set table grid
    const getCellProps = (wIdx) => index === 0 ? { width: { size: colWidths[wIdx], type: WidthType.PERCENTAGE } } : {};

    cells.push(new TableCell({ children: [new Paragraph({ text: row.rowNo?.toString() || (index + 1).toString(), alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin }, ...getCellProps(0) }));
    cells.push(new TableCell({ children: [new Paragraph({ text: row.scheduleDate || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin }, ...getCellProps(1) }));
    cells.push(new TableCell({ children: [new Paragraph({ text: row.timeIn || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin }, ...getCellProps(2) }));
    cells.push(new TableCell({ children: [new Paragraph({ text: row.timeOut || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin }, ...getCellProps(3) }));
    cells.push(new TableCell({ children: [new Paragraph({ text: row.topicCovered || "", alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin, left: cellMargin }, ...getCellProps(4) }));
    cells.push(new TableCell({ children: [new Paragraph({ text: row.activityType || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin }, ...getCellProps(5) }));
    cells.push(new TableCell({ children: [new Paragraph({ text: row.duration || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin }, ...getCellProps(6) }));
    cells.push(new TableCell({ children: [new Paragraph({ text: row.signature || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin }, ...getCellProps(7) }));
    cells.push(new TableCell({ children: [new Paragraph({ text: row.remarks || "", alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, margins: { top: cellMargin, bottom: cellMargin }, ...getCellProps(8) }));

    dataRows.push(new TableRow({ children: cells }));
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [titleRow, ...dataRows]
  });
};

module.exports = { buildCCRAlternateTable };
