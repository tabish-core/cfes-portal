const ExcelJS = require('exceljs');

async function extractLogo() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('../reference/obe/Original_OBE.xlsx');
  const sheet = workbook.worksheets[1]; // Sheet1
  const images = sheet.getImages();
  images.forEach((image, i) => {
    console.log(`Image ${i}:`);
    const r = image.range;
    if (r) {
      if (r.tl) console.log('tl:', r.tl.col, r.tl.row, r.tl.nativeColOff, r.tl.nativeRowOff);
      if (r.br) console.log('br:', r.br.col, r.br.row, r.br.nativeColOff, r.br.nativeRowOff);
      if (r.ext) console.log('ext:', r.ext.width, r.ext.height);
    }
  });
}
extractLogo().catch(console.error);
