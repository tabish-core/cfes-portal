const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const cheerio = require('cheerio');

const OBE_THEME = {
  darkBlue: { argb: 'FF2D578B' }, // A guess for the dark blue headers
  lightBlue: { argb: 'FF8CB4E2' }, // A guess for the light blue cells
  warningRed: { argb: 'FFFF0000' },
  lightYellow: { argb: 'FFFFFF99' },
  white: { argb: 'FFFFFFFF' },
  black: { argb: 'FF000000' },
  border: {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  }
};

const applyStyle = (cell, { bg, color, bold, border, align = 'center' }) => {
  if (bg) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
  }
  if (color || bold) {
    cell.font = {
      color: color || OBE_THEME.black,
      bold: !!bold,
      name: 'Times New Roman', // Official looking font
      size: 11
    };
  }
  if (border) {
    cell.border = OBE_THEME.border;
  }
  if (align) {
    cell.alignment = { vertical: 'middle', horizontal: align, wrapText: true };
  }
};

/**
 * Generates the OBE Award List Excel workbook.
 *
 * @param {Object} params
 * @param {Object} params.course - CourseOffering document
 * @param {Object} params.config - OBEConfiguration document
 * @param {Array} params.assessments - Array of OBEAssessment documents
 * @param {Array} params.marks - Array of OBEMark documents
 * @param {Object} params.results - Calculated results from obeCalculationService
 * @returns {Promise<ExcelJS.Workbook>}
 */
