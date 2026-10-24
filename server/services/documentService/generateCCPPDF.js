const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const { launchBrowser } = require('./launchBrowser');

const STANDARD_WP = [
  { code: 'WP1', title: 'Range of Conflicting Requirements' },
  { code: 'WP2', title: 'Depth of Analysis required' },
  { code: 'WP3', title: 'Depth of Knowledge required' },
  { code: 'WP4', title: 'Familiarity of issues' },
  { code: 'WP5', title: 'Extent of applicable codes' },
  { code: 'WP6', title: 'Extent of stakeholder involvement and level of conflicting requirements.' },
  { code: 'WP7', title: 'Consequences' },
  { code: 'WP8', title: 'Interdependence' },
];

const DEFAULT_DELIVERABLES = [
  'Introduction',
  'Literature review (discuss two models)',
  'Designed modal',
  'Methodology',
  'Result and Discussion',
  'References',
];

/**
 * Generates a PDF document for the CCP / Class Project form using Handlebars and Puppeteer.
 * Replicates the exact 2-page visual structure of the reference document.
 *
 * @param {Object} formData - CCP form data { headerInfo, mappingTable, problemStatement, constraintsAssumptions, computationalTools, expectedOutcomes, deliverables, wpAttributes }
 * @returns {Promise<Buffer>} - Buffer of the generated .pdf file
 */
const generateCCPPDF = async (formData = {}) => {
  let browser;
  try {
    const templatePath = path.join(__dirname, 'templates', 'ccpTemplate.hbs');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    // Handle logo image using standard CIS logo asset
    let logoBase64 = null;
    const cisLogoPath = path.join(__dirname, 'assets', 'logo.png');
    const fallbackLogoPath = path.join(__dirname, 'assets', 'ccp_logo.png');
    const targetLogoPath = fs.existsSync(cisLogoPath) ? cisLogoPath : fallbackLogoPath;

    if (fs.existsSync(targetLogoPath)) {
      const logoBuffer = fs.readFileSync(targetLogoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    // Process deliverables items
    let deliverablesItems = [];
    if (formData.deliverables && Array.isArray(formData.deliverables.items) && formData.deliverables.items.length > 0) {
      deliverablesItems = formData.deliverables.items
        .map(it => (typeof it === 'string' ? it : it.label))
        .filter(Boolean);
    }
    if (deliverablesItems.length === 0) {
      deliverablesItems = DEFAULT_DELIVERABLES;
    }

    // Process WP1-WP8 rows
    const wpRows = STANDARD_WP.map(std => {
      const saved = (formData.wpAttributes || []).find(
        a => (a.code || '').toUpperCase().replace(/\s+/g, '') === std.code
      );

      let justification = 'NA';
      if (saved) {
        if (saved.justification && saved.justification.trim()) {
          justification = saved.justification.trim();
        } else if (saved.isMapped) {
          justification = '';
        }
      }

      return {
        code: std.code,
        title: std.title,
        justification,
      };
    });

    const templateData = {
      ...formData,
      logoBase64,
      deliverablesItems,
      wpRows,
    };

    const template = handlebars.compile(templateHtml);
    const html = template(templateData);

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfUint8 = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.4in',
        bottom: '0.4in',
        left: '0.5in',
        right: '0.5in',
      },
    });

    return Buffer.from(pdfUint8);
  } catch (error) {
    console.error('Error generating CCP PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = { generateCCPPDF };
