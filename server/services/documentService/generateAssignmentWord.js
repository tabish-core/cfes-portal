const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, VerticalAlign, BorderStyle, ImageRun, Numbering } = require('docx');
const path = require('path');
const fs = require('fs');

const generateAssignmentWord = async (data) => {
  const { 
    assignmentInfo = {}, 
    courseInfo = {}, 
    cloMappings = [], 
    assignmentTitle = "", 
    objective = "", 
    assignmentDescription = "", 
    tasks = [], 
    submissionGuidelines = [], 
    evaluationCriteria = [], 
    tipsForSuccess = [] 
  } = data;

  // Helpers
  const createBorder = (color = "000000", size = 4) => ({
    style: BorderStyle.SINGLE,
    size: size,
    color: color,
  });

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  // Logo Setup
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  let logoElement;
  if (fs.existsSync(logoPath)) {
    logoElement = new Paragraph({
      children: [
        new ImageRun({
          data: fs.readFileSync(logoPath),
          transformation: { width: 300, height: 70 },
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 }
    });
  } else {
    logoElement = new Paragraph({
      children: [new TextRun({ text: "IQRA UNIVERSITY IU", bold: true, size: 36, color: "1a56db" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 }
    });
  }

  // 1. Header Table (Logo + Faculty Text + Version)
  const headerSection = [
    logoElement,
    new Paragraph({
      children: [
        new TextRun({ text: "FACULTY OF ENGINEERING SCIENCES AND TECHNOLOGY", bold: true, size: 28, color: "6b7280" }) // Grayish color
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "BS(CS)V1.0", size: 20, color: "6b7280" })
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 }
    })
  ];

  // 2. Department & Program row (No borders)
  const deptProgTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Department: ", size: 22 }),
                  new TextRun({ text: courseInfo.department || "", bold: true, size: 22 })
                ]
              })
            ]
          }),
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Program: ", size: 22 }),
                  new TextRun({ text: courseInfo.program || "", bold: true, size: 22 })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // 3. Course Title Box (Blue border, solid fill or just thick border)
  const courseTitleTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: createBorder("000000", 24),
      bottom: createBorder("000000", 24),
      left: createBorder("000000", 24),
      right: createBorder("000000", 24),
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "b4c6e7" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: (courseInfo.courseTitle || "COURSE TITLE").toUpperCase(), bold: true, size: 24 })
                ]
              })
            ],
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
          })
        ]
      })
    ]
  });

  // 4. Announced Date, Due Date, Max Marks (No borders)
  const infoRowTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Announced date: ", size: 22 }), new TextRun({ text: assignmentInfo.announcementDate || "", size: 20 })] })]
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Due Date: ", size: 22 }), new TextRun({ text: assignmentInfo.dueDate || "", size: 20 })] })]
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Max Marks: ", size: 22 }), new TextRun({ text: assignmentInfo.maxMarks || "", size: 20 })] })]
          })
        ]
      })
    ]
  });

  // 5. CLO Mapping Table
  const buildCLOTable = () => {
    const tableHeaderRows = [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            shading: { fill: "b4c6e7" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: assignmentInfo.assignmentNumber || "Assignment #", bold: true, size: 24 })]
              })
            ],
            margins: { top: 100, bottom: 100 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mapped CLO", bold: true, size: 22 })] })],
            margins: { top: 100, bottom: 100 },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mapped GA", bold: true, size: 22 })] })],
            margins: { top: 100, bottom: 100 },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mapped Learning Level", bold: true, size: 22 })] })],
            margins: { top: 100, bottom: 100 },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SDG", bold: true, size: 22 })] })],
            margins: { top: 100, bottom: 100 },
            verticalAlign: VerticalAlign.CENTER
          })
        ]
      })
    ];

    const dataRows = cloMappings.map(mapping => 
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mapping.mappedCLO || "", size: 20 })] })],
            margins: { top: 150, bottom: 150 },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mapping.mappedGA || "", size: 20 })] })],
            margins: { top: 150, bottom: 150 },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mapping.mappedLearningLevel || "", size: 20 })] })],
            margins: { top: 150, bottom: 150 },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mapping.sdg || "", size: 20 })] })],
            margins: { top: 150, bottom: 150 },
            verticalAlign: VerticalAlign.CENTER
          })
        ]
      })
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: createBorder(), bottom: createBorder(), left: createBorder(), right: createBorder(),
        insideHorizontal: createBorder(), insideVertical: createBorder()
      },
      rows: [...tableHeaderRows, ...dataRows]
    });
  };

  // Helper to build list items
  const buildBulletList = (items) => {
    if (!items || items.length === 0) return [new Paragraph({ text: "None", size: 24 })];
    return items.map(item => new Paragraph({
      text: item,
      bullet: { level: 0 },
      spacing: { after: 120 }
    }));
  };

  const buildNumberedList = (items) => {
    if (!items || items.length === 0) return [new Paragraph({ text: "None", size: 24 })];
    return items.map(item => new Paragraph({
      text: item,
      numbering: { reference: "numbered-list", level: 0 },
      spacing: { after: 120 }
    }));
  };

  // 6. Content Section
  const contentSection = [
    new Paragraph({
      children: [
        new TextRun({ text: "Assignment Title: ", bold: true, size: 24 }),
        new TextRun({ text: assignmentTitle || "", size: 24 })
      ],
      spacing: { before: 200, after: 120 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Objective: ", bold: true, size: 24 }),
        new TextRun({ text: objective || "", size: 24 })
      ],
      spacing: { before: 120, after: 120 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Assignment Description: ", bold: true, size: 24 }),
        new TextRun({ text: assignmentDescription || "", size: 24 })
      ],
      spacing: { before: 120, after: 200 }
    }),
    new Paragraph({ children: [new TextRun({ text: "Tasks to Complete:", bold: true, size: 24 })], spacing: { after: 120 } }),
    ...buildNumberedList(tasks),
    new Paragraph({ children: [new TextRun({ text: "Submission Guidelines:", bold: true, size: 24 })], spacing: { before: 200, after: 120 } }),
    ...buildBulletList(submissionGuidelines),
    new Paragraph({ children: [new TextRun({ text: "Evaluation Criteria:", bold: true, size: 24 })], spacing: { before: 200, after: 120 } }),
    ...buildBulletList(evaluationCriteria),
    new Paragraph({ children: [new TextRun({ text: "Tips for Success:", bold: true, size: 24 })], spacing: { before: 200, after: 120 } }),
    ...buildBulletList(tipsForSuccess)
  ];

  // Compile Document
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 24, // 12pt
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "numbered-list",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 }, // 0.5 inch indent
                },
              },
            },
          ],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 },
        }
      },
      children: [
        ...headerSection,
        new Paragraph({ text: "" }),
        deptProgTable,
        new Paragraph({ text: "" }),
        courseTitleTable,
        new Paragraph({ text: "" }),
        infoRowTable,
        new Paragraph({ text: "" }),
        buildCLOTable(),
        new Paragraph({ text: "" }),
        ...contentSection
      ]
    }]
  });

  return await Packer.toBuffer(doc);
};

module.exports = { generateAssignmentWord };