exports.generateOBEExcel = async ({ course, config, assessments, marks, results }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CFES Portal';
  workbook.created = new Date();

  // Create exactly one worksheet
  const sheet = workbook.addWorksheet('OBE Award List', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      margins: {
        left: 0.7, right: 0.7,
        top: 0.75, bottom: 0.75,
        header: 0.3, footer: 0.3
      }
    },
    views: [{ showGridLines: false }]
  });

  // Set default column widths
  for (let i = 1; i <= 30; i++) {
    sheet.getColumn(i).width = 8; // Narrow columns for flexibility
  }
  // S/No, Reg No, Name might need more width
  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 25;

  // 1. Logo
  const logoPath = path.resolve(__dirname, '../../services/documentService/assets/obelogo.jpg');
  if (!fs.existsSync(logoPath)) {
    throw new Error('OBE Logo asset not found at ' + logoPath);
  }

  const logoId = workbook.addImage({
    filename: logoPath,
    extension: 'jpeg'
  });

  // The logo spans B1:E12 visually. Use ext to avoid stretching.
  sheet.addImage(logoId, {
    tl: { col: 1, row: 0.2 }, // Slightly offset from top left of B1
    ext: { width: 300, height: 170 }, // Aspect ratio for the oval logo
    editAs: 'absolute'
  });

  // Row 4: Title
  let semesterText = 'FALL 2024';
  if (course.semester && course.semester.name) {
    semesterText = course.semester.name;
  } else if (typeof course.semester === 'string') {
    semesterText = course.semester;
  }
  semesterText = semesterText.toUpperCase();

  sheet.mergeCells('E4:Q5');
  const titleCell = sheet.getCell('E4');
  titleCell.value = `OBE AWARD LIST - ${semesterText}`;
  titleCell.font = { name: 'Times New Roman', size: 28, bold: true, underline: true };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 6: Warning
  sheet.mergeCells('E6:R7');
  const warningCell = sheet.getCell('E6');
  warningCell.value = 'DO NOT ADD / DELETE ANY COLUMNS AND ROWS TO THIS SPREADSHEET.';
  warningCell.font = { name: 'Times New Roman', size: 16, bold: true, color: OBE_THEME.warningRed };
  warningCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // Ensure rows 1-7 have uniform height to avoid distorting the Grade Legend
  for (let i = 1; i <= 7; i++) {
    sheet.getRow(i).height = 20;
  }

  // 3. Course Information Grids
  const rowOffset = 8;
  sheet.getRow(rowOffset).height = 20;
  sheet.getRow(rowOffset + 1).height = 20; // Uniform height restored
  sheet.getRow(rowOffset + 2).height = 20;
  sheet.getRow(rowOffset + 3).height = 20;

  // -- Block 1: School Info (Cols A-D)
  const drawInfoRow = (r, c1, c2, label, value) => {
    sheet.mergeCells(r, c1, r, c1 + 1);
    sheet.mergeCells(r, c2, r, c2 + 2); // merge up to column E (5) to reduce excess space
    const lblCell = sheet.getCell(r, c1);
    const valCell = sheet.getCell(r, c2);
    lblCell.value = label;
    valCell.value = value || '';

    applyStyle(lblCell, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true, align: 'left' });
    applyStyle(valCell, { bg: OBE_THEME.lightBlue, bold: true, border: true, align: 'left' });
  };

  drawInfoRow(rowOffset, 1, 3, 'School/Institute', course.school || 'FEST/Iqra University');
  drawInfoRow(rowOffset + 1, 1, 3, 'Entry:', semesterText);
  drawInfoRow(rowOffset + 2, 1, 3, 'Duration:', course.duration || '16 weeks');
  drawInfoRow(rowOffset + 3, 1, 3, 'Program:', course.program || 'Computer Science');

  // -- Block 2: Course Details (Cols H-N)
  const drawInfoRow2 = (r, c1, c2, label, value, shrink = false) => {
    sheet.mergeCells(r, c1, r, c1 + 1);
    sheet.mergeCells(r, c2, r, c2 + 4); // merge up to column N (14) to give more room
    const lblCell = sheet.getCell(r, c1);
    const valCell = sheet.getCell(r, c2);
    lblCell.value = label;
    valCell.value = value || '';

    applyStyle(lblCell, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true, align: 'left' });
    applyStyle(valCell, { bg: OBE_THEME.lightBlue, bold: true, border: true, align: 'left' });

    if (shrink) {
      valCell.alignment = { vertical: 'middle', horizontal: 'left', shrinkToFit: true, wrapText: false };
    }
  };

  const instructorName = course.faculty && course.faculty.name ? course.faculty.name : '';

  drawInfoRow2(rowOffset, 8, 10, 'Course Code:', course.courseCode);
  drawInfoRow2(rowOffset + 1, 8, 10, 'Course:', course.courseName, true); // Shrink long course names to fit uniform row height
  drawInfoRow2(rowOffset + 2, 8, 10, 'Instructor:', instructorName);

  // Credit Hours is a bit split
  sheet.mergeCells(rowOffset + 3, 8, rowOffset + 3, 9);
  sheet.mergeCells(rowOffset + 3, 10, rowOffset + 3, 14);
  const chLabel = sheet.getCell(rowOffset + 3, 8);
  const chType = sheet.getCell(rowOffset + 3, 10);
  chLabel.value = 'Credit Hours:';
  chType.value = course.type || 'Theory';
  applyStyle(chLabel, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true, align: 'left' });
  applyStyle(chType, { bg: OBE_THEME.white, bold: true, border: true, align: 'center' });

  sheet.mergeCells(rowOffset + 4, 10, rowOffset + 4, 14);
  const chVal = sheet.getCell(rowOffset + 4, 10);
  chVal.value = course.creditHours || 3;
  applyStyle(chVal, { bg: OBE_THEME.white, bold: true, border: true, align: 'center' });

  // 4. CLO-GA Mapping Header
  const mappingStartCol = 16; // Start at column 16 (P) to leave a spacer column after Block 2 (which ends at 14)



  const mapTitleCol = mappingStartCol + 2;
  const mapTitle = sheet.getCell(rowOffset + 1, mapTitleCol);
  mapTitle.value = 'CLO - GA Mapping';
  applyStyle(mapTitle, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true, align: 'center' });

  sheet.mergeCells(rowOffset + 2, mappingStartCol, rowOffset + 2, mappingStartCol + 1);
  const cloHash = sheet.getCell(rowOffset + 2, mappingStartCol);
  cloHash.value = 'CLO #';
  applyStyle(cloHash, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true, align: 'left' });

  sheet.mergeCells(rowOffset + 3, mappingStartCol, rowOffset + 3, mappingStartCol + 1);
  const gaHash = sheet.getCell(rowOffset + 3, mappingStartCol);
  gaHash.value = 'GA #';
  applyStyle(gaHash, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true, align: 'left' });

  // Map out the active CLOs and their mapped GAs (just picking the first mapped GA for this summary grid as per typical templates)
  const activeClos = (config.clos || []).filter(c => c.active);
  let currentCol = mappingStartCol + 2;

  activeClos.forEach(clo => {
    // Extract digit for clean display if possible (e.g., "CLO 1" -> "1")
    const cloNumText = clo.cloNumber.replace(/[^0-9]/g, '') || clo.cloNumber;
    const cloMap = (config.cloGaMapping || []).find(m => m.cloNumber === clo.cloNumber);
    const gaVal = (cloMap && cloMap.mappedGAs && cloMap.mappedGAs.length > 0)
      ? cloMap.mappedGAs[0].replace(/[^0-9]/g, '') || cloMap.mappedGAs[0]
      : '-';

    const cloCell = sheet.getCell(rowOffset + 2, currentCol);
    cloCell.value = cloNumText;
    applyStyle(cloCell, { bg: OBE_THEME.lightBlue, bold: true, border: true, align: 'center' });

    const gaCell = sheet.getCell(rowOffset + 3, currentCol);
    gaCell.value = gaVal;
    applyStyle(gaCell, { bg: OBE_THEME.lightBlue, bold: true, border: true, align: 'center' });

    currentCol++;
  });

  const endMergeCol = Math.max(mapTitleCol, currentCol - 1);
  sheet.mergeCells(rowOffset + 1, mapTitleCol, rowOffset + 1, endMergeCol);

  // 5. Grade Legend (Top Right, stick beside CLO-GA mapping)
  const legendStartCol = endMergeCol + 2;
  const legendStartRow = rowOffset - 3; // Ends exactly at rowOffset + 3 (same as CLO-GA mapping)

  // Give the legend columns more width so the text doesn't wrap
  sheet.getColumn(legendStartCol).width = 15;
  sheet.getColumn(legendStartCol + 1).width = 12;

  sheet.mergeCells(legendStartRow, legendStartCol, legendStartRow, legendStartCol + 1);
  const legendTitle = sheet.getCell(legendStartRow, legendStartCol);
  legendTitle.value = 'Grade Legend';
  applyStyle(legendTitle, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true, align: 'center' });
  // Explicitly prevent wrapping so it fits on a single line within the 20px row
  legendTitle.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false, shrinkToFit: true };

  const gradesArray = [
    { label: 'A', value: config.grades?.A || 88 },
    { label: 'B+', value: config.grades?.BPlus || 81 },
    { label: 'B', value: config.grades?.B || 74 },
    { label: 'C+', value: config.grades?.CPlus || 67 },
    { label: 'C', value: config.grades?.C || 60 },
    { label: 'F', value: `<${config.grades?.C || 60}` }
  ];

  gradesArray.forEach((grade, idx) => {
    const r = legendStartRow + 1 + idx;
    const lblCell = sheet.getCell(r, legendStartCol);
    lblCell.value = grade.label;
    applyStyle(lblCell, { bg: OBE_THEME.lightBlue, bold: true, border: true, align: 'center' });

    const valCell = sheet.getCell(r, legendStartCol + 1);
    valCell.value = grade.value;
    applyStyle(valCell, { bg: OBE_THEME.lightBlue, bold: true, border: true, align: 'center' });
  });

  // --- MAIN STUDENT TABLE ---
  const tableStartRow = 15; // Starting row for the main table (leaving some space after headers)

  // Create styles
  const styleSubHeader = (cell) => applyStyle(cell, { bg: OBE_THEME.lightBlue, bold: true, border: true });
  const styleCell = (cell) => applyStyle(cell, { border: true });

  // 1. Static left columns
  sheet.mergeCells(tableStartRow, 1, tableStartRow + 4, 1);
  const sNoCell = sheet.getCell(tableStartRow, 1);
  sNoCell.value = 'S/ No';
  styleSubHeader(sNoCell);

  sheet.mergeCells(tableStartRow, 2, tableStartRow + 4, 2);
  const regNoCell = sheet.getCell(tableStartRow, 2);
  regNoCell.value = 'Regn No.'; // as in screenshot
  styleSubHeader(regNoCell);

  sheet.mergeCells(tableStartRow, 3, tableStartRow + 4, 3);
  const nameCell = sheet.getCell(tableStartRow, 3);
  nameCell.value = 'Name';
  styleSubHeader(nameCell);

  // Metadata column (Col 4)
  const metaCol = 4;
  sheet.mergeCells(tableStartRow, metaCol, tableStartRow + 1, metaCol);
  const metaExamCell = sheet.getCell(tableStartRow, metaCol);
  metaExamCell.value = 'Exam';
  styleSubHeader(metaExamCell);

  const metaTotalCell = sheet.getCell(tableStartRow + 2, metaCol);
  metaTotalCell.value = 'Total';
  styleSubHeader(metaTotalCell);

  const metaCloCell = sheet.getCell(tableStartRow + 3, metaCol);
  metaCloCell.value = 'CLO';
  styleSubHeader(metaCloCell);

  const metaMarksCell = sheet.getCell(tableStartRow + 4, metaCol);
  metaMarksCell.value = 'Marks';
  styleSubHeader(metaMarksCell);

  // 2. Dynamic Assessment Categories
  let currentTableCol = 5; // Starting column for components

  const processCategory = (categoryKey, title, weight) => {
    // filter active components for this category
    const categoryAssessments = assessments.filter(a => a.active && a.category === categoryKey)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const activeComps = [];
    categoryAssessments.forEach(a => {
      if (a.components) {
        activeComps.push(...a.components.filter(c => c.active));
      }
    });

    const numComps = activeComps.length;
    const startCol = currentTableCol;

    if (numComps > 0) {
      // Row 15: Category Title
      const endCol = startCol + numComps - 1;
      sheet.mergeCells(tableStartRow, startCol, tableStartRow, endCol);
      const catTitleCell = sheet.getCell(tableStartRow, startCol);
      catTitleCell.value = title;
      styleSubHeader(catTitleCell);

      // Components
      activeComps.forEach((comp, idx) => {
        const col = startCol + idx;

        // Row 16: Component Number
        const compNumCell = sheet.getCell(tableStartRow + 1, col);
        compNumCell.value = comp.componentNumber ? comp.componentNumber.replace(/[^0-9]/g, '') || (idx + 1) : (idx + 1);
        styleSubHeader(compNumCell);

        // Row 18: CLO Number
        const cloCell = sheet.getCell(tableStartRow + 3, col);
        cloCell.value = comp.cloNumber ? comp.cloNumber.replace(/[^0-9]/g, '') : '-';
        styleSubHeader(cloCell);

        // Row 19: Max Marks
        const maxMarksCell = sheet.getCell(tableStartRow + 4, col);
        maxMarksCell.value = comp.maxMarks || 0;
        styleSubHeader(maxMarksCell);
      });

      // Row 17: Category Max Marks Merged
      const totalMax = activeComps.reduce((sum, c) => sum + (c.maxMarks || 0), 0);
      sheet.mergeCells(tableStartRow + 2, startCol, tableStartRow + 2, endCol);
      const catMaxCell = sheet.getCell(tableStartRow + 2, startCol);
      catMaxCell.value = totalMax;
      styleSubHeader(catMaxCell);

      currentTableCol += numComps;
    } else {
      // Fallback if no components
      sheet.mergeCells(tableStartRow, startCol, tableStartRow + 4, startCol);
      const fallbackCell = sheet.getCell(tableStartRow, startCol);
      fallbackCell.value = title + ' (No Components)';
      styleSubHeader(fallbackCell);
      currentTableCol += 1;
    }

    // Category Total Column
    const totalCol = currentTableCol;
    const catTotalCell = sheet.getCell(tableStartRow, totalCol);
    catTotalCell.value = 'Total';
    styleSubHeader(catTotalCell);

    // Weight % merged vertically
    sheet.mergeCells(tableStartRow + 1, totalCol, tableStartRow + 4, totalCol);
    const weightCell = sheet.getCell(tableStartRow + 1, totalCol);
    weightCell.value = `${weight}%`;
    applyStyle(weightCell, { bg: OBE_THEME.white, bold: true, border: true });

    currentTableCol += 1;

    return activeComps;
  };

  const quizzesComps = processCategory('quizzes', 'Quizzes', config.assessments?.quizzes || 10);
  const assignmentsComps = processCategory('assignments', 'Assignments & CCP', config.assessments?.assignments || 25);
  const midTermComps = processCategory('midTerm', 'Mid Term', config.assessments?.midTerm || 25);

  // Sessionals Column
  const sessionalsCol = currentTableCol;
  sheet.mergeCells(tableStartRow, sessionalsCol, tableStartRow + 1, sessionalsCol);
  const sessionalsTitle = sheet.getCell(tableStartRow, sessionalsCol);
  sessionalsTitle.value = 'Sessionals';
  styleSubHeader(sessionalsTitle);

  sheet.mergeCells(tableStartRow + 2, sessionalsCol, tableStartRow + 4, sessionalsCol);
  const sessionalsWeight = sheet.getCell(tableStartRow + 2, sessionalsCol);
  const sessWt = (config.assessments?.quizzes || 10) + (config.assessments?.assignments || 25);
  sessionalsWeight.value = `${sessWt}%`;
  styleSubHeader(sessionalsWeight);

  currentTableCol += 1;

  const finalExamComps = processCategory('finalExam', 'Final Exam', config.assessments?.finalExam || 40);

  // Overall Total
  const overallTotalCol = currentTableCol;
  sheet.mergeCells(tableStartRow, overallTotalCol, tableStartRow + 1, overallTotalCol);
  const overallTitle = sheet.getCell(tableStartRow, overallTotalCol);
  overallTitle.value = 'Total';
  styleSubHeader(overallTitle);

  sheet.mergeCells(tableStartRow + 2, overallTotalCol, tableStartRow + 4, overallTotalCol);
  const overallWeight = sheet.getCell(tableStartRow + 2, overallTotalCol);
  overallWeight.value = '100%';
  styleSubHeader(overallWeight);

  currentTableCol += 1;

  // Grade
  const gradeCol = currentTableCol;
  sheet.mergeCells(tableStartRow, gradeCol, tableStartRow + 4, gradeCol);
  const gradeTitle = sheet.getCell(tableStartRow, gradeCol);
  gradeTitle.value = 'Grade';
  styleSubHeader(gradeTitle);

  // --- CLO & GA Headers (Horizontal Extension) ---
  let horizontalCol = gradeCol + 2; // Spacer column
  const activeGas = (config.gas || []).filter(g => g.active);

  // 1. CLO % Table
  let cloStartCol = horizontalCol;
  if (activeClos.length > 0) {
    const cloEndCol = cloStartCol + activeClos.length - 1;

    // CLO pass %age (Row 13, small box)
    sheet.getRow(tableStartRow - 2).height = 35; // Height 35 to fit 2 wrapped lines of text
    sheet.mergeCells(tableStartRow - 2, cloStartCol, tableStartRow - 2, cloStartCol + 1);
    const cloPassHeader = sheet.getCell(tableStartRow - 2, cloStartCol);
    cloPassHeader.value = 'CLO pass %age';
    applyStyle(cloPassHeader, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true });

    const cloPassVal = sheet.getCell(tableStartRow - 2, cloStartCol + 2);
    cloPassVal.value = '50%';
    applyStyle(cloPassVal, { bg: OBE_THEME.lightBlue, bold: true, border: true, align: 'center' });

    // Header (Row 15)
    sheet.mergeCells(tableStartRow, cloStartCol, tableStartRow + 3, cloEndCol);
    const cloTitle = sheet.getCell(tableStartRow, cloStartCol);
    cloTitle.value = 'CLOs % age';
    applyStyle(cloTitle, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true });

    activeClos.forEach((clo, idx) => {
      const cloNumText = clo.cloNumber.replace(/[^0-9]/g, '') || clo.cloNumber;
      const hCol = cloStartCol + idx;

      const pctCell = sheet.getCell(tableStartRow + 4, hCol);
      pctCell.value = Number(cloNumText);
      styleSubHeader(pctCell);

      sheet.getColumn(hCol).width = 7.5;
    });

    horizontalCol = cloEndCol + 2; // Add a spacer
  }

  // 2. GA % Table
  let gaPctStartCol = horizontalCol;
  if (activeGas.length > 0) {
    const gaPctEndCol = gaPctStartCol + activeGas.length - 1;

    // GA pass %age (Row 13, small box)
    sheet.mergeCells(tableStartRow - 2, gaPctStartCol, tableStartRow - 2, gaPctStartCol + 1);
    const gaPassHeader = sheet.getCell(tableStartRow - 2, gaPctStartCol);
    gaPassHeader.value = 'GA pass %age';
    applyStyle(gaPassHeader, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true });

    const gaPassVal = sheet.getCell(tableStartRow - 2, gaPctStartCol + 2);
    gaPassVal.value = '50%';
    applyStyle(gaPassVal, { bg: OBE_THEME.lightBlue, bold: true, border: true, align: 'center' });

    // Header (Row 15)
    sheet.mergeCells(tableStartRow, gaPctStartCol, tableStartRow + 3, gaPctEndCol);
    const gaPctTitle = sheet.getCell(tableStartRow, gaPctStartCol);
    gaPctTitle.value = 'GAs Attained %';
    applyStyle(gaPctTitle, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true });

    activeGas.forEach((ga, idx) => {
      const gaNumText = ga.gaNumber.replace(/[^0-9]/g, '') || ga.gaNumber;
      const hCol = gaPctStartCol + idx;

      const pctCell = sheet.getCell(tableStartRow + 4, hCol);
      pctCell.value = Number(gaNumText);
      styleSubHeader(pctCell);

      sheet.getColumn(hCol).width = 7.5;
    });

    horizontalCol = gaPctEndCol + 2; // Add a spacer
  }

  // 3. GA Y/N Table
  let gaYnStartCol = horizontalCol;
  if (activeGas.length > 0) {
    const gaYnEndCol = gaYnStartCol + activeGas.length - 1;

    // Header (Row 15)
    sheet.mergeCells(tableStartRow, gaYnStartCol, tableStartRow + 3, gaYnEndCol);
    const gaYnTitle = sheet.getCell(tableStartRow, gaYnStartCol);
    gaYnTitle.value = 'GAs Attained (Y/N)';
    applyStyle(gaYnTitle, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true });

    activeGas.forEach((ga, idx) => {
      const gaNumText = ga.gaNumber.replace(/[^0-9]/g, '') || ga.gaNumber;
      const hCol = gaYnStartCol + idx;

      const attyCell = sheet.getCell(tableStartRow + 4, hCol);
      attyCell.value = Number(gaNumText);
      styleSubHeader(attyCell);

      sheet.getColumn(hCol).width = 7.5;
    });

    horizontalCol = gaYnEndCol + 2; // Add a spacer
  }

  // Track the end of the student block for charts/KPI positioning
  const finalStudentCol = horizontalCol - 2;

  // 3. Populate Student Data Rows
  let dataRow = tableStartRow + 5;
  const activeStudents = (results.students || []).filter(s => s.active !== false);

  activeStudents.forEach((student, index) => {
    // S/No, Reg, Name
    const sNoC = sheet.getCell(dataRow, 1);
    sNoC.value = index + 1;
    styleCell(sNoC);

    const regC = sheet.getCell(dataRow, 2);
    regC.value = student.registrationNo;
    styleCell(regC);

    const nameC = sheet.getCell(dataRow, 3);
    nameC.value = student.studentName;
    applyStyle(nameC, { border: true, align: 'left' });

    // Meta col empty
    const metaC = sheet.getCell(dataRow, 4);
    styleCell(metaC);

    let currentColCounter = 5;

    const fillCategoryMarks = (components, categoryKey) => {
      components.forEach(comp => {
        const markDoc = marks.find(m => m.student?.toString() === student.studentId?.toString() && (m.componentId || m.component)?.toString() === comp._id?.toString());
        const cell = sheet.getCell(dataRow, currentColCounter);

        if (markDoc && typeof markDoc.marks === 'number') {
          cell.value = markDoc.marks;
        } else {
          cell.value = ''; // Genuinely blank
        }
        styleCell(cell);
        currentColCounter++;
      });

      // Total column
      const totalCell = sheet.getCell(dataRow, currentColCounter);
      const catData = student.categories[categoryKey];
      // Display blank if catData is not calculated
      totalCell.value = catData && catData.contribution != null ? catData.contribution : '';
      styleCell(totalCell);
      currentColCounter++;
    };

    fillCategoryMarks(quizzesComps, 'quizzes');
    fillCategoryMarks(assignmentsComps, 'assignments');
    fillCategoryMarks(midTermComps, 'midTerm');

    // Sessionals
    const sessCell = sheet.getCell(dataRow, currentColCounter);
    sessCell.value = student.sessionals != null ? student.sessionals : '';
    styleCell(sessCell);
    currentColCounter++;

    fillCategoryMarks(finalExamComps, 'finalExam');

    // Overall Total
    const ovCell = sheet.getCell(dataRow, currentColCounter);
    ovCell.value = student.overallPercentage != null ? student.overallPercentage : '';
    applyStyle(ovCell, { color: OBE_THEME.warningRed, border: true });
    currentColCounter++;

    // Grade
    const gCell = sheet.getCell(dataRow, currentColCounter);
    gCell.value = student.grade || '';
    applyStyle(gCell, { border: true });
    currentColCounter++;

    // --- Horizontal CLO/GA Data ---
    const resultStudent = (results.students || []).find(rs => rs.registrationNo === student.registrationNo);

    // 1. CLO Percentages
    if (activeClos.length > 0) {
      let currentDataCol = cloStartCol;
      activeClos.forEach(clo => {
        const cloRes = resultStudent ? (resultStudent.clos || []).find(c => c.cloNumber === clo.cloNumber) : null;
        const pCell = sheet.getCell(dataRow, currentDataCol);

        if (cloRes && cloRes.status === 'complete') {
          pCell.value = cloRes.percentage;
          pCell.numFmt = '0"%"';
        } else {
          pCell.value = '';
        }
        styleCell(pCell);
        currentDataCol++;
      });
    }

    // 2. GA Percentages
    if (activeGas.length > 0) {
      let currentDataCol = gaPctStartCol;
      activeGas.forEach(ga => {
        const gaRes = resultStudent ? (resultStudent.gas || []).find(g => g.gaNumber === ga.gaNumber) : null;
        const gaPctCell = sheet.getCell(dataRow, currentDataCol);

        if (gaRes && gaRes.status === 'complete') {
          gaPctCell.value = gaRes.percentage;
          gaPctCell.numFmt = '0"%"';
        } else {
          gaPctCell.value = '';
        }
        styleCell(gaPctCell);
        currentDataCol++;
      });
    }

    // 3. GA Attained (Y/N)
    if (activeGas.length > 0) {
      let currentDataCol = gaYnStartCol;
      activeGas.forEach(ga => {
        const gaRes = resultStudent ? (resultStudent.gas || []).find(g => g.gaNumber === ga.gaNumber) : null;
        const yCell = sheet.getCell(dataRow, currentDataCol);

        if (gaRes && gaRes.status === 'complete') {
          if (gaRes.attained) {
            yCell.value = 'Y';
            applyStyle(yCell, { border: true, bold: true });
          } else {
            yCell.value = 'N';
            applyStyle(yCell, { bg: OBE_THEME.black, color: OBE_THEME.white, border: true, bold: true, align: 'center' });
          }
        } else {
          yCell.value = '';
          styleCell(yCell);
        }
        currentDataCol++;
      });
    }

    dataRow++;
  });

  // 4. Course-Level Passing Tables (KPI for Course)
  const kpiStartRow = tableStartRow;
  let kpiCol = finalStudentCol + 2; // 1 column gap from GAs Attained (Y/N)

  if (activeClos.length > 0 || activeGas.length > 0) {
    // Only span the first table (CLOs if they exist, otherwise GAs)
    const firstTableLength = activeClos.length > 0 ? activeClos.length : activeGas.length;
    const topHeaderEndCol = kpiCol + firstTableLength - 1;

    // Header (Aligned with CLO pass %age at tableStartRow - 2)
    sheet.mergeCells(kpiStartRow - 2, kpiCol, kpiStartRow - 2, topHeaderEndCol);
    const kpiHeader = sheet.getCell(kpiStartRow - 2, kpiCol);
    kpiHeader.value = 'KPI for Course (%age)';
    applyStyle(kpiHeader, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true, align: 'center' });
  }

  const chartStartCol = kpiCol;
  const chartStartRow = kpiStartRow + 7; // Shift charts down so they don't overlap the tables (tables go down to kpiStartRow + 5)

  const cloChartRange = activeClos.length > 0 ? {
    startCol: kpiCol,
    endCol: kpiCol + activeClos.length - 1,
    catRow: kpiStartRow + 4,
    valRow: kpiStartRow + 5
  } : null;

  if (activeClos.length > 0) {
    const cloEndCol = kpiCol + activeClos.length - 1;

    // CLO Pass Header (Spans 4 rows to match left-side headers)
    sheet.mergeCells(kpiStartRow, kpiCol, kpiStartRow + 3, cloEndCol);
    const cloPassHeader = sheet.getCell(kpiStartRow, kpiCol);
    cloPassHeader.value = 'Percentage of Students Passing CLO';
    applyStyle(cloPassHeader, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true });

    // CLO Subheader (Numbers) & Data
    activeClos.forEach((clo, idx) => {
      const col = kpiCol + idx;
      const numC = sheet.getCell(kpiStartRow + 4, col);
      numC.value = Number(clo.cloNumber.replace(/[^0-9]/g, '') || clo.cloNumber);
      styleSubHeader(numC);

      const passData = (results.courseCLOPassing || []).find(c => c.cloNumber === clo.cloNumber);
      const valC = sheet.getCell(kpiStartRow + 5, col);
      if (passData && passData.percentage != null) {
        valC.value = passData.percentage;
        valC.numFmt = '0"%"';
      } else {
        valC.value = '';
      }
      styleCell(valC);
    });

    kpiCol = cloEndCol + 6; // Add a wider gap so the CLO chart doesn't horizontally overlap the GA chart
  }

  const gaChartRange = activeGas.length > 0 ? {
    startCol: kpiCol,
    endCol: kpiCol + activeGas.length - 1,
    catRow: kpiStartRow + 4,
    valRow: kpiStartRow + 5
  } : null;

  if (activeGas.length > 0) {
    const gaEndCol = kpiCol + activeGas.length - 1;

    // GA Pass Header (Spans 4 rows to match left-side headers)
    sheet.mergeCells(kpiStartRow, kpiCol, kpiStartRow + 3, gaEndCol);
    const gaPassHeader = sheet.getCell(kpiStartRow, kpiCol);
    gaPassHeader.value = 'Percentage of Students Passing GA';
    applyStyle(gaPassHeader, { bg: OBE_THEME.darkBlue, color: OBE_THEME.white, bold: true, border: true });

    // GA Subheader (Numbers) & Data
    activeGas.forEach((ga, idx) => {
      const col = kpiCol + idx;
      const numC = sheet.getCell(kpiStartRow + 4, col);
      numC.value = Number(ga.gaNumber.replace(/[^0-9]/g, '') || ga.gaNumber);
      styleSubHeader(numC);

      const passData = (results.courseGAPassing || []).find(g => g.gaNumber === ga.gaNumber);
      const valC = sheet.getCell(kpiStartRow + 5, col);
      if (passData && passData.percentage != null) {
        valC.value = passData.percentage;
        valC.numFmt = '0"%"';
      } else {
        valC.value = '';
      }
      styleCell(valC);
    });
  }

  const chartHeightRows = 18;
  const footerStartRow = chartStartRow + chartHeightRows + 5;

  // Comments by Faculty
  const commentsLabelCell = sheet.getCell(footerStartRow, chartStartCol);
  commentsLabelCell.value = 'Comments by Faculty:';
  commentsLabelCell.font = { bold: true, name: 'Times New Roman', size: 11 };

  sheet.mergeCells(footerStartRow + 1, chartStartCol, footerStartRow + 4, chartStartCol + 11);
  const commentsBox = sheet.getCell(footerStartRow + 1, chartStartCol);
  applyStyle(commentsBox, { bg: OBE_THEME.lightYellow, border: true });

  // Faculty Signature
  const sigLabelCell = sheet.getCell(footerStartRow + 6, chartStartCol);
  sigLabelCell.value = 'Faculty Signature:';
  sigLabelCell.font = { bold: true, name: 'Times New Roman', size: 11 };

  sheet.mergeCells(footerStartRow + 6, chartStartCol + 3, footerStartRow + 6, chartStartCol + 6);
  const sigBox = sheet.getCell(footerStartRow + 6, chartStartCol + 3);
  applyStyle(sigBox, { bg: OBE_THEME.lightYellow, border: true });

  const rawBuffer = await workbook.xlsx.writeBuffer();
  const finalBuffer = await injectNativeCharts(rawBuffer, cloChartRange, gaChartRange, chartStartRow, chartStartCol);

  return finalBuffer;
};

