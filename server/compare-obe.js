const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

async function extractWorkbookData(filePath) {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  
  const data = {
    pageSetup: null,
    margins: null,
    cols: [],
    rows: [],
    merges: [],
    drawings: [],
    charts: []
  };

  const wsXmlStr = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
  if (wsXmlStr) {
    const $ws = cheerio.load(wsXmlStr, { xmlMode: true });
    
    data.pageSetup = $ws('pageSetup').attr();
    data.margins = $ws('pageMargins').attr();
    
    $ws('col').each((i, el) => {
      data.cols.push($ws(el).attr());
    });
    
    $ws('row').each((i, el) => {
      if ($ws(el).attr('ht')) {
         data.rows.push({ r: $ws(el).attr('r'), ht: $ws(el).attr('ht') });
      }
    });
    
    $ws('mergeCell').each((i, el) => {
      data.merges.push($ws(el).attr('ref'));
    });
  }

  const drawingXmlStr = await zip.file('xl/drawings/drawing1.xml')?.async('string');
  if (drawingXmlStr) {
    const $dr = cheerio.load(drawingXmlStr, { xmlMode: true });
    $dr('xdr\\:twoCellAnchor').each((i, el) => {
      const isChart = $dr(el).find('c\\:chart').length > 0;
      const isPic = $dr(el).find('xdr\\:pic').length > 0;
      
      const anchor = {
        from: {
          col: $dr(el).find('xdr\\:from xdr\\:col').text(),
          row: $dr(el).find('xdr\\:from xdr\\:row').text()
        },
        to: {
          col: $dr(el).find('xdr\\:to xdr\\:col').text(),
          row: $dr(el).find('xdr\\:to xdr\\:row').text()
        }
      };

      if (isPic) {
         anchor.type = 'image';
         anchor.ext = {
            cx: $dr(el).find('xdr\\:pic xdr\\:spPr a\\:xfrm a\\:ext').attr('cx'),
            cy: $dr(el).find('xdr\\:pic xdr\\:spPr a\\:xfrm a\\:ext').attr('cy')
         };
         data.drawings.push(anchor);
      }
      if (isChart) {
         anchor.type = 'chart';
         data.charts.push(anchor);
      }
    });
  }
  
  return data;
}

async function run() {
  const refDir = path.resolve(__dirname, '../reference/obe');
  const original = await extractWorkbookData(path.join(refDir, 'Original_OBE.xlsx'));
  const generated = await extractWorkbookData(path.join(refDir, 'Generated_OBE.xlsx'));

  const report = [];
  report.push("=== COMPARISON REPORT ===");
  
  report.push("\n1. PAGE SETUP (PRINT/PAGE SETUP)");
  report.push("Original: " + JSON.stringify(original.pageSetup));
  report.push("Generated: " + JSON.stringify(generated.pageSetup));
  
  report.push("\n2. PAGE MARGINS (PRINT/PAGE SETUP)");
  report.push("Original: " + JSON.stringify(original.margins));
  report.push("Generated: " + JSON.stringify(generated.margins));
  
  report.push("\n3. COLUMN WIDTHS (SIZING/FORMATTING)");
  report.push(`Original: ${original.cols.length} custom columns defined`);
  report.push(`Generated: ${generated.cols.length} custom columns defined`);
  
  report.push("\n4. IMAGES / LOGOS (IMAGE/LOGO & SIZING)");
  report.push("Original Images: " + JSON.stringify(original.drawings, null, 2));
  report.push("Generated Images: " + JSON.stringify(generated.drawings, null, 2));

  report.push("\n5. CHARTS (CHART & POSITIONING)");
  report.push("Original Charts: " + JSON.stringify(original.charts, null, 2));
  report.push("Generated Charts: " + JSON.stringify(generated.charts, null, 2));
  
  fs.writeFileSync('d:\\cfes-portal\\server\\compare_report.txt', report.join('\n'));
  console.log("Comparison saved to compare_report.txt");
}

run().catch(console.error);
