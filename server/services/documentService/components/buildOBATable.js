const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, VerticalAlign } = require('docx');

const buildOBATable = (obaTable) => {
  const createCell = (text, bold = false, widthPercent = null, colSpan = 1, rowSpan = 1, shading = null, alignment = AlignmentType.CENTER) => {
    const options = {
      children: [new Paragraph({ children: [new TextRun({ text, bold })], alignment })],
      columnSpan: colSpan,
      rowSpan: rowSpan,
      verticalAlign: VerticalAlign.CENTER,
    };
    if (widthPercent) {
      options.width = { size: widthPercent, type: WidthType.PERCENTAGE };
    }
    if (shading) {
      options.shading = { fill: shading };
    }
    return new TableCell(options);
  };

  const titleRow = new TableRow({
    children: [
      createCell("6. CLO Outcome Based Assessment (OBA) Tentative", true, 100, 7, 1, "e2e8f0", AlignmentType.LEFT)
    ]
  });

  const headerRow = new TableRow({
    children: [
      createCell("Assessment Tool", true, 25, 2, 1, "f1f5f9"),
      createCell("CLO Mapped", true, 15, 1, 1, "f1f5f9"),
      createCell("CLO Marks", true, 10, 1, 1, "f1f5f9"),
      createCell("% Weight", true, 10, 1, 1, "f1f5f9"),
      createCell("Total Marks", true, 10, 1, 1, "f1f5f9"),
      createCell("Assessment Date", true, 30, 1, 1, "f1f5f9"),
    ]
  });

  const dataRows = [];
  
  const groupedData = {};
  const categoriesInOrder = []; // To keep track of the order categories appear

  if (Array.isArray(obaTable)) {
    obaTable.forEach(row => {
      if (!row.category) return;
      const cat = row.category.toLowerCase();
      if (!groupedData[cat]) {
        groupedData[cat] = { 
          categoryName: row.category.charAt(0).toUpperCase() + row.category.slice(1),
          overallWeight: 0, 
          items: [], 
          assessmentDate: "" 
        };
        categoriesInOrder.push(cat);
      }
      groupedData[cat].items.push(row);
      groupedData[cat].assessmentDate = row.assessmentDate || groupedData[cat].assessmentDate;
      groupedData[cat].overallWeight += (Number(row.weightPercentage) || 0);
    });
  }

  categoriesInOrder.forEach((catKey, catIndex) => {
    const data = groupedData[catKey];
    const items = data.items || [];
    if (items.length === 0) return;

    const catLower = data.categoryName.toLowerCase();
    const mergeDate = !(catLower.includes('quiz') || catLower.includes('assignment'));

    items.forEach((item, index) => {
      const cells = [];
      if (index === 0) {
        cells.push(new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: data.categoryName, bold: true })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: `${data.overallWeight || ""}`, bold: true })], alignment: AlignmentType.CENTER })
          ],
          rowSpan: items.length,
          width: { size: 12, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER
        }));
      }

      cells.push(createCell(item.assessmentTool || "", false, index === 0 ? 13 : 13));
      cells.push(createCell(item.cloMapped || "", false, 15));
      cells.push(createCell(item.cloMarks ? `${item.cloMarks}` : "", false, 10));
      cells.push(createCell(item.weightPercentage ? `${item.weightPercentage}%` : "", false, 10));
      cells.push(createCell(item.totalMarks ? `${item.totalMarks}` : "", false, 10));
      
      if (mergeDate) {
        if (index === 0) {
          cells.push(createCell(data.assessmentDate || "", true, 30, 1, items.length)); // Bold merged date
        }
      } else {
        cells.push(createCell(item.assessmentDate || "", false, 30));
      }

      dataRows.push(new TableRow({ children: cells }));
    });

    // Total Row
    dataRows.push(new TableRow({
      children: [
        createCell("", false, 12, 1, 1, "f8fafc"),
        createCell(`Total ${data.categoryName} %`, true, 38, 3, 1, "f8fafc"),
        createCell("100%", true, 10, 1, 1, "f8fafc"),
        createCell(`${data.overallWeight || ""}`, true, 10, 1, 1, "f8fafc"),
        createCell("", false, 30, 1, 1, "f8fafc")
      ]
    }));

    // Blank Spacing Row (except for the last category)
    if (catIndex < categoriesInOrder.length - 1) {
      dataRows.push(new TableRow({
        children: [
          createCell("", false, 100, 7)
        ]
      }));
    }
  });

  // Grand Total
  dataRows.push(new TableRow({
    children: [
      createCell("100", true, 12, 1, 1, "f1f5f9"),
      createCell("Total Marks", true, 48, 4, 1, "f1f5f9"),
      createCell("100", true, 10, 1, 1, "f1f5f9"),
      createCell("", false, 30, 1, 1, "f1f5f9")
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
