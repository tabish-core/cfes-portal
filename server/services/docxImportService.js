/**
 * docxImportService.js — DOCX-to-JSON parsing service (document-agnostic).
 *
 * Accepts a .docx buffer, extracts:
 *   1. Raw plain text
 *   2. Structured HTML (via mammoth)
 *   3. All detected tables with rows/cells (via cheerio)
 *   4. Detected section headings
 *
 * Does NOT map to CIS schema fields — that's a future step.
 */

const mammoth = require('mammoth');
const cheerio = require('cheerio');

/**
 * Parse a .docx buffer and return structured extraction results.
 * @param {Buffer} buffer — the uploaded .docx file contents
 * @returns {Promise<Object>} — extracted data
 */
async function parseDocxBuffer(buffer) {
  // 1. Convert to HTML (preserves tables, bold, structure)
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const html = htmlResult.value;
  const conversionMessages = htmlResult.messages; // warnings from mammoth

  // 2. Extract raw plain text (useful for free-text fields)
  const textResult = await mammoth.extractRawText({ buffer });
  const rawText = textResult.value;

  // 3. Parse HTML with cheerio to walk DOM
  const $ = cheerio.load(html);

  // 4. Extract all tables
  const tables = [];
  $('table').each((tableIndex, tableEl) => {
    const tableData = {
      tableIndex,
      rows: [],
      rowCount: 0,
      colCount: 0,
    };

    $(tableEl).find('tr').each((rowIndex, rowEl) => {
      const cells = [];
      $(rowEl).find('td, th').each((cellIndex, cellEl) => {
        cells.push({
          cellIndex,
          text: $(cellEl).text().trim(),
          html: $(cellEl).html(),
          // Detect colspan/rowspan for merged cells
          colspan: parseInt($(cellEl).attr('colspan')) || 1,
          rowspan: parseInt($(cellEl).attr('rowspan')) || 1,
        });
      });

      tableData.rows.push({
        rowIndex,
        cells,
        cellCount: cells.length,
      });
    });

    tableData.rowCount = tableData.rows.length;
    tableData.colCount = tableData.rows.length > 0
      ? Math.max(...tableData.rows.map(r => r.cells.reduce((sum, c) => sum + c.colspan, 0)))
      : 0;

    tables.push(tableData);
  });

  // 5. Extract section headings (h1-h6 and bold standalone paragraphs)
  const sections = [];
  $('h1, h2, h3, h4, h5, h6').each((i, el) => {
    sections.push({
      level: parseInt(el.tagName.replace('h', '')),
      text: $(el).text().trim(),
    });
  });

  // Also detect bold-only paragraphs as potential section labels
  // (CIS template uses bold text instead of heading styles)
  $('p').each((i, el) => {
    const $p = $(el);
    const children = $p.children();
    const text = $p.text().trim();

    // If the paragraph has content and ALL of it is wrapped in <strong>
    if (text && children.length > 0) {
      const strongText = $p.find('strong').text().trim();
      if (strongText === text && text.length > 3 && text.length < 150) {
        sections.push({
          level: 'bold',
          text,
        });
      }
    }
  });

  // 6. Build summary stats
  const summary = {
    totalTables: tables.length,
    totalSections: sections.length,
    rawTextLength: rawText.length,
    htmlLength: html.length,
    conversionWarnings: conversionMessages.length,
  };

  return {
    summary,
    sections,
    tables,
    rawText,
    html,
    conversionMessages,
  };
}

module.exports = { parseDocxBuffer };
