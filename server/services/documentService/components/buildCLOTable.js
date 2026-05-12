const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, VerticalAlign, VerticalMergeType } = require('docx');

const buildCLOTable = (cloData) => {
  const titleRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "4. Course Learning Outcomes", bold: true })] })],
        columnSpan: 7,
        shading: { fill: "e2e8f0" }
      })
    ]
  });

  const headerRow1 = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CLOs", bold: true })], alignment: AlignmentType.CENTER })], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CLO Statement", bold: true })], alignment: AlignmentType.CENTER })], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "BT Level", bold: true })], alignment: AlignmentType.CENTER })], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Mapping", bold: true })], alignment: AlignmentType.CENTER })], columnSpan: 3, shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "% Weight", bold: true })], alignment: AlignmentType.CENTER })], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, shading: { fill: "f1f5f9" } }),
    ]
  });

  const headerRow2 = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "GAs", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ACM KA", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "SGDs", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
    ]
  });

  const dataRows = cloData.map((clo, index) => {
    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: clo.cloNumber || "" })] }),
        new TableCell({ children: [new Paragraph({ text: clo.cloStatement || "" })] }),
        new TableCell({ children: [new Paragraph({ text: clo.btLevel || "", alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: clo.gaMapping || "", alignment: AlignmentType.CENTER })] }),
        new TableCell({ 
          children: [new Paragraph({ text: clo.acmKaMapping || "", alignment: AlignmentType.CENTER })],
          verticalMerge: index === 0 ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE
        }),
        new TableCell({ 
          children: [new Paragraph({ text: clo.sgdMapping || "", alignment: AlignmentType.CENTER })],
          verticalMerge: index === 0 ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE
        }),
        new TableCell({ children: [new Paragraph({ text: clo.weightPercentage ? `${clo.weightPercentage}%` : "", alignment: AlignmentType.CENTER })] }),
      ]
    });
  });

  const footerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Note: On successful completion of course GA1 (Academic Education) will automatically attain.", italics: true })] })],
        columnSpan: 7,
        shading: { fill: "f1f5f9" }
      })
    ]
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: {
      top: 100,
      bottom: 100,
      left: 100,
      right: 100,
    },
    rows: [titleRow, headerRow1, headerRow2, ...dataRows, footerRow]
  });
};

module.exports = { buildCLOTable };
