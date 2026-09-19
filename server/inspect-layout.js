const ExcelJS = require('exceljs');
const fs = require('fs');

async function inspectLayout() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('../reference/obe/Original_OBE.xlsx');
  const sheet = workbook.worksheets[0];

  console.log('--- COLUMNS ---');
  for (let i = 1; i <= 60; i++) {
    const col = sheet.getColumn(i);
    if (col && col.width) {
      console.log(`Col ${i} width: ${col.width}`);
    }
  }

  console.log('--- ROWS 1 to 20 ---');
  for (let r = 1; r <= 20; r++) {
    const row = sheet.getRow(r);
    if (row && row.height) {
      console.log(`Row ${r} height: ${row.height}`);
    }
    let rowValues = [];
    for (let c = 1; c <= 60; c++) {
      const cell = sheet.getCell(r, c);
      if (cell.value) {
        rowValues.push(`[${c}] ${cell.value}`);
      }
    }
    if (rowValues.length > 0) {
      console.log(`Row ${r}: ${rowValues.join(' | ')}`);
    }
  }
}

inspectLayout().catch(console.error);
