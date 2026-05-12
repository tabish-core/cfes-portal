const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType } = require('docx');

const buildObjectivesAndContents = (courseInfo) => {
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "2. Course Objective(s)", bold: true })] })],
              shading: { fill: "e2e8f0" }
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: courseInfo?.courseObjectives || "" })] })
          ]
        })
      ]
    }),
    new Paragraph({ text: "" }),
    new Paragraph({ text: "" }),
    
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "3. Course Contents", bold: true })] })],
              shading: { fill: "e2e8f0" }
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: courseInfo?.courseContents || "" })] })
          ]
        })
      ]
    }),
    new Paragraph({ text: "" }),
    new Paragraph({ text: "" }),
  ];
};

module.exports = { buildObjectivesAndContents };
