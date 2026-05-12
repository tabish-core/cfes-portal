const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, VerticalAlign } = require('docx');

const buildOBATable = (obaTable) => {
  const titleRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "6. CLO Outcome Based Assessment (OBA) Tentative", bold: true })] })],
        columnSpan: 7,
        shading: { fill: "e2e8f0" }
      })
    ]
  });

  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Assessment Tool", bold: true })], alignment: AlignmentType.CENTER })], columnSpan: 2, verticalAlign: VerticalAlign.CENTER, shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CLO Mapped", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CLO Marks", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "% Weight", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total Marks", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Assessment Date", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
    ]
  });

  const dataRows = [];
  
  const categories = ["quizzes", "assignments", "midterm", "project/ccp", "final exam"];
  const groupedData = {};
  categories.forEach(c => groupedData[c] = { overallWeight: 0, items: [], assessmentDate: "" });

  if (Array.isArray(obaTable)) {
    obaTable.forEach(row => {
      const cat = (row.category || "").toLowerCase();
      if (groupedData[cat]) {
        groupedData[cat].items.push(row);
        groupedData[cat].assessmentDate = row.assessmentDate || groupedData[cat].assessmentDate;
        groupedData[cat].overallWeight = row.overallWeight || groupedData[cat].overallWeight;
      }
    });
  }

  categories.forEach((category, catIndex) => {
    const data = groupedData[category];
    const items = data.items || [];
    if (items.length === 0) return;

    items.forEach((item, index) => {
      const cells = [];
      if (index === 0) {
        cells.push(new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: category.toUpperCase(), bold: true })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: `${data.overallWeight || ""}`, bold: true })], alignment: AlignmentType.CENTER })
          ],
          rowSpan: items.length,
          verticalAlign: VerticalAlign.CENTER
        }));
      }

      cells.push(new TableCell({ children: [new Paragraph({ text: item.assessmentTool || "", alignment: AlignmentType.CENTER })] }));
      cells.push(new TableCell({ children: [new Paragraph({ text: item.cloMapped || "", alignment: AlignmentType.CENTER })] }));
      cells.push(new TableCell({ children: [new Paragraph({ text: item.cloMarks ? `${item.cloMarks}` : "", alignment: AlignmentType.CENTER })] }));
      cells.push(new TableCell({ children: [new Paragraph({ text: item.weightPercentage ? `${item.weightPercentage}%` : "", alignment: AlignmentType.CENTER })] }));
      cells.push(new TableCell({ children: [new Paragraph({ text: item.totalMarks ? `${item.totalMarks}` : "", alignment: AlignmentType.CENTER })] }));

      if (index === 0) {
        cells.push(new TableCell({
          children: [new Paragraph({ text: data.assessmentDate || "", alignment: AlignmentType.CENTER })],
          rowSpan: items.length,
          verticalAlign: VerticalAlign.CENTER
        }));
      }

      dataRows.push(new TableRow({ children: cells }));
    });

    // Total Row
    dataRows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: "" })] }),
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: `Total ${category.charAt(0).toUpperCase() + category.slice(1)} %`, bold: true })], alignment: AlignmentType.CENTER })],
          columnSpan: 3 
        }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "100%", bold: true })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${data.overallWeight || ""}`, bold: true })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: "" })] })
      ]
    }));

    // Blank Spacing Row (except for the last category)
    if (catIndex < categories.length - 1) {
      dataRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "" })], columnSpan: 7 })
        ]
      }));
    }
  });

  // Grand Total
  dataRows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "100", bold: true })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total Marks", bold: true })], alignment: AlignmentType.CENTER })], columnSpan: 4 }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "100", bold: true })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ text: "" })] })
    ]
  }));

  const footerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Note: Please make sure every CLO must be assessed at least 3 time.", italics: true })], alignment: AlignmentType.CENTER })],
        columnSpan: 7,
        shading: { fill: "f1f5f9" }
      })
    ]
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    rows: [titleRow, headerRow, ...dataRows, footerRow]
  });
};

module.exports = { buildOBATable };
