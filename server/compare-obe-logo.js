const JSZip = require('jszip');
const fs = require('fs');
const cheerio = require('cheerio');

async function extractLogoPos(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  
  const drawingXmlStr = await zip.file('xl/drawings/drawing1.xml')?.async('string');
  const relsXmlStr = await zip.file('xl/drawings/_rels/drawing1.xml.rels')?.async('string');
  
  if (drawingXmlStr && relsXmlStr) {
    const $dr = cheerio.load(drawingXmlStr, { xmlMode: true });
    const $rels = cheerio.load(relsXmlStr, { xmlMode: true });
    
    const imageMap = {};
    $rels('Relationship').each((i, el) => {
      const type = $rels(el).attr('Type');
      if (type.includes('image')) {
        imageMap[$rels(el).attr('Id')] = $rels(el).attr('Target');
      }
    });

    $dr('xdr\\:twoCellAnchor').each((i, el) => {
      const isPic = $dr(el).find('xdr\\:pic').length > 0;
      if (isPic) {
         const rId = $dr(el).find('a\\:blip').attr('r:embed');
         const target = imageMap[rId];
         
         const anchor = {
           from: {
             col: $dr(el).find('xdr\\:from xdr\\:col').text(),
             row: $dr(el).find('xdr\\:from xdr\\:row').text()
           },
           to: {
             col: $dr(el).find('xdr\\:to xdr\\:col').text(),
             row: $dr(el).find('xdr\\:to xdr\\:row').text()
           },
           target: target
         };
         console.log(anchor);
      }
    });
  }
}

async function run() {
  console.log("=== ORIGINAL IMAGES ===");
  await extractLogoPos('../reference/obe/Original_OBE.xlsx');
}

run().catch(console.error);
