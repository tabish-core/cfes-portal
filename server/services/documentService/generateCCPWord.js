const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const cheerio = require('cheerio');

/**
 * Generates an editable Word (.docx) document for the CCP / Class Project form.
 * Preserves the exact layout, margins, fonts, borders, and header logo from reference/CCP,Class Project.docx
 * while replacing the sample content with user-saved data.
 *
 * @param {Object} data - CCP form data { headerInfo, mappingTable, problemStatement, constraintsAssumptions, computationalTools, expectedOutcomes, deliverables, wpAttributes }
 * @returns {Promise<Buffer>} - Buffer of the generated .docx file
 */
const generateCCPWord = async (data = {}) => {
  const {
    headerInfo = {},
    mappingTable = {},
    problemStatement = '',
    constraintsAssumptions = '',
    computationalTools = '',
    expectedOutcomes = '',
    deliverables = {},
    wpAttributes = [],
  } = data;

  // Candidate paths to support both local workspace and production container deployments
  const candidatePaths = [
    path.join(__dirname, 'templates', 'CCP,Class Project.docx'),
    path.join(__dirname, '../../../reference/CCP,Class Project.docx'),
    path.join(process.cwd(), 'reference/CCP,Class Project.docx'),
    path.join(process.cwd(), '../reference/CCP,Class Project.docx'),
    path.join(process.cwd(), 'server/services/documentService/templates/CCP,Class Project.docx'),
  ];

  const templatePath = candidatePaths.find((p) => fs.existsSync(p));
  if (!templatePath) {
    throw new Error(`CCP reference template not found in candidate paths: ${candidatePaths.join(', ')}`);
  }

  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  // Clean and update Word header (remove BS(SE)V1.0 floating textbox, inject clean logo)
  const headerXmlFile = zip.file('word/header1.xml');
  if (headerXmlFile) {
    let headerXml = await headerXmlFile.async('text');
    // Remove the floating Text Box containing BS(SE)V1.0 beside the logo
    headerXml = headerXml.replace(/<w:r\b[^>]*>[\s\S]*?<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>[\s\S]*?<\/w:r>/g, '');

    const cisLogoPath = path.join(__dirname, 'assets', 'logo.png');
    if (fs.existsSync(cisLogoPath)) {
      const cisLogoBuffer = fs.readFileSync(cisLogoPath);
      zip.file('word/media/image1.png', cisLogoBuffer);
      // Remove any srcRect cropping since logo.png has no whitespace padding
      headerXml = headerXml.replace(/<a:srcRect[^>]*\/>/g, '<a:srcRect/>');
      // Set extent to 2.40 inches x 0.56 inches (matching CIS logo aspect ratio: 366x86)
      headerXml = headerXml.replace(/cx="\d+"\s+cy="\d+"/g, 'cx="2196000" cy="516000"');
    }
    zip.file('word/header1.xml', headerXml);
  }

  const docXml = await zip.file('word/document.xml').async('text');
  const $ = cheerio.load(docXml, { xmlMode: true });

  // ── 1. Header Information (Department & Program) ──────────────────────────
  // Child 0: Department: [Run 1]            Program:  [Run 4]
  const child0 = $('w\\:body > w\\:p').eq(0);
  const runs0 = child0.find('w\\:r');
  if (runs0.length >= 5) {
    runs0.eq(1).find('w\\:t').text(headerInfo.department || '');
    runs0.eq(1).find('w\\:rPr').find('w\\:color').attr('w:val', '000000');
    runs0.eq(4).find('w\\:t').text(headerInfo.program || '');
    runs0.eq(4).find('w\\:rPr').find('w\\:color').attr('w:val', '000000');
  }

  // ── 2. Course Title Banner ───────────────────────────────────────────────
  // Child 1: [Run 0] Course Title
  const child1 = $('w\\:body > w\\:p').eq(1);
  const titleText = headerInfo.courseTitle || headerInfo.courseCode || '';
  child1.find('w\\:r').eq(0).find('w\\:t').text(titleText ? `${titleText} ` : '');
  child1.find('w\\:rPr').find('w\\:color').attr('w:val', '000000');
  child1.find('w\\:r').eq(0).find('w\\:rPr').find('w\\:color').attr('w:val', '000000');

  // ── 3. Table 0 (Dates, Marks, Mappings) ──────────────────────────────────
  const tbl0 = $('w\\:body > w\\:tbl').eq(0);
  if (tbl0.length > 0) {
    const tr0 = tbl0.find('w\\:tr').eq(0);
    // Row 0, Cell 0: Announced date
    tr0.find('w\\:tc').eq(0).find('w\\:t').text(`Announced date: ${headerInfo.announcedDate || ''}`);
    // Row 0, Cell 1: Due Date
    tr0.find('w\\:tc').eq(1).find('w\\:t').text(`Due Date: ${headerInfo.dueDate || ''}`);
    // Row 0, Cell 2: Total Marks
    tr0.find('w\\:tc').eq(2).find('w\\:t').text(`Total Marks = ${headerInfo.totalMarks || ''}`);

    // Row 3: Mappings
    const tr3 = tbl0.find('w\\:tr').eq(3);
    // Cell 0: Mapped CLO
    tr3.find('w\\:tc').eq(0).find('w\\:t').text(mappingTable.mappedClo || '');
    tr3.find('w\\:tc').eq(0).find('w\\:rPr').find('w\\:color').attr('w:val', '000000');
    tr3.find('w\\:tc').eq(0).find('w\\:r').find('w\\:color').attr('w:val', '000000');

    // Cell 1: SDG
    tr3.find('w\\:tc').eq(1).find('w\\:t').text(mappingTable.sdg || '');
    tr3.find('w\\:tc').eq(1).find('w\\:rPr').find('w\\:color').attr('w:val', '000000');
    tr3.find('w\\:tc').eq(1).find('w\\:r').find('w\\:color').attr('w:val', '000000');

    // Helper to render multi-line text inside a table cell (black text)
    const renderCellLines = ($tc, text) => {
      const tcPr = $tc.find('w\\:tcPr').prop('outerHTML') || '';
      $tc.empty();
      if (tcPr) $tc.append(tcPr);

      const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        $tc.append(
          '<w:p><w:pPr><w:widowControl w:val="0"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/></w:rPr><w:t></w:t></w:r></w:p>'
        );
      } else {
        lines.forEach(line => {
          $tc.append(
            `<w:p><w:pPr><w:widowControl w:val="0"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
          );
        });
      }
    };

    renderCellLines(tr3.find('w\\:tc').eq(2), mappingTable.knowledgeProfile);
    renderCellLines(tr3.find('w\\:tc').eq(3), mappingTable.complexProblemSolvingMapped);
  }

  // ── 4. Narrative Paragraphs (Problem Statement, Constraints, etc.) ────────
  // We locate the sections by their unique heading text
  const body = $('w\\:body');

  // Helper to create a user text paragraph matching template styling (black text, Times New Roman, 12pt)
  const createUserParagraph = (text) => {
    return `<w:p><w:pPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:adjustRightInd w:val="0"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="360"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
  };

  // Helper to create a bullet list item for Deliverables (black text)
  const createBulletItem = (text) => {
    return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="8"/></w:numPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:adjustRightInd w:val="0"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
  };

  // Replace text in Problem Statement
  let foundProblemStmt = false;
  let foundConstraints = false;
  let foundComputational = false;
  let foundExpectedOutcomes = false;
  let foundDeliverable = false;

  // Let's identify the elements between Table 0 and Table 1
  const elements = body.children().toArray();
  const tbl0Index = elements.findIndex(el => el.tagName === 'w:tbl');
  const tbl1Index = elements.findLastIndex(el => el.tagName === 'w:tbl');

  // We will reconstruct the middle section cleanly
  // Middle section begins after tbl0 and ends before tbl1
  const middleElements = elements.slice(tbl0Index + 1, tbl1Index);

  // Remove existing middle elements from body
  middleElements.forEach(el => $(el).remove());

  // Now append cleanly structured middle elements right after tbl0:
  let middleHtml = '';

  // 4a. Problem Statement Heading (~5 pt space after heading, bold black)
  middleHtml += `<w:p><w:pPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:adjustRightInd w:val="0"/><w:spacing w:before="120" w:after="100" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>Problem Statement:</w:t></w:r></w:p>`;

  // 4b. Problem Statement Content
  const pStmtText = problemStatement || 'CEP/CCP shall be properly defined. Problem statement or description may include at least the following,';
  const pStmtLines = pStmtText.split('\n').map(l => l.trim()).filter(Boolean);
  pStmtLines.forEach(l => {
    middleHtml += `<w:p><w:pPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:adjustRightInd w:val="0"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
  });

  // 4c. i. Constraints / Assumptions Heading (~5 pt space after heading, bold black)
  middleHtml += `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="9"/></w:numPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:adjustRightInd w:val="0"/><w:spacing w:before="100" w:after="100" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>Constraints/ Assumptions:</w:t></w:r></w:p>`;
  if (constraintsAssumptions) {
    constraintsAssumptions.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      middleHtml += createUserParagraph(l);
    });
  }

  // 4d. ii. Computational / Modern Tool Heading (~5 pt space after heading, bold black)
  middleHtml += `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="9"/></w:numPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:adjustRightInd w:val="0"/><w:spacing w:before="100" w:after="100" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>Identification of areas where use of computational / modern tool is required.</w:t></w:r></w:p>`;
  if (computationalTools) {
    computationalTools.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      middleHtml += createUserParagraph(l);
    });
  }

  // 4e. iii. Expected Outcomes Heading (~5 pt space after heading, bold black)
  middleHtml += `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="9"/></w:numPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:adjustRightInd w:val="0"/><w:spacing w:before="100" w:after="100" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>Expected Outcomes:</w:t></w:r></w:p>`;
  if (expectedOutcomes) {
    expectedOutcomes.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      middleHtml += createUserParagraph(l);
    });
  }

  // 4f. Deliverable Heading (bold black)
  middleHtml += `<w:p><w:pPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:adjustRightInd w:val="0"/><w:spacing w:before="120" w:after="60" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>Deliverable:</w:t></w:r></w:p>`;

  const delHeading = deliverables.heading || 'Report (must include)';
  middleHtml += `<w:p><w:pPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:adjustRightInd w:val="0"/><w:spacing w:before="0" w:after="100" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${escapeXml(delHeading)}</w:t></w:r></w:p>`;

  // 4g. Deliverables Items (Bullet list)
  const defaultItems = [
    'Introduction',
    'Literature review (discuss two models)',
    'Designed modal',
    'Methodology',
    'Result and Discussion',
    'References',
  ];

  let itemsToRender = [];
  if (Array.isArray(deliverables.items) && deliverables.items.length > 0) {
    itemsToRender = deliverables.items.map(it => (typeof it === 'string' ? it : it.label)).filter(Boolean);
  }
  if (itemsToRender.length === 0) {
    itemsToRender = defaultItems;
  }

  itemsToRender.forEach(it => {
    middleHtml += createBulletItem(it);
  });

  // 4h. Explicit Deliberate Page Break before Page 2 (Table 1)
  middleHtml += `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>`;

  // Insert middleHtml right after tbl0
  $('w\\:body > w\\:tbl').eq(0).after(middleHtml);

  // ── 5. Table 1 (Page 2: WP Attributes Table) ─────────────────────────────
  const tbl1 = $('w\\:body > w\\:tbl').eq(1);
  if (tbl1.length > 0) {
    // Map WP1 through WP8 to rows 2 through 9
    const wpCodes = ['WP1', 'WP2', 'WP3', 'WP4', 'WP5', 'WP6', 'WP7', 'WP8'];

    wpCodes.forEach((code, idx) => {
      const rowIndex = idx + 2;
      const tr = tbl1.find('w\\:tr').eq(rowIndex);
      if (tr.length > 0) {
        // Find matching saved WP attribute
        const savedAttr = (wpAttributes || []).find(
          a => (a.code || '').toUpperCase().replace(/\s+/g, '') === code
        );

        let justification = 'NA';
        if (savedAttr) {
          if (savedAttr.justification && savedAttr.justification.trim()) {
            justification = savedAttr.justification.trim();
          } else if (savedAttr.isMapped) {
            justification = '';
          }
        }

        const tcJust = tr.find('w\\:tc').eq(2);
        const tcPr = tcJust.find('w\\:tcPr').prop('outerHTML') || '';
        tcJust.empty();
        if (tcPr) tcJust.append(tcPr);

        const lines = justification.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
          tcJust.append(
            '<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/></w:rPr><w:t></w:t></w:r></w:p>'
          );
        } else {
          lines.forEach(line => {
            tcJust.append(
              `<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
            );
          });
        }
      }
    });
  }

  // ── 6. Remove Trailing Blank Paragraphs After Table 1 ───────────────────
  // Remove empty paragraphs after tbl1 to avoid any trailing blank page
  const afterTbl1 = $('w\\:body > w\\:tbl').eq(1).nextAll('w\\:p');
  afterTbl1.each((_, p) => {
    if ($(p).text().trim() === '') {
      $(p).remove();
    }
  });

  // Pack the updated zip back into a Buffer
  zip.file('word/document.xml', $.xml());
  const outputBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return outputBuffer;
};

/**
 * Escapes characters for safe inclusion in XML text nodes.
 */
function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { generateCCPWord };