function numToCol(n) {
  let result = '';
  while (n > 0) {
    let remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function generateChartXml(title, catRange, valRange, xAxisTitle) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr><a:defRPr b="1" sz="1400"/></a:pPr>
            <a:r>
              <a:t>${title}</a:t>
            </a:r>
          </a:p>
        </c:rich>
      </c:tx>
    </c:title>
    <c:plotArea>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:spPr>
            <a:solidFill>
              <a:srgbClr val="4F81BD"/>
            </a:solidFill>
          </c:spPr>
          <c:cat>
            <c:strRef>
              <c:f>${catRange}</c:f>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>${valRange}</c:f>
            </c:numRef>
          </c:val>
        </c:ser>
        <c:axId val="11111111"/>
        <c:axId val="22222222"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="11111111"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:axPos val="b"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="22222222"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
        ${xAxisTitle ? `
        <c:title>
          <c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${xAxisTitle}</a:t></a:r></a:p></c:rich></c:tx>
        </c:title>` : ''}
      </c:catAx>
      <c:valAx>
        <c:axId val="22222222"/>
        <c:scaling>
          <c:orientation val="minMax"/>
          <c:max val="100"/>
        </c:scaling>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:numFmt formatCode="0&quot;%&quot;" sourceLinked="0"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="11111111"/>
        <c:title>
          <c:tx><c:rich><a:bodyPr reqAmt="vert"/><a:lstStyle/><a:p><a:r><a:t>Percentage of Students Passing</a:t></a:r></a:p></c:rich></c:tx>
        </c:title>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="none"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

async function injectNativeCharts(buffer, cloRange, gaRange, startRow, startCol) {
  if (!cloRange && !gaRange) return buffer;

  const zip = await JSZip.loadAsync(buffer);

  let drawingXmlStr = await zip.file('xl/drawings/drawing1.xml')?.async('string');
  if (!drawingXmlStr) return buffer;

  const $drawing = cheerio.load(drawingXmlStr, { xmlMode: true });

  let chartCount = 1;
  let relsXmlStr = await zip.file('xl/drawings/_rels/drawing1.xml.rels')?.async('string');
  if (!relsXmlStr) {
    relsXmlStr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
  }
  const $rels = cheerio.load(relsXmlStr, { xmlMode: true });

  const addChart = (title, rangeObj, xAxisTitle) => {
    if (!rangeObj) return;

    const colStart = rangeObj.startCol - 1; // Convert 1-indexed ExcelJS col to 0-indexed DrawingML col

    const catRange = `'OBE Award List'!$${numToCol(rangeObj.startCol)}$${rangeObj.catRow}:$${numToCol(rangeObj.endCol)}$${rangeObj.catRow}`;
    const valRange = `'OBE Award List'!$${numToCol(rangeObj.startCol)}$${rangeObj.valRow}:$${numToCol(rangeObj.endCol)}$${rangeObj.valRow}`;

    const chartXml = generateChartXml(title, catRange, valRange, xAxisTitle);
    const chartFilename = `chart${chartCount}.xml`;
    zip.file(`xl/charts/${chartFilename}`, chartXml);

    const rId = `rIdChart${chartCount}`;

    $rels('Relationships').append(`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/${chartFilename}"/>`);

    const colEnd = colStart + 6;

    $drawing('xdr\\:wsDr').append(`
      <xdr:twoCellAnchor>
        <xdr:from>
          <xdr:col>${colStart}</xdr:col>
          <xdr:colOff>0</xdr:colOff>
          <xdr:row>${startRow}</xdr:row>
          <xdr:rowOff>0</xdr:rowOff>
        </xdr:from>
        <xdr:to>
          <xdr:col>${colEnd}</xdr:col>
          <xdr:colOff>0</xdr:colOff>
          <xdr:row>${startRow + 18}</xdr:row>
          <xdr:rowOff>0</xdr:rowOff>
        </xdr:to>
        <xdr:graphicFrame macro="">
          <xdr:nvGraphicFramePr>
            <xdr:cNvPr id="${100 + chartCount}" name="Chart ${chartCount}"/>
            <xdr:cNvGraphicFramePr/>
          </xdr:nvGraphicFramePr>
          <xdr:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="0" cy="0"/>
          </xdr:xfrm>
          <a:graphic>
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
              <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rId}"/>
            </a:graphicData>
          </a:graphic>
        </xdr:graphicFrame>
        <xdr:clientData/>
      </xdr:twoCellAnchor>
    `);

    chartCount++;
  };

  addChart('Percentage of Students Passing CLO', cloRange, null);
  addChart('Percentage of Students Passing GA', gaRange, 'GA');

  zip.file('xl/drawings/drawing1.xml', $drawing.xml());
  zip.file('xl/drawings/_rels/drawing1.xml.rels', $rels.xml());

  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    const ctStr = await ctFile.async('string');
    const $ct = cheerio.load(ctStr, { xmlMode: true });
    if (cloRange) $ct('Types').append(`<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
    if (gaRange) $ct('Types').append(`<Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
    zip.file('[Content_Types].xml', $ct.xml());
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}


