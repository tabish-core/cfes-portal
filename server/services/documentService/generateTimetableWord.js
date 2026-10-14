/**
 * generateTimetableWord.js — Generates an A4 Landscape Word document (.docx) matching the official Class Schedule and Counseling Hours format.
 */
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalAlign,
  BorderStyle,
  PageOrientation,
  ImageRun
} = require('docx');
const fs = require('fs');
const path = require('path');
const { DAYS_OF_WEEK } = require('../../models/Timetable.model');
const { timeToMinutes } = require('../timetable.validator');

const cellMargin = 70;

const DAY_LABELS = {
  Monday: 'MON',
  Tuesday: 'TUES',
  Wednesday: 'WED',
  Thursday: 'THUR',
  Friday: 'FRI',
  Saturday: 'SAT',
  Sunday: 'SUN',
  MON: 'MON',
  TUES: 'TUES',
  WED: 'WED',
  THUR: 'THUR',
  FRI: 'FRI',
  SAT: 'SAT',
  SUN: 'SUN'
};

const createTextCell = (text, options = {}) => {
  const {
    bold = false,
    size = 20, // 10pt
    alignment = AlignmentType.CENTER,
    widthPct = undefined,
    columnSpan = undefined,
    shadingColor = undefined,
    color = '000000'
  } = options;

  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text !== undefined && text !== null ? String(text) : '',
            bold,
            size,
            color
          })
        ],
        alignment
      })
    ],
    width: widthPct !== undefined ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    columnSpan,
    shading: shadingColor ? { fill: shadingColor } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: cellMargin, bottom: cellMargin, left: cellMargin, right: cellMargin }
  });
};

