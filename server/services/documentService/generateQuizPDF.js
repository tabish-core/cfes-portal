/**
 * generateQuizPDF.js — Puppeteer-based PDF generation for Quiz documents.
 * Generates an official University A4 PDF matching the layout of generateQuizWord.
 */
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const { launchBrowser } = require('./launchBrowser');

/**
 * Generate a PDF Buffer from Quiz data.
 *
 * @param {Object} data - Quiz document or plain object containing quizInfo, courseInfo, cloMappings, questions
 * @returns {Promise<Buffer>} Node.js Buffer of the generated PDF
 */
const generateQuizPDF = async (data) => {
  const quiz = data && typeof data.toObject === 'function' ? data.toObject() : (data || {});
  const quizInfo = quiz.quizInfo || {};
  const courseInfo = quiz.courseInfo || {};
  const cloMappings = Array.isArray(quiz.cloMappings) ? quiz.cloMappings : [];
  const rawQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];

  // Normalize questions
  const questions = rawQuestions.map((q, idx) => ({
    questionNumber: q.questionNumber !== undefined && q.questionNumber !== null && q.questionNumber !== ''
      ? q.questionNumber
      : (idx + 1),
    marks: q.marks !== undefined && q.marks !== null ? q.marks : '',
    questionText: q.questionText || '',
  }));

  // Resolve Logo Base64
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  let logoBase64 = null;
  if (fs.existsSync(logoPath)) {
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (logoErr) {
      console.warn('Could not read logo.png for Quiz PDF:', logoErr.message);
    }
  }

  // Pre-process headers and titles
  const rawQuizNum = (quizInfo.quizNumber || '').toString().trim();
  const quizTitleHeader = rawQuizNum
    ? (rawQuizNum.toLowerCase().startsWith('quiz') ? rawQuizNum : `Quiz #${rawQuizNum}`)
    : 'Quiz';

  const upperCourseTitle = (courseInfo.courseTitle || 'COURSE TITLE').toUpperCase();

  const templateData = {
    quizInfo,
    courseInfo,
    cloMappings,
    questions,
    logoBase64,
    quizTitleHeader,
    upperCourseTitle,
  };

  const templatePath = path.join(__dirname, 'templates', 'quizTemplate.hbs');
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
    console.error('Quiz PDF generation error:', err);
    throw err;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn('Failed to close Puppeteer browser after Quiz PDF generation:', closeErr.message);
      }
    }
  }
};

module.exports = { generateQuizPDF };
