/**
 * generateCCCPDF.js — Puppeteer-based PDF generation for Course Completion Certificate.
 *
 * Reuses:
 *  - launchBrowser.js  (shared Puppeteer launcher)
 *  - Same logo asset   (assets/logo.png)
 *  - Same Handlebars compile pattern as generateCCRPDF.js
 *
 * Portrait A4 with 0.5in margins (CCR uses landscape; CCC is simpler, single-page).
 */
const { launchBrowser } = require('./launchBrowser');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const generateCCCPDF = async (data) => {
  let browser;
  try {
    // Handle logo image (same asset as CCR)
    const logoPath = path.join(__dirname, 'assets', 'logo.png');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    const templateData = {
      courseInfo: data.courseInfo || {},
      certificateData: {
        sessionsHeld: '',
        totalRequiredSessions: '',
        endTermReviewFilled: 'Yes',
        date: '',
        ...(data.certificateData || {})
      },
      logoBase64
    };

    const templatePath = path.join(__dirname, 'templates', 'cccTemplate.hbs');
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
    console.error('CCC PDF Generation Error:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { generateCCCPDF };
