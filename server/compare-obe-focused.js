const JSZip = require('jszip');
const fs = require('fs');
const cheerio = require('cheerio');

async function extractSpecifics(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const data = {};
  
  const wsXmlStr = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
  if (wsXmlStr) {
    const $ws = cheerio.load(wsXmlStr, { xmlMode: true });
    
    // Page margins
    data.margins = $ws('pageMargins').attr();
    data.pageSetup = $ws('pageSetup').attr();
    
    // Column widths
    data.cols = [];
    $ws('col').each((i, el) => {
      data.cols.push($ws(el).attr());
    });
    
    // Merges
    data.merges = [];
    $ws('mergeCell').each((i, el) => {
      data.merges.push($ws(el).attr('ref'));
    });
  }
  
  const drawingXmlStr = await zip.file('xl/drawings/drawing1.xml')?.async('string');
  data.images = [];
  data.charts = [];
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
         // only record the first image (likely the logo)
         if (data.images.length === 0) {
           anchor.ext = {
              cx: $dr(el).find('xdr\\:pic xdr\\:spPr a\\:xfrm a\\:ext').attr('cx'),
              cy: $dr(el).find('xdr\\:pic xdr\\:spPr a\\:xfrm a\\:ext').attr('cy')
           };
           data.images.push(anchor);
         }
      }
      if (isChart) {
         data.charts.push(anchor);
      }
    });
  }
  
  return data;
}

async function run() {
  const original = await extractSpecifics('../reference/obe/Original_OBE.xlsx');
  const generated = await extractSpecifics('../reference/obe/Generated_OBE.xlsx');

  console.log("=== MARGINS ===");
  console.log("ORIGINAL:", original.margins);
  console.log("GENERATED:", generated.margins);
  
  console.log("\n=== PAGE SETUP ===");
  console.log("ORIGINAL:", original.pageSetup);
  console.log("GENERATED:", generated.pageSetup);
  
  console.log("\n=== LOGO (FIRST IMAGE) ===");
  console.log("ORIGINAL:", JSON.stringify(original.images[0], null, 2));
  console.log("GENERATED:", JSON.stringify(generated.images[0], null, 2));

  console.log("\n=== CHARTS ===");
  console.log("ORIGINAL:", JSON.stringify(original.charts, null, 2));
  console.log("GENERATED:", JSON.stringify(generated.charts, null, 2));

  // Find some key merges to figure out positioning
  console.log("\n=== KEY MERGES ===");
  const findMerge = (merges, query) => merges.find(m => m.includes(query));
  console.log("ORIGINAL Title Merge (Row 2):", original.merges.filter(m => m.includes('2')));
  console.log("GENERATED Title Merge (Row 2):", generated.merges.filter(m => m.includes('2')));
}

run().catch(console.error);
