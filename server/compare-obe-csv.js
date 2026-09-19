const JSZip = require('jszip');
const fs = require('fs');
const cheerio = require('cheerio');

async function dumpCsv(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  
  const wsXmlStr = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  
  const strings = [];
  if (sharedStringsXml) {
    const $ss = cheerio.load(sharedStringsXml, { xmlMode: true });
    $ss('si').each((i, el) => {
      strings.push($ss(el).text().trim());
    });
  }
  
  if (wsXmlStr) {
    const $ws = cheerio.load(wsXmlStr, { xmlMode: true });
    const grid = {};
    let maxRow = 0;
    let maxCol = 0;
    
    const getColIndex = (colStr) => {
      let idx = 0;
      for (let i = 0; i < colStr.length; i++) {
        idx = idx * 26 + (colStr.charCodeAt(i) - 64);
      }
      return idx; // 1-based
    };

    $ws('row').each((i, row) => {
      const r = parseInt($ws(row).attr('r'), 10);
      if (r > maxRow) maxRow = r;
      
      $ws(row).find('c').each((j, cell) => {
        const ref = $ws(cell).attr('r');
        const colStr = ref.replace(/[0-9]/g, '');
        const cIdx = getColIndex(colStr);
        if (cIdx > maxCol) maxCol = cIdx;
        
        const type = $ws(cell).attr('t');
        let val = $ws(cell).find('v').text();
        
        if (type === 's') {
          val = strings[parseInt(val, 10)];
        }
        
        if (val) {
          if (!grid[r]) grid[r] = {};
          grid[r][cIdx] = val.replace(/\n/g, ' ').replace(/,/g, ';').trim();
        }
      });
    });

    let csv = '';
    // Header row with column letters
    csv += 'Row,';
    for (let c = 1; c <= 75; c++) {
       let letter = '';
       let temp = c;
       while (temp > 0) {
          let rem = (temp - 1) % 26;
          letter = String.fromCharCode(65 + rem) + letter;
          temp = Math.floor((temp - 1) / 26);
       }
       csv += `${letter},`;
    }
    csv += '\n';

    for (let r = 1; r <= 75; r++) {
       let line = `${r},`;
       let hasData = false;
       for (let c = 1; c <= 75; c++) {
          if (grid[r] && grid[r][c]) {
             line += `${grid[r][c]},`;
             hasData = true;
          } else {
             line += ',';
          }
       }
       if (hasData) {
          fs.appendFileSync('layout.csv', line + '\n');
       }
    }
  }
}

fs.writeFileSync('layout.csv', '');
dumpCsv('../reference/obe/Original_OBE.xlsx').then(() => console.log('Wrote to layout.csv')).catch(console.error);
