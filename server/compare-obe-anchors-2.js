const JSZip = require('jszip');
const fs = require('fs');
const cheerio = require('cheerio');

async function dumpLayout(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  
  const wsXmlStr = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  
  const strings = [];
  if (sharedStringsXml) {
    const $ss = cheerio.load(sharedStringsXml, { xmlMode: true });
    $ss('si').each((i, el) => {
      strings.push($ss(el).text());
    });
  }
  
  if (wsXmlStr) {
    const $ws = cheerio.load(wsXmlStr, { xmlMode: true });
    
    $ws('row').each((i, row) => {
      const r = parseInt($ws(row).attr('r'), 10);
      if (r > 0 && r < 50) { // Limit to top 50 rows
        $ws(row).find('c').each((j, cell) => {
          const ref = $ws(cell).attr('r');
          const type = $ws(cell).attr('t');
          let val = $ws(cell).find('v').text();
          
          if (type === 's') {
            val = strings[parseInt(val, 10)];
          }
          
          if (val && val.trim().length > 0 && isNaN(Number(val))) {
             console.log(`${ref}: ${val.substring(0, 30).replace(/\n/g, ' ')}`);
          }
        });
      }
    });
  }
}

dumpLayout('../reference/obe/Original_OBE.xlsx').catch(console.error);
