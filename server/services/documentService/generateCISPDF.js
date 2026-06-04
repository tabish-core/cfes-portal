const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const generateCISPDF = async (formData) => {
  try {
    const templatePath = path.join(__dirname, 'templates', 'cisTemplate.hbs');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    // Handle logo image
    const logoPath = path.join(__dirname, 'assets', 'logo.png');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
    formData.logoBase64 = logoBase64;
    
    // Calculate total CLOs for rowspan
    formData.alternateData.cloCount = (formData.alternateData?.cloTable || []).length;

    // Pre-process Grading Policy for cleaner row-less rendering
    const gradingPolicy = formData.alternateData?.gradingPolicy || {};
    formData.alternateData.gradingPolicyItems = [
      { label: "Quizzes", range: "10-15%", value: gradingPolicy.quizzes || 0 },
      { label: "Assignments", range: "10-15%", value: gradingPolicy.assignments || 0 },
      { label: "Projects/Presentation/CCP", range: "0-10%", value: gradingPolicy.project || 0 },
      { label: "Mid Semester Examination", range: "20-30%", value: gradingPolicy.midterm || 0 },
      { label: "End Semester Examination", range: "40-50%", value: gradingPolicy.finalExam || 0 },
    ];

    // Pre-process OBA Table for Handlebars template grouping and rowSpans
    const obaTableGrouped = [];
    if (Array.isArray(formData.alternateData?.obaTable)) {
      const grouped = {};
      formData.alternateData.obaTable.forEach(row => {
        if (!row.category) return;
        const cat = row.category.toLowerCase();
        if (!grouped[cat]) {
          grouped[cat] = {
            categoryName: row.category.charAt(0).toUpperCase() + row.category.slice(1),
            overallWeight: 0,
            assessmentDate: row.assessmentDate || "",
            items: []
          };
        }
        grouped[cat].items.push({
          subTool: row.assessmentTool,
          cloMapped: row.cloMapped,
          cloMarks: row.cloMarks,
          weightPercentage: row.weightPercentage,
          totalMarks: row.totalMarks,
          assessmentDate: row.assessmentDate || ""
        });
        grouped[cat].overallWeight += (Number(row.weightPercentage) || 0);
      });
      
      for (const key in grouped) {
        grouped[key].rowSpan = grouped[key].items.length + 1; // +1 for the total row
        grouped[key].itemsCount = grouped[key].items.length;
        
        const catLower = grouped[key].categoryName.toLowerCase();
        grouped[key].mergeDate = !(catLower.includes('quiz') || catLower.includes('assignment'));
        
        obaTableGrouped.push(grouped[key]);
      }
    }
    formData.alternateData.obaTableGrouped = obaTableGrouped;

    // Pre-process Weekly Data for rowSpans
    let currentWeek = null;
    let weekSpans = {};
    formData.weeklyData?.forEach(row => {
      if (!row.isSpecialRow && row.week) {
        weekSpans[row.week] = (weekSpans[row.week] || 0) + 1;
      }
    });

    const processedWeeklyData = formData.weeklyData?.map(row => {
      if (row.isSpecialRow) return row;
      const showWeek = row.week !== currentWeek;
      if (showWeek) {
        currentWeek = row.week;
      }
      return {
        ...row,
        showWeek,
        weekSpan: weekSpans[row.week] || 1
      };
    }) || [];
    formData.weeklyData = processedWeeklyData;

    // Compile template
    const template = handlebars.compile(templateHtml);
    const html = template(formData);

    // Launch Puppeteer
    // --no-sandbox is often required for environments like Render/Docker
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set HTML content
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; width: 100%; text-align: center;">
          ${logoBase64 ? `<img src="${logoBase64}" style="height: 41px;">` : '<span style="font-weight: bold; color: #1a56db;">IQRA UNIVERSITY IU</span>'}
        </div>
      `,
      footerTemplate: '<div style="font-size: 10px; width: 100%; text-align: center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: {
        top: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
        right: '0.75in'
      }
    });

    await browser.close();

    // Puppeteer 24+ returns Uint8Array. We must convert it to a Node Buffer 
    // so Express doesn't accidentally serialize it into a JSON object.
    return Buffer.from(pdfBuffer);

  } catch (error) {
    console.error("Error generating PDF via Puppeteer:", error);
    throw error;
  }
};

module.exports = {
  generateCISPDF
};
