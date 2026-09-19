const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

async function inspectWorkbook(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }
  
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  
  const result = {
    sheets: [],
    drawings: [],
    charts: [],
    rels: [],
    merges: []
  };

  // 1. Inspect workbook.xml
  const wbXmlStr = await zip.file('xl/workbook.xml')?.async('string');
  if (wbXmlStr) {
    const $wb = cheerio.load(wbXmlStr, { xmlMode: true });
    $wb('sheet').each((i, el) => {
      result.sheets.push({
        name: $wb(el).attr('name'),
        sheetId: $wb(el).attr('sheetId'),
        rId: $wb(el).attr('r:id')
      });
    });
  }

  // 2. Inspect worksheet (assuming sheet1 for now)
  const wsXmlStr = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
  if (wsXmlStr) {
    const $ws = cheerio.load(wsXmlStr, { xmlMode: true });
    
    result.pageSetup = {
      orientation: $ws('pageSetup').attr('orientation'),
      paperSize: $ws('pageSetup').attr('paperSize'),
      fitToHeight: $ws('pageSetup').attr('fitToHeight'),
      fitToWidth: $ws('pageSetup').attr('fitToWidth')
    };

    result.pageMargins = $ws('pageMargins').attr();
    
    // Get column widths
    const cols = [];
    $ws('col').each((i, el) => {
      cols.push({
        min: $ws(el).attr('min'),
        max: $ws(el).attr('max'),
        width: $ws(el).attr('width'),
        customWidth: $ws(el).attr('customWidth')
      });
    });
    result.cols = cols;

    // Get non-standard row heights
    const rows = [];
    $ws('row').each((i, el) => {
      const ht = $ws(el).attr('ht');
      if (ht) {
        rows.push({
          r: $ws(el).attr('r'),
          ht: ht
        });
      }
    });
    result.rows = rows;

    // Merges
    $ws('mergeCell').each((i, el) => {
      result.merges.push($ws(el).attr('ref'));
    });
  }

  // 3. Inspect drawings (assuming drawing1)
  const drawingXmlStr = await zip.file('xl/drawings/drawing1.xml')?.async('string');
  if (drawingXmlStr) {
    const $dr = cheerio.load(drawingXmlStr, { xmlMode: true });
    $dr('xdr\\:twoCellAnchor, xdr\\:oneCellAnchor, xdr\\:absoluteAnchor').each((i, el) => {
      const type = el.name;
      const anchor = { type };
      
      if (type === 'xdr:twoCellAnchor') {
        anchor.from = {
          col: $dr(el).find('xdr\\:from xdr\\:col').text(),
          colOff: $dr(el).find('xdr\\:from xdr\\:colOff').text(),
          row: $dr(el).find('xdr\\:from xdr\\:row').text(),
          rowOff: $dr(el).find('xdr\\:from xdr\\:rowOff').text()
        };
        anchor.to = {
          col: $dr(el).find('xdr\\:to xdr\\:col').text(),
          colOff: $dr(el).find('xdr\\:to xdr\\:colOff').text(),
          row: $dr(el).find('xdr\\:to xdr\\:row').text(),
          rowOff: $dr(el).find('xdr\\:to xdr\\:rowOff').text()
        };
      }
      
      const isChart = $dr(el).find('c\\:chart').length > 0;
      const isPic = $dr(el).find('xdr\\:pic').length > 0;
      
      if (isChart) anchor.content = 'chart';
      if (isPic) {
         anchor.content = 'pic';
         // Check if cx/cy (extents) are present for the pic
         anchor.ext = {
            cx: $dr(el).find('xdr\\:pic xdr\\:spPr a\\:xfrm a\\:ext').attr('cx'),
            cy: $dr(el).find('xdr\\:pic xdr\\:spPr a\\:xfrm a\\:ext').attr('cy')
         };
      }
      
      result.drawings.push(anchor);
    });
  }

  return result;
}

async function run() {
  const refDir = path.resolve(__dirname, '../reference/obe');
  const original = await inspectWorkbook(path.join(refDir, 'Original_OBE.xlsx'));
  const generated = await inspectWorkbook(path.join(refDir, 'Generated_OBE.xlsx'));

  fs.writeFileSync('d:\\cfes-portal\\server\\inspection_report.json', JSON.stringify({ original, generated }, null, 2));
  console.log('Inspection complete. Results saved to inspection_report.json');
}

run().catch(console.error);
