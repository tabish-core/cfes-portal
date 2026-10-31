const { launchBrowser } = require('./launchBrowser');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const toPlain = (val) => {
  if (!val || typeof val !== 'object') return val;
  if (typeof val.toObject === 'function') return val.toObject();
  return val;
};

const generateCCRPDF = async (rawData) => {
  const data = toPlain(rawData) || {};
  const courseInfo = toPlain(data.courseInfo) || {};
  const rawWeekly = toPlain(data.weeklyData) || [];
  const weeklyData = Array.isArray(rawWeekly) ? rawWeekly.map(toPlain) : [];
  const rawAlternate = toPlain(data.alternateData) || [];
  const alternateData = Array.isArray(rawAlternate) ? rawAlternate.map(toPlain) : [];

  // Pre-process weekly data for Handlebars rowspan logic
  const processedWeekly = [];
  const weekSpans = {};

  weeklyData.forEach(row => {
    if (!row.isSpecialRow && row.weekNo) {
      weekSpans[row.weekNo] = (weekSpans[row.weekNo] || 0) + 1;
    }
  });

  const renderedWeeks = new Set();

  weeklyData.forEach(row => {
    if (row.isSpecialRow) {
      processedWeekly.push({ ...row });
      renderedWeeks.add(row.weekNo); // To reset if needed, though they shouldn't clash
    } else {
      const isFirst = !renderedWeeks.has(row.weekNo);
      if (isFirst) {
        renderedWeeks.add(row.weekNo);
      }
      processedWeekly.push({
        ...row,
        showWeek: isFirst,
        weekSpan: weekSpans[row.weekNo] || 1,
        showDuration: isFirst,
        durationSpan: weekSpans[row.weekNo] || 1
      });
    }
  });

  let browser;
  try {
    // Handle logo image
    const logoPath = path.join(__dirname, 'assets', 'logo.png');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    const templateData = {
      courseInfo,
      weeklyData: processedWeekly,
      alternateData,
      alternateDataCount: alternateData.length || 1,
      logoBase64
    };

    const templatePath = path.join(__dirname, 'templates', 'ccrTemplate.hbs');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    
    const template = handlebars.compile(templateHtml);
    const finalHtml = template(templateData);

    browser = await launchBrowser();
    
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
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
    console.error('PDF Generation Error:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { generateCCRPDF };
