const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, TabStopType, TabStopPosition } = require('docx');

const buildGradingPolicyTable = (gradingPolicy) => {
  const items = [
    { label: "Quizzes", range: "10-15%", value: gradingPolicy?.quizzes },
    { label: "Assignments", range: "10-15%", value: gradingPolicy?.assignments },
    { label: "Projects/Presentation/CCP", range: "0-10%", value: gradingPolicy?.project },
    { label: "Mid Semester Examination", range: "20-30%", value: gradingPolicy?.midterm },
    { label: "End Semester Examination", range: "40-50%", value: gradingPolicy?.finalExam },
  ];

  const leftCellContent = items.map(item => new Paragraph({
    children: [
      new TextRun({ text: item.label }),
      new TextRun({ text: `\t${item.range}` })
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: 4300 }],
  }));

  const rightCellContent = items.map(item => new Paragraph({
    text: item.value ? `${item.value}%` : "",
    indent: { left: 144 }
  }));

  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "8. IU Assessment / grading Policy", bold: true })] })],
        shading: { fill: "e2e8f0" },
        width: { size: 50, type: WidthType.PERCENTAGE }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Instructor grading for course *", bold: true })] })],
        shading: { fill: "e2e8f0" },
        width: { size: 50, type: WidthType.PERCENTAGE }
      }),
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
    rows: [
      headerRow,
      new TableRow({
        children: [
          new TableCell({ children: leftCellContent, width: { size: 50, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: rightCellContent, width: { size: 50, type: WidthType.PERCENTAGE } })
        ]
      })
    ]
  });
};

module.exports = { buildGradingPolicyTable };
