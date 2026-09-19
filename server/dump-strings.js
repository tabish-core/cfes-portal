const ExcelJS = require('exceljs');

async function dumpStrings() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('../reference/obe/Original_OBE.xlsx');
  
  workbook.worksheets.forEach((sheet, sheetId) => {
    console.log(`--- Sheet ${sheetId} (${sheet.name}) ---`);
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.value) {
          let val = cell.value;
          if (typeof val === 'object' && val.richText) {
            val = val.richText.map(rt => rt.text).join('');
          }
          if (typeof val === 'string') {
            if (val.toLowerCase().includes('distribution') || val.toLowerCase().includes('kpi') || val.toLowerCase().includes('signature') || val.toLowerCase().includes('comments')) {
              console.log(`[Row ${rowNumber}, Col ${colNumber}] ${val}`);
            }
          }
        }
      });
    });
  });
}
dumpStrings().catch(console.error);
