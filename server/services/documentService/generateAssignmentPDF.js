/**
 * generateAssignmentPDF.js — Puppeteer-based PDF generation for Assignment documents.
 * Generates an official University A4 PDF matching the layout of generateAssignmentWord.
 */
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const { launchBrowser } = require('./launchBrowser');

/**
 * Generate a PDF Buffer from Assignment data.
 *
 * @param {Object} data - Assignment document or plain object
 * @returns {Promise<Buffer>} Node.js Buffer of the generated PDF
 */
const generateAssignmentPDF = async (data) => {
  const assignment = data && typeof data.toObject === 'function' ? data.toObject() : (data || {});
  const assignmentInfo = assignment.assignmentInfo || {};
  const courseInfo = assignment.courseInfo || {};
  const cloMappings = Array.isArray(assignment.cloMappings) ? assignment.cloMappings : [];

  const assignmentTitle = assignment.assignmentTitle || '';
  const objective = assignment.objective || '';
  const assignmentDescription = assignment.assignmentDescription || '';
  const tasks = Array.isArray(assignment.tasks) ? assignment.tasks : [];
  const submissionGuidelines = Array.isArray(assignment.submissionGuidelines) ? assignment.submissionGuidelines : [];
  const evaluationCriteria = Array.isArray(assignment.evaluationCriteria) ? assignment.evaluationCriteria : [];
  const tipsForSuccess = Array.isArray(assignment.tipsForSuccess) ? assignment.tipsForSuccess : [];

  // Resolve Logo Base64
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  let logoBase64 = null;
  if (fs.existsSync(logoPath)) {
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (logoErr) {
      console.warn('Could not read logo.png for Assignment PDF:', logoErr.message);
    }
  }

  // Pre-process headers and titles
  const rawAssignNum = (assignmentInfo.assignmentNumber || '').toString().trim();
  const assignmentTitleHeader = rawAssignNum
    ? (rawAssignNum.toLowerCase().startsWith('assignment') ? rawAssignNum : `Assignment #${rawAssignNum}`)
    : 'Assignment';

  const upperCourseTitle = (courseInfo.courseTitle || 'COURSE TITLE').toUpperCase();

  const templateData = {
    assignmentInfo,
    courseInfo,
    cloMappings,
    assignmentTitle,
    objective,
    assignmentDescription,
    tasks,
    submissionGuidelines,
    evaluationCriteria,
    tipsForSuccess,
    logoBase64,
    assignmentTitleHeader,
    upperCourseTitle,
  };

  const templatePath = path.join(__dirname, 'templates', 'assignmentTemplate.hbs');
  const templateHtml = fs.readFileSync(templatePath, 'utf8');
  const template = handlebars.compile(templateHtml);
  const finalHtml = template(templateData);

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.6in',
        bottom: '0.6in',
        left: '0.6in',
        right: '0.6in',
      },
    });

    return Buffer.from(pdfUint8Array);
  } catch (err) {
    console.error('Assignment PDF generation error:', err);
    throw err;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn('Failed to close Puppeteer browser after Assignment PDF generation:', closeErr.message);
      }
    }
  }
};

module.exports = { generateAssignmentPDF };
