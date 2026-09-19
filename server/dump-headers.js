const ExcelJS = require('exceljs');

async function dumpHeaders() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('../reference/obe/Original_OBE.xlsx');
  const sheet = workbook.worksheets[1];
  
  console.log('--- HEADERS ROW 10 TO 30 ---');
  for (let r = 10; r <= 30; r++) {
    const row = sheet.getRow(r);
    let vals = [];
    row.eachCell((cell, colNumber) => {
      let val = cell.value;
      if (val && typeof val === 'object') {
        if (val.richText) {
           val = val.richText.map(rt => rt.text).join('');
        } else if (val.result !== undefined) {
           val = val.result;
        } else {
           val = JSON.stringify(val);
        }
      }
      if (val !== null && val !== undefined && val !== '') {
        vals.push(`[${colNumber}] ${val.toString().replace(/\n/g, '\\n')}`);
      }
    });
    if (vals.length > 0) {
      console.log(`Row ${r}: ${vals.join(' | ')}`);
    }
  }
}
dumpHeaders().catch(console.error);
