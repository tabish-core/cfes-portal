/**
 * generateCRRPDF.js — Puppeteer-based PDF generation for Course Review Report (Theory).
 *
 * Reuses:
 *  - launchBrowser.js   (shared Puppeteer launcher)
 *  - Same logo asset    (assets/logo.png)
 *  - Same Handlebars compile pattern as generateCCRPDF.js / generateCCCPDF.js
 *
 * Portrait A4 with 0.5in margins (matches CCR margin config).
 */
const { launchBrowser } = require('./launchBrowser');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const generateCRRPDF = async (data) => {
  let browser;
  try {
    // Handle logo image (same asset as CCR/CCC)
    const logoPath = path.join(__dirname, 'assets', 'logo.png');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    // Pre-process grade summary keys for Handlebars (keys with + are not valid identifiers)
    const rawGrades = data.gradeSummary || {};
    const gradeSummary = {
      Aplus: rawGrades['A+'] || '',
      A: rawGrades['A'] || '',
      Bplus: rawGrades['B+'] || '',
      B: rawGrades['B'] || '',
      Cplus: rawGrades['C+'] || '',
      C: rawGrades['C'] || '',
      F: rawGrades['F'] || '',
      classAverage: rawGrades.classAverage || '',
    };

    // Pre-process boolean flags for radio display in template
    const learningOutcomes = data.courseLearningOutcomes || {};

    const templateData = {
      courseInfo: data.courseInfo || {},
      assessmentSummary: data.assessmentSummary || [],
      gradeSummary,
      learningOutcomes,
      courseEnhancement: data.courseEnhancement || {},
      signatureInfo: data.signatureInfo || {},
      logoBase64,
      // Boolean flags for radio buttons
      outcomesYes: learningOutcomes.outcomesAdequate === 'Yes',
      outcomesNo: learningOutcomes.outcomesAdequate === 'No',
      cloSatisfied: learningOutcomes.cloAttainmentStatus === 'Satisfied',
      cloNotSatisfied: learningOutcomes.cloAttainmentStatus === 'Not Satisfied',
      ploSatisfied: learningOutcomes.ploAttainmentStatus === 'Satisfied',
      ploNotSatisfied: learningOutcomes.ploAttainmentStatus === 'Not Satisfied',
    };

    const templatePath = path.join(__dirname, 'templates', 'crrTemplate.hbs');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    const template = handlebars.compile(templateHtml);
    const finalHtml = template(templateData);

    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: {
        top: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
        right: '0.5in'
      }
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('CRR PDF Generation Error:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { generateCRRPDF };