const buildTimetableHeader = (logoPath, department, schoolName, academicTerm) => {
  let logoElement;
  if (logoPath && fs.existsSync(logoPath)) {
    logoElement = new Paragraph({
      children: [
        new ImageRun({
          data: fs.readFileSync(logoPath),
          transformation: {
            width: 250,
            height: 60
          }
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 40 }
    });
  } else {
    logoElement = new Paragraph({
      children: [
        new TextRun({ text: 'IQRA UNIVERSITY IU', bold: true, size: 28, color: '1e3a8a' })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 40 }
    });
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              logoElement,
              new Paragraph({
                children: [
                  new TextRun({
                    text: department || 'Department of Computer Science',
                    bold: true,
                    size: 24,
                    color: '000000'
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 20 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: schoolName || 'Faculty of Engineering Sciences and Technology',
                    bold: true,
                    size: 23,
                    color: '000000'
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${academicTerm} Class Schedule and Counseling Hours`,
                    bold: true,
                    size: 24,
                    color: '000000'
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 }
              })
            ],
            verticalAlign: VerticalAlign.CENTER
          })
        ]
      })
    ]
  });
};

const buildFacultyInfoBar = (facultyName, designation) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `Name: ${facultyName || ''}`, bold: true, size: 21, color: '000000' })
                ],
                alignment: AlignmentType.LEFT
              })
            ],
            width: { size: 50, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `Designation: ${designation || ''}`, bold: true, size: 21, color: '000000' })
                ],
                alignment: AlignmentType.RIGHT
              })
            ],
            width: { size: 50, type: WidthType.PERCENTAGE }
          })
        ]
      })
    ]
  });
};

const generateTimetableWord = async (timetable) => {
  const logoPath = path.join(__dirname, 'assets', 'logo.png');

  const timeSlots = [...(timetable.timeSlots || [])];
  timeSlots.sort((a, b) => (timeToMinutes(a.startTime) || 0) - (timeToMinutes(b.startTime) || 0));

  const slotIndexMap = new Map();
  timeSlots.forEach((slot, idx) => {
    slotIndexMap.set(slot.slotId, idx);
  });
  const slotCount = timeSlots.length;

  const academicTerm = timetable.facultyInfo?.academicTerm ||
    (timetable.semester && timetable.semester.name ? timetable.semester.name : 'Current Term');

  const department = timetable.facultyInfo?.department || 'Department of Computer Science';
  const schoolName = timetable.facultyInfo?.facultySchool || 'Faculty of Engineering Sciences and Technology';
  const facultyName = timetable.facultyInfo?.facultyName || '';
  const designation = timetable.facultyInfo?.designation || '';

  // Table widths
  const dayColPct = 10;
  const remainingPct = 90;
  const slotColPct = slotCount > 0 ? Math.floor(remainingPct / slotCount) : remainingPct;

  const headerCells = [
    createTextCell('Days', { bold: true, size: 20, alignment: AlignmentType.CENTER, widthPct: dayColPct, color: '000000' })
  ];

  timeSlots.forEach((slot) => {
    const headerText = slot.label ? `${slot.label}\n${slot.startTime}-${slot.endTime}` : `${slot.startTime}-${slot.endTime}`;
    headerCells.push(
      createTextCell(headerText, {
        bold: true,
        size: 19,
        alignment: AlignmentType.CENTER,
        widthPct: slotColPct,
        color: '000000'
      })
    );
  });

  const gridRows = [new TableRow({ children: headerCells })];

  // Days configuration
  let daysConfig = timetable.days && timetable.days.length > 0
    ? timetable.days
    : DAYS_OF_WEEK.map((d) => ({ day: d, isOffDay: ['Saturday', 'Sunday'].includes(d) }));

  const activities = timetable.activities || [];

  daysConfig.forEach((dayCfg) => {
    const dayName = dayCfg.day;
    const dayLabel = DAY_LABELS[dayName] || dayName;

    const rowCells = [
      createTextCell(dayLabel, { bold: true, size: 20, alignment: AlignmentType.CENTER, widthPct: dayColPct, color: '000000' })
    ];

    if (dayCfg.isOffDay) {
      rowCells.push(
        createTextCell('OFF DAY', {
          bold: true,
          size: 20,
          alignment: AlignmentType.CENTER,
          columnSpan: Math.max(1, slotCount),
          shadingColor: 'b0b0b0',
          color: '000000'
        })
      );
    } else {
      const dayActivities = activities.filter((a) => a.day === dayName);
      const actByStart = new Map();
      dayActivities.forEach((act) => {
        const sIdx = slotIndexMap.get(act.startSlotId);
        const eIdx = slotIndexMap.get(act.endSlotId);
        if (sIdx !== undefined && eIdx !== undefined && eIdx >= sIdx) {
          actByStart.set(sIdx, {
            activity: act,
            startIdx: sIdx,
            endIdx: eIdx,
            colspan: eIdx - sIdx + 1
          });
        }
      });

      let k = 0;
      while (k < slotCount) {
        if (actByStart.has(k)) {
          const item = actByStart.get(k);
          const act = item.activity;

          const cellParagraphs = [
            new Paragraph({
              children: [
                new TextRun({ text: act.title || 'Scheduled Activity', bold: true, size: 19, color: '000000' })
              ],
              alignment: AlignmentType.CENTER
            })
          ];

          if (act.venue) {
            cellParagraphs.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `(${act.venue})`, bold: true, size: 18, color: '000000' })
                ],
                alignment: AlignmentType.CENTER
              })
            );
          }

          rowCells.push(
            new TableCell({
              children: cellParagraphs,
              columnSpan: item.colspan,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: cellMargin, bottom: cellMargin, left: cellMargin, right: cellMargin }
            })
          );
          k = item.endIdx + 1;
        } else {
          rowCells.push(
            createTextCell('', {
              widthPct: slotColPct,
              alignment: AlignmentType.CENTER
            })
          );
          k++;
        }
      }
    }

    gridRows.push(new TableRow({ children: rowCells }));
  });

  const timetableGridTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: gridRows
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 20
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720
            },
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 16838,
              height: 11906
            }
          }
        },
        children: [
          buildTimetableHeader(logoPath, department, schoolName, academicTerm),
          new Paragraph({ text: '', spacing: { after: 40 } }),
          buildFacultyInfoBar(facultyName, designation),
          new Paragraph({ text: '', spacing: { after: 80 } }),
          timetableGridTable
        ]
      }
    ]
  });

  return await Packer.toBuffer(doc);
};

module.exports = {
  generateTimetableWord
};
